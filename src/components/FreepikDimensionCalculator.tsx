import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import {
  Ruler,
  Upload,
  CheckCircle2,
  Download,
  Trash2,
  Loader2,
  Archive,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FreepikDimensionCalculatorProps {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type FixMode = 'pad' | 'upscale';

interface ProcessedPreview {
  id: string;
  file: File;
  fileName: string;
  originalW: number;
  originalH: number;
  fixedW: number;
  fixedH: number;
  scaleFactor: number;
  wasResized: boolean;
  modeUsed: FixMode;
  previewUrl: string;
  fixedBlob: Blob | null;
  fixedSizeKB: number;
  status: 'processing' | 'ready' | 'error';
}

const MAX_FREEPIK_SIDE = 10000;
const MIN_SAFE_JPEG_BYTES = 1024 * 1024; // 1 MB optional minimum size
const TARGET_PRESETS = [
  { value: 2000, label: 'Min. 2000 px (Standar Freepik)' },
  { value: 2050, label: 'Min. 2050 px (Aman +50px)' },
  { value: 2500, label: 'Min. 2500 px' },
  { value: 3000, label: 'Min. 3000 px' }
];

/**
 * Sets JFIF APP0 density to 300 DPI and optionally ensures minimum byte size
 * using spec-compliant JPEG COM (0xFF 0xFE) segments.
 */
async function finalizeFreepikJpeg(
  blob: Blob,
  forceMin1MB: boolean,
  dpi: number = 300
): Promise<Blob> {
  let buffer = new Uint8Array(await blob.arrayBuffer());

  // Verify JPEG SOI (0xFF 0xD8) and EOI (0xFF 0xD9)
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[buffer.length - 2] !== 0xff ||
    buffer[buffer.length - 1] !== 0xd9
  ) {
    return blob;
  }

  const dpiHi = (dpi >> 8) & 0xff;
  const dpiLo = dpi & 0xff;

  const hasJfif =
    buffer.length >= 18 &&
    buffer[2] === 0xff &&
    buffer[3] === 0xe0 &&
    buffer[6] === 0x4a &&
    buffer[7] === 0x46 &&
    buffer[8] === 0x49 &&
    buffer[9] === 0x46 &&
    buffer[10] === 0x00;

  if (hasJfif) {
    buffer[13] = 0x01; // units: DPI
    buffer[14] = dpiHi;
    buffer[15] = dpiLo;
    buffer[16] = dpiHi;
    buffer[17] = dpiLo;
  } else {
    const jfifSegment = new Uint8Array([
      0xff, 0xe0,
      0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0x01,
      0x01,
      dpiHi, dpiLo,
      dpiHi, dpiLo,
      0x00, 0x00
    ]);
    const combined = new Uint8Array(buffer.length + jfifSegment.length);
    combined.set(buffer.subarray(0, 2), 0);
    combined.set(jfifSegment, 2);
    combined.set(buffer.subarray(2), 2 + jfifSegment.length);
    buffer = combined;
  }

  if (!forceMin1MB || buffer.length >= MIN_SAFE_JPEG_BYTES) {
    return new Blob([buffer], { type: 'image/jpeg' });
  }

  const targetBytes = MIN_SAFE_JPEG_BYTES + 16 * 1024;
  let remaining = targetBytes - buffer.length;
  const maxChunkPayload = 60000;
  const segments: Uint8Array[] = [];

  while (remaining > 0) {
    const payloadLen = Math.min(remaining, maxChunkPayload);
    const segmentLen = payloadLen + 2;
    const segment = new Uint8Array(2 + segmentLen);
    segment[0] = 0xff;
    segment[1] = 0xfe;
    segment[2] = (segmentLen >> 8) & 0xff;
    segment[3] = segmentLen & 0xff;
    segment.fill(0x20, 4);
    segments.push(segment);
    remaining -= segment.length;
  }

  const head = buffer.subarray(0, buffer.length - 2);
  const eoi = buffer.subarray(buffer.length - 2);
  return new Blob([head, ...segments, eoi], { type: 'image/jpeg' });
}

/**
 * Samples the 4 corners of an image to detect solid background color for seamless canvas padding.
 */
function detectEdgeBackgroundColor(img: HTMLImageElement): string {
  try {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = img.naturalWidth;
    sampleCanvas.height = img.naturalHeight;
    const sCtx = sampleCanvas.getContext('2d');
    if (!sCtx) return '#FFFFFF';
    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sCtx.drawImage(img, 0, 0);

    const w = sampleCanvas.width;
    const h = sampleCanvas.height;
    const corners = [
      sCtx.getImageData(0, 0, 1, 1).data,
      sCtx.getImageData(w - 1, 0, 1, 1).data,
      sCtx.getImageData(0, h - 1, 1, 1).data,
      sCtx.getImageData(w - 1, h - 1, 1, 1).data
    ];

    const r = Math.round((corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4);
    const g = Math.round((corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4);
    const b = Math.round((corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4);

    // Check if corners are reasonably consistent (solid/near-solid background)
    const maxDiff = Math.max(
      ...corners.map(c => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b))
    );
    if (maxDiff <= 45) {
      return `rgb(${r}, ${g}, ${b})`;
    }
  } catch {
    // Fallback to white
  }
  return '#FFFFFF';
}

/**
 * Applies a subtle 3x3 Unsharp Mask sharpening filter to restore crisp edges after upscaling.
 */
function applyMildSharpen(ctx: CanvasRenderingContext2D, width: number, height: number, strength = 0.28) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const out = new Uint8ClampedArray(src.length);
  const center = 1 + 4 * strength;
  const side = -strength;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      const up = ((y - 1) * width + x) * 4;
      const down = ((y + 1) * width + x) * 4;
      const left = (row + (x - 1)) * 4;
      const right = (row + (x + 1)) * 4;

      out[idx] = src[idx] * center + (src[up] + src[down] + src[left] + src[right]) * side;
      out[idx + 1] = src[idx + 1] * center + (src[up + 1] + src[down + 1] + src[left + 1] + src[right + 1]) * side;
      out[idx + 2] = src[idx + 2] * center + (src[up + 2] + src[down + 2] + src[left + 2] + src[right + 2]) * side;
      out[idx + 3] = 255;
    }
  }

  // Copy border pixels unchanged
  for (let x = 0; x < width; x++) {
    const top = x * 4;
    const bot = ((height - 1) * width + x) * 4;
    for (let c = 0; c < 4; c++) {
      out[top + c] = src[top + c];
      out[bot + c] = src[bot + c];
    }
  }
  for (let y = 0; y < height; y++) {
    const l = (y * width) * 4;
    const r = (y * width + (width - 1)) * 4;
    for (let c = 0; c < 4; c++) {
      out[l + c] = src[l + c];
      out[r + c] = src[r + c];
    }
  }

  imgData.data.set(out);
  ctx.putImageData(imgData, 0, 0);
}

function computeTargetDimensions(width: number, height: number, minSide: number, mode: FixMode) {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const minDim = Math.min(safeW, safeH);
  const maxDim = Math.max(safeW, safeH);

  if (maxDim > MAX_FREEPIK_SIDE && minDim >= minSide) {
    const scale = MAX_FREEPIK_SIDE / maxDim;
    return {
      fixedW: Math.floor(safeW * scale),
      fixedH: Math.floor(safeH * scale),
      wasResized: true
    };
  }

  if (minDim >= minSide) {
    return { fixedW: safeW, fixedH: safeH, wasResized: false };
  }

  if (mode === 'pad') {
    // Expand canvas to at least minSide on both sides without upscaling original pixels
    return {
      fixedW: Math.max(safeW, minSide),
      fixedH: Math.max(safeH, minSide),
      wasResized: true
    };
  }

  const scale = minSide / minDim;
  const fixedW = safeW <= safeH ? minSide : Math.ceil(safeW * scale);
  const fixedH = safeH < safeW ? minSide : Math.ceil(safeH * scale);
  return { fixedW, fixedH, wasResized: true };
}

function processImageFile(
  file: File,
  minSide: number,
  mode: FixMode,
  forceMin1MB: boolean
): Promise<ProcessedPreview> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);

    img.onload = () => {
      const originalW = img.naturalWidth;
      const originalH = img.naturalHeight;
      const { fixedW, fixedH, wasResized } = computeTargetDimensions(originalW, originalH, minSide, mode);

      const canvas = document.createElement('canvas');
      canvas.width = fixedW;
      canvas.height = fixedH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(srcUrl);
        reject(new Error('Canvas tidak tersedia'));
        return;
      }

      if (mode === 'pad' && wasResized && Math.min(originalW, originalH) < minSide) {
        // Auto-Padding Mode: zero pixel scaling (100% original sharpness)
        const bgColor = detectEdgeBackgroundColor(img);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, fixedW, fixedH);
        const offsetX = Math.floor((fixedW - originalW) / 2);
        const offsetY = Math.floor((fixedH - originalH) / 2);
        ctx.drawImage(img, offsetX, offsetY, originalW, originalH);
      } else {
        // Upscale Mode (or already passing)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, fixedW, fixedH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, fixedW, fixedH);

        // Apply mild sharpening only when actually upscaled
        if (wasResized && (fixedW > originalW || fixedH > originalH)) {
          applyMildSharpen(ctx, fixedW, fixedH, 0.28);
        }
      }

      // Create lightweight thumbnail (max 120px) for UI grid to keep RAM low on large batches
      const thumbMax = 120;
      const thumbScale = Math.min(1, thumbMax / Math.max(fixedW, fixedH));
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = Math.max(1, Math.round(fixedW * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(fixedH * thumbScale));
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }

      canvas.toBlob(
        async (rawBlob) => {
          URL.revokeObjectURL(srcUrl);
          if (!rawBlob) {
            reject(new Error(`Gagal memproses ${file.name}`));
            return;
          }
          const finalBlob = await finalizeFreepikJpeg(rawBlob, forceMin1MB, 300);

          const thumbBlob = await new Promise<Blob | null>((res) =>
            thumbCanvas.toBlob((b) => res(b), 'image/jpeg', 0.7)
          );
          const previewUrl = URL.createObjectURL(thumbBlob || finalBlob);

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const scaleFactor =
            mode === 'pad' ? 1 : Math.max(fixedW / originalW, fixedH / originalH);

          resolve({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            fileName: `${baseName}.jpg`,
            originalW,
            originalH,
            fixedW,
            fixedH,
            scaleFactor,
            wasResized,
            modeUsed: mode,
            previewUrl,
            fixedBlob: finalBlob,
            fixedSizeKB: Math.round(finalBlob.size / 1024),
            status: 'ready'
          });
        },
        'image/jpeg',
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(srcUrl);
      reject(new Error(`Gagal membaca ${file.name}`));
    };

    img.src = srcUrl;
  });
}

export function FreepikDimensionCalculator({ addToast }: FreepikDimensionCalculatorProps) {
  const [minTarget, setMinTarget] = useState<number>(2000);
  const [fixMode, setFixMode] = useState<FixMode>('pad');
  const [forceMin1MB, setForceMin1MB] = useState<boolean>(false);
  const [items, setItems] = useState<ProcessedPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const reprocessAll = async (nextTarget: number, nextMode: FixMode, nextForce1MB: boolean) => {
    if (items.length === 0) return;
    setIsProcessing(true);
    const reprocessed: ProcessedPreview[] = [];
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      try {
        const res = await processImageFile(item.file, nextTarget, nextMode, nextForce1MB);
        res.fileName = item.fileName; // preserve deduplicated name
        reprocessed.push(res);
      } catch {
        // skip failed item
      }
    }
    setItems(reprocessed);
    setIsProcessing(false);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setIsProcessing(true);

      const usedNames = new Set(items.map(i => i.fileName.toLowerCase()));
      let renamedCount = 0;

      const getUniqueFileName = (desiredName: string): string => {
        if (!usedNames.has(desiredName.toLowerCase())) {
          usedNames.add(desiredName.toLowerCase());
          return desiredName;
        }
        const dotIdx = desiredName.lastIndexOf('.');
        const base = dotIdx !== -1 ? desiredName.slice(0, dotIdx) : desiredName;
        const ext = dotIdx !== -1 ? desiredName.slice(dotIdx) : '';
        let counter = 1;
        let candidate = `${base}_${counter}${ext}`;
        while (usedNames.has(candidate.toLowerCase())) {
          counter++;
          candidate = `${base}_${counter}${ext}`;
        }
        usedNames.add(candidate.toLowerCase());
        renamedCount++;
        return candidate;
      };

      const processed: ProcessedPreview[] = [];
      for (const file of acceptedFiles) {
        try {
          const result = await processImageFile(file, minTarget, fixMode, forceMin1MB);
          result.fileName = getUniqueFileName(result.fileName);
          processed.push(result);
        } catch (err: any) {
          addToast(err.message || `Gagal memproses ${file.name}`, 'error');
        }
      }

      if (processed.length > 0) {
        setItems(prev => [...processed, ...prev]);
        const resizedCount = processed.filter(p => p.wasResized).length;
        const renameNote =
          renamedCount > 0 ? ` (${renamedCount} duplikat diberi akhiran _1, _2)` : '';
        addToast(
          resizedCount > 0
            ? `${resizedCount} gambar otomatis diperbaiki (${fixMode === 'pad' ? 'Anti-Blur Padding' : 'Upscale + Sharpen'})${renameNote}`
            : `${processed.length} gambar sudah memenuhi syarat ≥ ${minTarget} px${renameNote}`,
          'success'
        );
      }

      setIsProcessing(false);
    },
    [items, minTarget, fixMode, forceMin1MB, addToast]
  );

  const handleTargetChange = async (newTarget: number) => {
    setMinTarget(newTarget);
    await reprocessAll(newTarget, fixMode, forceMin1MB);
    if (items.length > 0) addToast(`Semua gambar diperbarui ke minimal ${newTarget} px`, 'info');
  };

  const handleModeChange = async (newMode: FixMode) => {
    setFixMode(newMode);
    await reprocessAll(minTarget, newMode, forceMin1MB);
    if (items.length > 0) {
      addToast(
        newMode === 'pad'
          ? 'Mode diubah ke Auto-Padding Kanvas (100% Tajam / Anti-Blur)'
          : 'Mode diubah ke Upscale + Auto-Sharpen',
        'info'
      );
    }
  };

  const handleToggleMin1MB = async () => {
    const next = !forceMin1MB;
    setForceMin1MB(next);
    await reprocessAll(minTarget, fixMode, next);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    }
  });

  const handleDownloadSingle = (item: ProcessedPreview) => {
    if (!item.fixedBlob) return;
    const url = URL.createObjectURL(item.fixedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Mengunduh ${item.fileName} (${item.fixedW}×${item.fixedH} px)`, 'success');
  };

  const handleDownloadAllZip = async () => {
    const readyItems = items.filter(i => i.fixedBlob);
    if (readyItems.length === 0 || isExportingZip) return;

    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      for (const item of readyItems) {
        if (item.fixedBlob) {
          zip.file(item.fileName, item.fixedBlob);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `freepik_preview_fixed_${minTarget}px.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast(`${readyItems.length} preview JPG berhasil diunduh dalam ZIP`, 'success');
    } catch {
      addToast('Gagal membuat file ZIP', 'error');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleRemove = (id: string) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Compact Header Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <Ruler className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">
                Auto-Fix Preview Freepik / Magnific
              </h2>
              <p className="text-xs text-slate-500">
                Otomatis perbaiki dimensi minimal {minTarget} px &amp; 300 DPI — bebas error <em>visual defect</em>.
              </p>
            </div>
          </div>

          <select
            value={minTarget}
            onChange={(e) => handleTargetChange(Number(e.target.value))}
            disabled={isProcessing}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shrink-0"
          >
            {TARGET_PRESETS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mode & Options Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeChange('pad')}
              disabled={isProcessing}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                fixMode === 'pad'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="Menambah margin background otomatis tanpa memperbesar piksel asli (100% tajam, anti-blur)"
            >
              Auto-Padding Kanvas (Anti-Blur)
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('upscale')}
              disabled={isProcessing}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                fixMode === 'upscale'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="Memperbesar dimensi secara proporsional + filter penajaman tepi ringan"
            >
              Upscale + Auto-Sharpen
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceMin1MB}
              onChange={handleToggleMin1MB}
              disabled={isProcessing}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold text-slate-600">
              Paksa Min. 1 MB <span className="font-normal text-slate-400">(opsional)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Left-Right Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Left: Compact Upload Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-white/80 backdrop-blur-sm lg:sticky lg:top-6',
            isDragActive
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-white'
          )}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <p className="text-sm font-bold text-slate-800">
            {isProcessing
              ? 'Memperbaiki dimensi...'
              : isDragActive
                ? 'Lepaskan file JPG di sini...'
                : 'Upload / Drag & Drop JPG'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            {fixMode === 'pad'
              ? 'Mode Anti-Blur aktif: menambahkan margin background otomatis tanpa merusak ketajaman piksel asli.'
              : 'Mode Upscale + Sharpen aktif: memperbesar proporsional dengan filter penajaman tepi.'}
          </p>
        </div>

        {/* Right: Siap Download (2-Column Grid) */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm min-h-[220px] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Siap Download ({items.length} file)
            </span>

            {items.length > 0 && (
              <div className="flex items-center gap-2">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllZip}
                    disabled={isExportingZip}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {isExportingZip ? 'Membuat ZIP...' : 'Download Semua (ZIP)'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Hapus semua"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-400">
              <Ruler className="w-8 h-8 mb-2 opacity-25" />
              <p className="text-xs font-semibold text-slate-500">Belum ada gambar yang diupload</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload file JPG di panel kiri untuk otomatis memperbaiki dimensinya.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-2xl border border-slate-200/70 bg-slate-50/50 hover:bg-white flex items-center gap-3 transition-colors"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                      <span className="text-slate-400 line-through">
                        {item.originalW}×{item.originalH}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                        {item.fixedW}×{item.fixedH}
                      </span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200">
                        {item.fixedSizeKB >= 1024
                          ? `${(item.fixedSizeKB / 1024).toFixed(2)} MB`
                          : `${item.fixedSizeKB} KB`}
                      </span>
                      <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                        300 DPI
                      </span>
                      {item.scaleFactor > 2 && (
                        <span
                          className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 inline-flex items-center gap-1"
                          title={`Skala pembesaran ${Math.round(item.scaleFactor * 100)}% (> 200%). Sebaiknya export ulang langsung dari file vektor/EPS asli agar tidak blur.`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          Upscale {item.scaleFactor.toFixed(1)}x
                        </span>
                      )}
                    </div>
                    {item.scaleFactor > 2 && (
                      <p className="text-[10px] text-amber-700 mt-1 leading-tight">
                        Pembesaran &gt; 200% — disarankan pakai mode Auto-Padding atau export ulang dari vektor asli.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(item)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors"
                      title="Download Preview JPG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
