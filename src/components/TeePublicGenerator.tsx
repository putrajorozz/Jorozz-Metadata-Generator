import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Sparkles, 
  Trash2, 
  Download, 
  Check, 
  Copy, 
  Loader2, 
  AlertCircle, 
  Edit3, 
  CheckCircle2, 
  Plus,
  ArrowRight,
  Info,
  Layers,
  HelpCircle,
  FileText,
  RefreshCw,
  X,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { GoogleGenAI, Type } from "@google/genai";
import { MODELS } from '../constants';

interface TeePublicDesign {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  metadata?: {
    title: string;
    mainTag: string;
    description: string;
    supportingTags: string[];
    matureContent: 'Yes' | 'No';
    modelUsed: string;
  };
  error?: string;
  processingTime?: number;
}

interface TeePublicGeneratorProps {
  apiKeys: string[];
  setShowKeyModal: (show: boolean) => void;
  selectedModel: string;
}

export function TeePublicGenerator({ apiKeys, setShowKeyModal, selectedModel }: TeePublicGeneratorProps) {
  const [designs, setDesigns] = useState<TeePublicDesign[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Local states for notifications
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'err' | 'info' }[]>([]);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    mainTag: string;
    description: string;
    supportingTags: string;
    matureContent: 'Yes' | 'No';
  } | null>(null);

  // Field clipboard feedback state
  const [copiedField, setCopiedField] = useState<{ designId: string; field: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Trigger toast alert
  const addToast = (msg: string, type: 'success' | 'err' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const fileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  // Add design files
  const addFiles = (filesList: File[]) => {
    const validImageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.eps', '.webp', '.tiff', '.ai'];
    const filteredFiles = filesList.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return validImageExtensions.includes(ext) || file.type.startsWith('image/');
    });

    if (filteredFiles.length === 0) {
      addToast('Silakan upload file design gambar yang valid (PNG, JPG, SVG, EPS, dll)', 'err');
      return;
    }

    const newDesigns: TeePublicDesign[] = filteredFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending'
    }));

    setDesigns(prev => [...prev, ...newDesigns]);
    
    // Select the first uploaded design if nothing is selected
    if (!selectedId && newDesigns.length > 0) {
      setSelectedId(newDesigns[0].id);
    }

    addToast(`Berhasil menambahkan ${newDesigns.length} design baru.`, 'success');
  };

  // Remove individual design
  const removeDesign = (id: string) => {
    setDesigns(prev => {
      const target = prev.find(d => d.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter(d => d.id !== id);
    });
    
    if (selectedId === id) {
      setSelectedId(null);
    }
    if (editingId === id) {
      setEditingId(null);
    }
    addToast('Design dihapus dari daftar.', 'info');
  };

  // Clear all designs
  const clearAllDesigns = () => {
    designs.forEach(d => URL.revokeObjectURL(d.preview));
    setDesigns([]);
    setSelectedId(null);
    setEditingId(null);
    addToast('Daftar design berhasil dikosongkan.', 'info');
  };

  // Helper template error parser
  const getErrorMessage = (error: any): string => {
    if (typeof error === 'object' && error !== null) {
      return error.message || JSON.stringify(error);
    }
    return String(error);
  };

  // AI Content Generator for TeePublic
  const generateTeePublicMetadata = async () => {
    if (designs.length === 0 || isGenerating) return;

    if (apiKeys.length === 0) {
      addToast('Silakan masukkan Gemini API Key terlebih dahulu di modal kunci!', 'err');
      setShowKeyModal(true);
      return;
    }

    const pendingDesigns = designs.filter(d => d.status !== 'completed');
    if (pendingDesigns.length === 0) {
      addToast('Semua design di antrean sudah selesai diproses.', 'info');
      return;
    }

    setIsGenerating(true);
    addToast(`Memulai generate metadata untuk ${pendingDesigns.length} design...`, 'info');

    // Use current API key selection with rotation
    let keyIndex = 0;
    
    for (const design of pendingDesigns) {
      setCurrentProcessingId(design.id);
      setSelectedId(design.id);
      
      setDesigns(prev => prev.map(d => 
        d.id === design.id ? { ...d, status: 'processing', error: undefined } : d
      ));

      let success = false;
      let keysTried = 0;
      const totalKeys = apiKeys.length;
      let lastError = 'Gagal memproses generator.';

      // Image to Base64
      let base64Data = '';
      try {
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
          reader.readAsDataURL(design.file);
        });
      } catch (e) {
        setDesigns(prev => prev.map(d => 
          d.id === design.id ? { ...d, status: 'error', error: 'Mengalami error saat membaca file lokalan.' } : d
        ));
        continue;
      }

      while (!success && keysTried < totalKeys) {
        const activeKey = apiKeys[keyIndex % totalKeys];
        const ai = new GoogleGenAI({ apiKey: activeKey });
        
        // Find active model representation or default
        const activeModelId = selectedModel || 'gemini-2.5-flash';
        const modelName = MODELS.find(m => m.id === activeModelId)?.name || 'Gemini 2.5 Flash';

        try {
          const mimeType = design.file.type || 'image/png';
          
          const promptText = `Analyze this design image specifically for TeePublic (a print-on-demand e-commerce platform for t-shirts, hoodies, stickers, mugs, phone cases, notebooks and other customized apparel).
          Generate visually compelling, highly search-optimized, and genuine metadata in JSON format with these exact fields:

          1. title: Clear, high-sales, attractive design title. Do not start with generic words like "A", "An", "The". Make it natural, search-friendly, and describe the character/aesthetic/theme. Keep it under 60 characters.
          2. mainTag: Exactly ONE (1) core tag/search query that represents the absolute main subject or general style of this design. It must be highly searched, lowercase, containing ONLY letters and numbers (no spaces or special characters/punctuation, e.g. "synthwave", "raccoon", "coding", "cats", "vaporwave", "minimalist").
          3. description: A short, simple, and catchment description (1 to 2 sentences max) optimized for prospective retail buyers. Direct, elegant, and stylish. Include the design vibe.
          4. supportingTags: Exactly 10 to 15 unique, highly relevant supporting tags describing the aesthetic, colors, style, themes, art style, humor, or specific items in the design. Put these in an array of clean lowercase strings. Each tag must be standard, alphanumeric, single words or connected-words, lowercase only.
          5. matureContent: Determine if this design contains mature content (such as nudity, heavy graphic violence, strong suggestive sexual adult content, or highly offensive themes). Return "Yes" if it clearly does, otherwise return "No".

          Analyze the artistic details and visual properties with SEO in mind. Make sure values conform to standard JSON schema.`;

          const response = await ai.models.generateContent({
            model: activeModelId,
            contents: {
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: promptText }
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  mainTag: { type: Type.STRING },
                  description: { type: Type.STRING },
                  supportingTags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  matureContent: { type: Type.STRING }
                },
                required: ["title", "mainTag", "description", "supportingTags", "matureContent"]
              }
            }
          });

          const resultText = response.text?.trim() || '{}';
          const result = JSON.parse(resultText);

          // Force clean tags format (clean lowercase alphabetic)
          const cleanMainTag = (result.mainTag || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const cleanSupporting = (result.supportingTags || [])
            .map((t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
            .filter((t: string) => t && t !== cleanMainTag)
            .slice(0, 15);

          const metadata = {
            title: result.title || design.file.name.replace(/\.[^/.]+$/, "").substring(0, 50),
            mainTag: cleanMainTag || 'graphicdesign',
            description: result.description || 'Cool unique graphic design.',
            supportingTags: cleanSupporting.length > 0 ? cleanSupporting : ['art', 'illustration', 'vector', 'cool'],
            matureContent: (result.matureContent === 'Yes' || result.matureContent === 'yes') ? ('Yes' as const) : ('No' as const),
            modelUsed: modelName
          };

          setDesigns(prev => prev.map(d => 
            d.id === design.id ? { 
              ...d, 
              status: 'completed', 
              metadata,
              processingTime: 1 // Completed successfully
            } : d
          ));
          
          success = true;
          addToast(`Selesai memproses: ${design.file.name}`, 'success');

        } catch (error) {
          console.error(`TeePublic Gen Error with Key Index ${keyIndex}:`, error);
          lastError = getErrorMessage(error);
          
          // Switch key and retry
          keyIndex++;
          keysTried++;
        }
      }

      if (!success) {
        setDesigns(prev => prev.map(d => 
          d.id === design.id ? { 
            ...d, 
            status: 'error', 
            error: lastError.includes('quota') || lastError.includes('Rate Limit')
              ? 'API Key mencapai batas limit kuota. Coba tambahkan API Key lainnya.' 
              : lastError 
          } : d
        ));
        addToast(`Gagal memproses ${design.file.name}`, 'err');
      }
    }

    setIsGenerating(false);
    setCurrentProcessingId(null);
    addToast('Seluruh antrean metadata selesai dipotong sirkulasi!', 'success');
  };

  // Download Bulk TeePublic CSV
  const downloadCsv = () => {
    const completedDesigns = designs.filter(d => d.status === 'completed' && d.metadata);
    if (completedDesigns.length === 0) {
      addToast('Belum ada design yang selesai di-generate AI.', 'info');
      return;
    }

    // Standard CSV Builder
    const headers = [
      'Filename',
      'Design Title',
      'Main Tag',
      'Description',
      'Supporting Tags (Comma Separated)',
      'Is Mature Content (Yes/No)',
      'Artistic Source Tool'
    ];

    const rows = completedDesigns.map(d => {
      const meta = d.metadata!;
      const supportingStr = meta.supportingTags.join(', ');
      
      // Escape values wrapping in quotes to bypass comma splitting problems
      return [
        `"${d.file.name.replace(/"/g, '""')}"`,
        `"${meta.title.replace(/"/g, '""')}"`,
        `"${meta.mainTag.replace(/"/g, '""')}"`,
        `"${meta.description.replace(/"/g, '""')}"`,
        `"${supportingStr.replace(/"/g, '""')}"`,
        `"${meta.matureContent}"`,
        `"${meta.modelUsed}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create direct anchor element to trigger prompt download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `teepublic_metadata_bulk_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast(`Berhasil mengunduh CSV berisi ${completedDesigns.length} baris metadata TeePublic!`, 'success');
  };

  // Copy field to clipboard
  const copyToClipboard = (text: string, designId: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField({ designId, field });
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // Copy supporting tags as clean tag format or list
  const copySupportingTags = (tags: string[], designId: string) => {
    copyToClipboard(tags.join(', '), designId, 'supportingTags');
  };

  // Start Inline Editing Form
  const startEditing = (design: TeePublicDesign) => {
    if (!design.metadata) return;
    setEditingId(design.id);
    setEditFormData({
      title: design.metadata.title,
      mainTag: design.metadata.mainTag,
      description: design.metadata.description,
      supportingTags: design.metadata.supportingTags.join(', '),
      matureContent: design.metadata.matureContent
    });
  };

  // Save changes from form
  const saveDesignEdit = (id: string) => {
    if (!editFormData) return;

    // Split and clean supporting tags
    const cleanSupporting = editFormData.supportingTags
      .split(',')
      .map(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);

    const cleanMainTag = editFormData.mainTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    setDesigns(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          metadata: {
            ...d.metadata!,
            title: editFormData.title.trim(),
            mainTag: cleanMainTag,
            description: editFormData.description.trim(),
            supportingTags: cleanSupporting,
            matureContent: editFormData.matureContent
          }
        };
      }
      return d;
    }));

    setEditingId(null);
    setEditFormData(null);
    addToast('Perubahan metadata disimpan dengan sukses.', 'success');
  };

  // Stats calculation
  const totalCount = designs.length;
  const completedCount = designs.filter(d => d.status === 'completed').length;
  const processingCount = designs.filter(d => d.status === 'processing').length;
  const pendingCount = designs.filter(d => d.status === 'pending').length;
  const errorCount = designs.filter(d => d.status === 'error').length;

  const activeSelectedDesign = designs.find(d => d.id === selectedId);

  return (
    <div className="space-y-6">
      
      {/* Toast Alert list */}
      <div className="fixed top-24 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={cn(
                "p-4 rounded-2xl shadow-lg border text-xs font-semibold flex items-center gap-3 backdrop-blur-md pointer-events-auto",
                t.type === 'success' && "bg-white/95 text-emerald-800 border-emerald-200/55",
                t.type === 'err' && "bg-white/95 text-rose-800 border-rose-200/55",
                t.type === 'info' && "bg-white/95 text-indigo-800 border-indigo-200/55"
              )}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {t.type === 'err' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-indigo-500 shrink-0" />}
              <span className="flex-1">{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header section explaining POD features */}
      <div className="bg-gradient-to-br from-indigo-555 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-200/10 relative overflow-hidden bg-slate-900">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 pointer-events-none w-1/3 flex items-center justify-center">
          <Sparkles className="w-48 h-48 text-white animate-pulse" />
        </div>
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/20 rounded-full text-xs font-black uppercase tracking-wider text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            TeePublic POD Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            TeePublic Metadata Generator AI
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
            Unggah design baju, hoodie, stiker, atau merchandise Anda secara massal. Server AI kami akan mendeteksi isi visual gambar secara detail dan merumuskan 5 format metadata TeePublic sejati untuk memaksimalkan komisi penjualan Anda!
          </p>
        </div>

        {/* Requirements quick checklist info */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800 text-[10px] sm:text-xs">
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="block text-slate-500 font-bold uppercase text-[9px] mb-1">1. Give Design Name</span>
            <span className="font-extrabold text-slate-200">Design Title</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="block text-slate-500 font-bold uppercase text-[9px] mb-1">2. Core 1 Search Tag</span>
            <span className="font-extrabold text-slate-200">Main Tag (Unique)</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="block text-slate-500 font-bold uppercase text-[9px] mb-1">3. Buyer Description</span>
            <span className="font-extrabold text-slate-200">Description Sentence</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="block text-slate-500 font-bold uppercase text-[9px] mb-1">4. Supporting tags</span>
            <span className="font-extrabold text-slate-200">Secondary (10-15 Tags)</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30 col-span-2 md:col-span-1">
            <span className="block text-slate-500 font-bold uppercase text-[9px] mb-1">5. Adult Material</span>
            <span className="font-extrabold text-slate-200">Mature Content (Yes/No)</span>
          </div>
        </div>
      </div>

      {/* Main Drag/Upload Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "bg-white rounded-3xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden",
          isDragging 
            ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]" 
            : "border-slate-250 hover:border-indigo-400 hover:bg-slate-50/40"
        )}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={fileSelected}
          multiple
          className="hidden" 
          accept="image/*,.eps,.ai,.svg"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-700">
              Drag & Drop file design Anda di sini
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Mendukung upload beberapa file sekaligus (PNG, JPG, SVG, EPS, AI). <br />
              Ukuran ideal desain kaos sebaiknya memiliki resolusi tinggi dengan latar transparan.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-xl text-indigo-700 text-xs font-black uppercase">
            <Plus className="w-3.5 h-3.5" />
            Pilih File Gambar
          </div>
        </div>
      </div>

      {designs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel index list: Designs Queue */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[700px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Antrean Design</h3>
                <p className="text-[11px] text-slate-400 font-bold">{designs.length} Berkas design terunggah</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={clearAllDesigns}
                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100/80 rounded-xl border border-rose-100 text-[10px] font-bold flex items-center gap-1 transition-colors"
                  title="Clear Semua"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Semua
                </button>
              </div>
            </div>

            {/* Queue statistics boxes */}
            <div className="grid grid-cols-4 border-b border-slate-100 divide-x divide-slate-100 text-center text-[10px] bg-slate-50/10">
              <div className="p-2">
                <span className="block text-slate-400 font-bold">Total</span>
                <span className="font-extrabold text-slate-700 text-xs">{totalCount}</span>
              </div>
              <div className="p-2">
                <span className="block text-emerald-500 font-bold">Gen</span>
                <span className="font-extrabold text-emerald-600 text-xs">{completedCount}</span>
              </div>
              <div className="p-2">
                <span className="block text-amber-500 font-bold">Antre</span>
                <span className="font-extrabold text-amber-600 text-xs">{pendingCount + processingCount}</span>
              </div>
              <div className="p-2">
                <span className="block text-rose-500 font-bold">Gagal</span>
                <span className="font-extrabold text-rose-600 text-xs">{errorCount}</span>
              </div>
            </div>

            {/* Render queue items */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 p-2 space-y-1">
              {designs.map((design, index) => {
                const isSelected = selectedId === design.id;
                const isItemProcessing = currentProcessingId === design.id;

                return (
                  <div
                    key={design.id}
                    onClick={() => {
                      setSelectedId(design.id);
                      if (editingId !== design.id) {
                        setEditingId(null);
                        setEditFormData(null);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all duration-200 group relative border",
                      isSelected 
                        ? "bg-indigo-50/80 text-indigo-900 border-indigo-200 shadow-sm" 
                        : "bg-transparent text-slate-600 border-transparent hover:bg-slate-50/50"
                    )}
                  >
                    {/* Index number counter */}
                    <span className="font-mono text-[10px] text-slate-400 font-black bg-slate-100 px-1 w-5 text-center rounded">
                      {index + 1}
                    </span>

                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner">
                      <img 
                        src={design.preview} 
                        alt="Design Thumbnail" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-xs text-slate-700 truncate" title={design.file.name}>
                        {design.file.name}
                      </p>
                      
                      <div className="flex items-center gap-1.5">
                        {design.status === 'completed' && design.metadata && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-black">
                            {design.metadata.mainTag}
                          </span>
                        )}
                        {design.status === 'processing' && (
                          <span className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            AI Sedang menganalisis...
                          </span>
                        )}
                        {design.status === 'error' && (
                          <span className="text-[9px] text-rose-600 font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Gagal generate
                          </span>
                        )}
                        {design.status === 'pending' && (
                          <span className="text-[9px] text-slate-400 font-bold">
                            Belum diproses
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDesign(design.id);
                      }}
                      className="p-1 bg-slate-150/20 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg hover:border-rose-100 border border-transparent transition-all opacity-0 group-hover:opacity-100"
                      title="Hapus gambar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom bulk trigger panel */}
            <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/80">
              <button
                disabled={isGenerating || pendingCount + errorCount === 0}
                onClick={generateTeePublicMetadata}
                className={cn(
                  "w-full py-2.5 px-4 rounded-xl text-xs font-black tracking-wide uppercase flex items-center justify-center gap-2 transition-all border",
                  isGenerating || pendingCount + errorCount === 0
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 hover:scale-[1.01] shadow-lg shadow-indigo-200"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Memproses AI AI_{designs.length - completedCount}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Metadata AI ({pendingCount + errorCount})
                  </>
                )}
              </button>

              <button
                disabled={completedCount === 0}
                onClick={downloadCsv}
                className={cn(
                  "w-full py-2 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all border",
                  completedCount === 0
                    ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-200 hover:scale-[1.01]"
                )}
              >
                <Download className="w-4 h-4 text-emerald-600" />
                Download CSV TeePublic ({completedCount})
              </button>
            </div>
          </div>

          {/* Right panel index list: Design Visual Review & Editing Details */}
          <div className="lg:col-span-8 space-y-6">
            {activeSelectedDesign ? (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[450px]">
                
                {/* Large Preview section */}
                <div className="md:w-[280px] shrink-0 bg-slate-900 border-r border-slate-100 p-6 flex flex-col justify-between items-center text-center gap-4 relative">
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-black rounded-lg uppercase">
                    Preview Desain
                  </div>

                  <div className="flex-1 w-full flex items-center justify-center p-4">
                    <img
                      src={activeSelectedDesign.preview}
                      alt="Large Display Design preview"
                      className="max-h-[220px] max-w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="w-full space-y-1 pt-4 border-t border-slate-800 text-left">
                    <p className="text-[11px] font-bold text-slate-500 truncate" title={activeSelectedDesign.file.name}>
                      {activeSelectedDesign.file.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Ukuran: {Math.round(activeSelectedDesign.file.size / 1024)} KB
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Format: {activeSelectedDesign.file.type || 'RAW/IMAGE'}
                    </p>
                  </div>
                </div>

                {/* Right Interactive Data block */}
                <div className="flex-1 p-6 flex flex-col justify-between space-y-6 bg-white">
                  
                  {/* Headline & status check */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-800">
                        Hasil Metadata TeePublic
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Review, ubah kata kunci, and copy langsung ke formulir TeePublic.</p>
                    </div>

                    <div className="shrink-0">
                      {activeSelectedDesign.status === 'completed' && activeSelectedDesign.metadata && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-black uppercase tracking-wider">
                          <Check className="w-3.5 h-3.5" />
                          Sukses
                        </span>
                      )}
                      {activeSelectedDesign.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Memproses AI
                        </span>
                      )}
                      {activeSelectedDesign.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full text-xs font-bold uppercase tracking-wider">
                          Menunggu
                        </span>
                      )}
                      {activeSelectedDesign.status === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-xs font-extrabold uppercase tracking-wider">
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main display based on status */}
                  <div className="flex-1">
                    {activeSelectedDesign.status === 'completed' && activeSelectedDesign.metadata ? (
                      editingId === activeSelectedDesign.id && editFormData ? (
                        /* EDIT MODE FORM */
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 block uppercase tracking-wide">
                              1. Design Title <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editFormData.title}
                              onChange={e => setEditFormData(prev => prev ? { ...prev, title: e.target.value } : null)}
                              className="w-full text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-slate-800 font-extrabold focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
                              placeholder="Masukkan judul menarik..."
                              maxLength={60}
                            />
                            <p className="text-[10px] text-slate-400 font-bold">Panjang judul idealnya di bawah 60 karakter agar optimal di desktop & mobile.</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 block uppercase tracking-wide">
                              2. Main Tag <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editFormData.mainTag}
                              onChange={e => setEditFormData(prev => prev ? { ...prev, mainTag: e.target.value } : null)}
                              className="w-full text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-slate-800 font-black focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
                              placeholder="Satu tag utama unik (misal: synthwave)"
                            />
                            <p className="text-[10px] text-zinc-400 font-semibold">TeePublic mengharuskan persis 1 tag utama utama untuk mengklasifikasikan produk.</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 block uppercase tracking-wide">
                              3. Description <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={2}
                              value={editFormData.description}
                              onChange={e => setEditFormData(prev => prev ? { ...prev, description: e.target.value } : null)}
                              className="w-full text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-slate-800 font-semibold focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-0 leading-relaxed transition-colors"
                              placeholder="Ketikkan deskripsi singkat untuk menggaet pembeli..."
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 block uppercase tracking-wide">
                              4. Supporting Tags <span className="text-slate-400">(Pisahkan dengan koma)</span>
                            </label>
                            <textarea
                              rows={2}
                              value={editFormData.supportingTags}
                              onChange={e => setEditFormData(prev => prev ? { ...prev, supportingTags: e.target.value } : null)}
                              className="w-full text-xs bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-slate-850 font-medium focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors leading-relaxed"
                              placeholder="art, illustration, vector, sunset, gaming, retro, dll"
                            />
                            <p className="text-[10px] text-slate-400 font-bold">Tambahkan hingga 15 tags pendukung lainnya untuk meningkatkan keterpaparan pencarian pembeli.</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 block uppercase tracking-wide">
                              5. Does this contain Mature Content?
                            </label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name="matureContent"
                                  checked={editFormData.matureContent === 'Yes'}
                                  onChange={() => setEditFormData(prev => prev ? { ...prev, matureContent: 'Yes' } : null)}
                                  className="text-indigo-600 focus:ring-transparent"
                                />
                                Yes (Adult Content)
                              </label>
                              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name="matureContent"
                                  checked={editFormData.matureContent === 'No'}
                                  onChange={() => setEditFormData(prev => prev ? { ...prev, matureContent: 'No' } : null)}
                                  className="text-indigo-600 focus:ring-transparent"
                                />
                                No (Safe Content)
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => saveDesignEdit(activeSelectedDesign.id)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition-colors"
                            >
                              Simpan Perubahan
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditFormData(null);
                              }}
                              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* DISPLAY / COPY MODE */
                        <div className="space-y-5">
                          
                          {/* 1. Title Row */}
                          <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50 transition-colors group/item">
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                1. Design Title
                              </span>
                              <p className="text-sm font-black text-slate-800 leading-tight">
                                {activeSelectedDesign.metadata.title}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => copyToClipboard(activeSelectedDesign.metadata!.title, activeSelectedDesign.id, 'title')}
                              className="p-2 bg-white rounded-xl border border-slate-200/60 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 shadow-sm transition-colors justify-end mt-1"
                              title="Salin Judul"
                            >
                              {copiedField?.designId === activeSelectedDesign.id && copiedField?.field === 'title' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* 2. Main Tag Row */}
                          <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50 transition-colors group/item">
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                2. Main Tag <span className="text-[9px] text-slate-400 font-bold lowercase italic">(exactly 1 tag)</span>
                              </span>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 font-black">
                                {activeSelectedDesign.metadata.mainTag}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => copyToClipboard(activeSelectedDesign.metadata!.mainTag, activeSelectedDesign.id, 'mainTag')}
                              className="p-2 bg-white rounded-xl border border-slate-200/60 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 shadow-sm transition-colors justify-end mt-1"
                              title="Salin Main Tag"
                            >
                              {copiedField?.designId === activeSelectedDesign.id && copiedField?.field === 'mainTag' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* 3. Description Row */}
                          <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50 transition-colors group/item">
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                3. Description <span className="text-[9px] text-slate-400 font-bold lowercase italic">(1-2 sentences)</span>
                              </span>
                              <p className="text-xs font-semibold text-slate-650 leading-relaxed">
                                {activeSelectedDesign.metadata.description}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => copyToClipboard(activeSelectedDesign.metadata!.description, activeSelectedDesign.id, 'description')}
                              className="p-2 bg-white rounded-xl border border-slate-200/60 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 shadow-sm transition-colors justify-end mt-1"
                              title="Salin Deskripsi"
                            >
                              {copiedField?.designId === activeSelectedDesign.id && copiedField?.field === 'description' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* 4. Supporting Tags Row */}
                          <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50 transition-colors group/item">
                            <div className="flex-1 min-w-0 space-y-1.5 animate-fadeIn">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                4. Supporting Tags <span className="text-[9px] text-slate-400 font-bold">({activeSelectedDesign.metadata.supportingTags.length} Tags Terpilih)</span>
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeSelectedDesign.metadata.supportingTags.map((tag, tagIdx) => (
                                  <span key={tagIdx} className="text-[10px] font-semibold bg-slate-200/60 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => copySupportingTags(activeSelectedDesign.metadata!.supportingTags, activeSelectedDesign.id)}
                              className="p-2 bg-white rounded-xl border border-slate-200/60 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 shadow-sm transition-colors justify-end mt-1"
                              title="Salin Semua Tag"
                            >
                              {copiedField?.designId === activeSelectedDesign.id && copiedField?.field === 'supportingTags' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* 5. Mature Content Row */}
                          <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50 transition-colors group/item">
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                5. Mature Content?
                              </span>
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                                activeSelectedDesign.metadata.matureContent === 'Yes'
                                  ? "bg-rose-50 text-rose-700 border-rose-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
                              )}>
                                {activeSelectedDesign.metadata.matureContent === 'Yes' ? 'YES (Mature Themes Detected)' : 'NO (SFW / Safe)'}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => copyToClipboard(activeSelectedDesign.metadata!.matureContent, activeSelectedDesign.id, 'matureContent')}
                              className="p-2 bg-white rounded-xl border border-slate-200/60 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 shadow-sm transition-colors justify-end mt-1"
                              title="Salin Status Mature"
                            >
                              {copiedField?.designId === activeSelectedDesign.id && copiedField?.field === 'matureContent' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                        </div>
                      )
                    ) : (
                      /* PENDING / EMPTY STATE */
                      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                        <div className="p-3.5 bg-indigo-50 rounded-full text-indigo-500">
                          <HelpCircle className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-700">Metadata Belum Di-generate</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto font-semibold">
                            Klik tombol "Generate Metadata AI" di panel kiri sebelah antrean untuk menyuruh AI Gemini mendeskripsikan and merumuskan pola tags.
                          </p>
                        </div>
                        
                        {activeSelectedDesign.status === 'error' && (
                          <div className="bg-rose-50 text-rose-800 text-xs font-semibold p-3.5 rounded-2xl border border-rose-100 max-w-sm">
                            <span className="font-black text-[13px] block mb-0.5 text-rose-900">Deskripsi Error:</span>
                            {activeSelectedDesign.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions footer for the active item */}
                  {activeSelectedDesign.status === 'completed' && activeSelectedDesign.metadata && editingId !== activeSelectedDesign.id && (
                    <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Model: <span className="font-extrabold text-slate-500">{activeSelectedDesign.metadata.modelUsed}</span>
                      </div>

                      <button
                        onClick={() => startEditing(activeSelectedDesign)}
                        className="py-1.5 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200/80 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-slate-200/45"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        Edit Metadata
                      </button>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              /* WHOLE RIGHT EMPTY STATE */
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[450px]">
                <div className="p-4 bg-indigo-50 rounded-3xl text-indigo-500">
                  <Layers className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-850">
                    Tidak ada desain terpilih
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mt-1 font-semibold">
                    Silakan upload file design Anda di dropzone lalu pilih list antrean untuk me-review and mengedit metadatanya.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
