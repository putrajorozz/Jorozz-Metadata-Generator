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
  previewUrl: string;
  fixedBlob: Blob | null;
  fixedSizeKB: number;
  status: 'processing' | 'ready' | 'error';
}

const MAX_FREEPIK_SIDE = 10000;
const MIN_SAFE_JPEG_BYTES = 1024 * 1024; // 1 MB minimum safe preview size
const TARGET_PRESETS = [
  { value: 2000, label: 'Min. 2000 px (Standar Freepik)' },
  { value: 2050, label: 'Min. 2050 px (Aman +50px)' },
  { value: 2500, label: 'Min. 2500 px' },
  { value: 3000, label: 'Min. 3000 px' }
];

/**
 * Sets JFIF APP0 density to 300 DPI and ensures the JPEG Blob meets the minimum
 * byte size (default 1 MB) using spec-compliant JPEG COM (0xFF 0xFE) segments.
 * Zero visual quality loss and 100% valid JPEG structure.
 */
async function finalizeFreepikJpeg(
  blob: Blob,
  minBytes: number = MIN_SAFE_JPEG_BYTES,
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

  // Check if JFIF APP0 segment exists right after SOI
  const hasJfif =
    buffer.length >= 18 &&
    buffer[2] === 0xff &&
    buffer[3] === 0xe0 &&
    buffer[6] === 0x4a && // 'J'
    buffer[7] === 0x46 && // 'F'
    buffer[8] === 0x49 && // 'I'
    buffer[9] === 0x46 && // 'F'
    buffer[10] === 0x00;

  if (hasJfif) {
    buffer[13] = 0x01; // units: dots per inch (DPI)
    buffer[14] = dpiHi;
    buffer[15] = dpiLo;
    buffer[16] = dpiHi;
    buffer[17] = dpiLo;
  } else {
    // Insert a standard 18-byte JFIF APP0 header with 300 DPI right after SOI
    const jfifSegment = new Uint8Array([
      0xff, 0xe0, // APP0 marker
      0x00, 0x10, // length = 16
      0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x01, // version 1.1
      0x01, // units = DPI
      dpiHi, dpiLo, // Xdensity = 300
      dpiHi, dpiLo, // Ydensity = 300
      0x00, 0x00 // no thumbnail
    ]);
    const combined = new Uint8Array(buffer.length + jfifSegment.length);
    combined.set(buffer.subarray(0, 2), 0);
    combined.set(jfifSegment, 2);
    combined.set(buffer.subarray(2), 2 + jfifSegment.length);
    buffer = combined;
  }

  if (buffer.length >= minBytes) {
    return new Blob([buffer], { type: 'image/jpeg' });
  }

  const targetBytes = minBytes + 16 * 1024; // slight buffer above 1 MB (~1.02 MB)
  let remaining = targetBytes - buffer.length;
  const maxChunkPayload = 60000; // safely below 65533 max COM segment payload
  const segments: Uint8Array[] = [];

  while (remaining > 0) {
    const payloadLen = Math.min(remaining, maxChunkPayload);
    const segmentLen = payloadLen + 2; // includes the 2 length bytes
    const segment = new Uint8Array(2 + segmentLen);
    segment[0] = 0xff;
    segment[1] = 0xfe; // COM marker
    segment[2] = (segmentLen >> 8) & 0xff;
    segment[3] = segmentLen & 0xff;
    segment.fill(0x20, 4); // spaces
    segments.push(segment);
    remaining -= segment.length;
  }

  const head = buffer.subarray(0, buffer.length - 2);
  const eoi = buffer.subarray(buffer.length - 2);
  return new Blob([head, ...segments, eoi], { type: 'image/jpeg' });
}

function computeTargetDimensions(width: number, height: number, minSide: number) {
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

  const scale = minSide / minDim;
  const fixedW = safeW <= safeH ? minSide : Math.ceil(safeW * scale);
  const fixedH = safeH < safeW ? minSide : Math.ceil(safeH * scale);
  return { fixedW, fixedH, wasResized: true };
}

function processImageFile(file: File, minSide: number): Promise<ProcessedPreview> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);

    img.onload = () => {
      const originalW = img.naturalWidth;
      const originalH = img.naturalHeight;
      const { fixedW, fixedH, wasResized } = computeTargetDimensions(originalW, originalH, minSide);

      const canvas = document.createElement('canvas');
      canvas.width = fixedW;
      canvas.height = fixedH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(srcUrl);
        reject(new Error('Canvas tidak tersedia'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, fixedW, fixedH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, fixedW, fixedH);

      // Create lightweight thumbnail (max 120px) for UI grid to keep RAM low on large batches
      const thumbMax = 120;
      const thumbScale = Math.min(1, thumbMax / Math.max(originalW, originalH));
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = Math.max(1, Math.round(originalW * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(originalH * thumbScale));
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }

      canvas.toBlob(
        async (rawBlob) => {
          URL.revokeObjectURL(srcUrl);
          if (!rawBlob) {
            reject(new Error(`Gagal memproses ${file.name}`));
            return;
          }
          const finalBlob = await finalizeFreepikJpeg(rawBlob, MIN_SAFE_JPEG_BYTES, 300);

          const thumbBlob = await new Promise<Blob | null>((res) =>
            thumbCanvas.toBlob((b) => res(b), 'image/jpeg', 0.7)
          );
          const previewUrl = URL.createObjectURL(thumbBlob || finalBlob);

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const scaleFactor = Math.max(fixedW / originalW, fixedH / originalH);
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
  const [items, setItems] = useState<ProcessedPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

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
          const result = await processImageFile(file, minTarget);
          result.fileName = getUniqueFileName(result.fileName);
          processed.push(result);
        } catch (err: any) {
          addToast(err.message || `Gagal memproses ${file.name}`, 'error');
        }
      }

      if (processed.length > 0) {
        setItems(prev => [...processed, ...prev]);
        const resizedCount = processed.filter(p => p.wasResized).length;
        const renameNote = renamedCount > 0 ? ` (${renamedCount} nama duplikat otomatis diberi akhiran _1, _2)` : '';
        addToast(
          resizedCount > 0
            ? `${resizedCount} gambar otomatis diperbaiki ke minimal ${minTarget} px${renameNote}`
            : `${processed.length} gambar sudah memenuhi syarat ≥ ${minTarget} px${renameNote}`,
          'success'
        );
      }

      setIsProcessing(false);
    },
    [items, minTarget, addToast]
  );

  const handleTargetChange = async (newTarget: number) => {
    setMinTarget(newTarget);
    if (items.length === 0) return;

    setIsProcessing(true);
    const reprocessed: ProcessedPreview[] = [];
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      try {
        const res = await processImageFile(item.file, newTarget);
        reprocessed.push(res);
      } catch {
        // skip failed item
      }
    }
    setItems(reprocessed);
    setIsProcessing(false);
    addToast(`Semua gambar diperbarui ke minimal ${newTarget} px`, 'info');
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
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800">
              Auto-Fix Preview Freepik / Magnific
            </h2>
            <p className="text-xs text-slate-500">
              Upload file JPG — dimensi otomatis diperbaiki ke minimal {minTarget} px per sisi, 300 DPI & ukuran file minimal 1 MB.
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
            Bisa upload 1 atau banyak file sekaligus. Otomatis diperbaiki & siap diunduh di panel kanan.
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
                        Pembesaran &gt; 200% — disarankan export ulang dari file vektor/EPS asli.
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
