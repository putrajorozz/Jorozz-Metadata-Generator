import { 
  Upload, 
  FileText, 
  X, 
  Check, 
  Loader2, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Sparkles,
  Download,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';
import { MODELS, GROQ_MODELS } from '../constants';

interface AssetGridProps {
  images: ImageData[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setImages: (images: ImageData[] | ((prev: ImageData[]) => ImageData[])) => void;
  isDragActive: boolean;
  viewMode: 'standard' | 'pngtree';
  open: () => void;
  showSettingsPanel: boolean;
  setShowSettingsPanel: (show: boolean) => void;
  titleLength: number;
  setTitleLength: (val: number) => void;
  keywordCount: number;
  setKeywordCount: (val: number) => void;
  generateMetadata: () => void;
  isGenerating: boolean;
  startTime: number | null;
  currentTime: number | null;
  lastGenerationDuration: number | null;
  aiEngine: 'gemini' | 'groq';
  setAiEngine: (engine: 'gemini' | 'groq') => void;
  groqKeys: string[];
  selectedGroqModel: string;
  setSelectedGroqModel: (model: string) => void;
  apiKeys: string[];
  setShowKeyModal: (show: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  autoRotateModel: boolean;
  toggleAutoRotateModel: () => void;
  autoRotateGroqModel: boolean;
  toggleAutoRotateGroqModel: () => void;
}

export function AssetGrid({
  images,
  selectedId,
  setSelectedId,
  setImages,
  isDragActive,
  viewMode,
  open,
  showSettingsPanel,
  setShowSettingsPanel,
  titleLength,
  setTitleLength,
  keywordCount,
  setKeywordCount,
  generateMetadata,
  isGenerating,
  startTime,
  currentTime,
  lastGenerationDuration,
  aiEngine,
  setAiEngine,
  groqKeys,
  selectedGroqModel,
  setSelectedGroqModel,
  apiKeys,
  setShowKeyModal,
  selectedModel,
  setSelectedModel,
  autoRotateModel,
  toggleAutoRotateModel,
  autoRotateGroqModel,
  toggleAutoRotateGroqModel
}: AssetGridProps) {
  const formatTimer = (start: number | null, current: number | null) => {
    if (!start || !current) return '00:00.00';
    const diff = current - start;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const ms = Math.floor((diff % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const formatProcessingTime = (ms?: number) => {
    if (!ms) return '';
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Persistent Upload Area */}
      <div 
        onClick={open}
        className={cn(
          "p-6 border-2 border-dashed rounded-3xl transition-all cursor-pointer group flex flex-col items-center justify-center text-center",
          isDragActive 
            ? "border-indigo-400 bg-indigo-50/50" 
            : "border-slate-200 bg-white/40 hover:bg-white/60 hover:border-slate-300"
        )}
        id="dashboard-upload-area"
      >
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <Upload className="w-5 h-5 text-indigo-500" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Tambahkan Gambar</h4>
        <p className="text-[10px] text-slate-500 mt-0.5">Seret atau klik untuk upload</p>
      </div>


      {/* Metadata Configuration & Generate Button */}
      {images.length > 0 && (
        <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="space-y-4">
              <button 
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
              >
                Metadata Settings
                {showSettingsPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showSettingsPanel && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6 p-4 bg-white/50 rounded-2xl border border-white/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        Title Length ({titleLength})
                        <div className="relative group inline-block">
                          <Info className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                            Mengatur target panjang judul metadata (30 - 200 karakter).
                          </div>
                        </div>
                      </label>
                      <button onClick={() => setTitleLength(100)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold px-2 py-0.5 rounded-full hover:bg-indigo-50">Reset</button>
                    </div>
                    <input 
                      type="range"
                      min="30"
                      max="200"
                      value={titleLength}
                      onChange={(e) => setTitleLength(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                      <span>Min (30)</span>
                      <span>Max (200)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        Keywords Count ({keywordCount})
                        <div className="relative group inline-block">
                          <Info className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                            Jumlah kata kunci/tags yang dihasilkan (5 - 50 kata).
                          </div>
                        </div>
                      </label>
                      <button onClick={() => setKeywordCount(50)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold px-2 py-0.5 rounded-full hover:bg-indigo-50">Reset</button>
                    </div>
                    <input 
                      type="range"
                      min="5"
                      max="50"
                      value={keywordCount}
                      onChange={(e) => setKeywordCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                      <span>Min (5)</span>
                      <span>Max (50)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Engine & Model Selector */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 shadow-sm space-y-2.5 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  Engine AI / Model
                  <div className="relative group inline-block">
                    <Info className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none lowercase first-letter:uppercase">
                      Google Gemini untuk deskripsi detail, Groq Llama untuk waktu pemrosesan kilat.
                    </div>
                  </div>
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">Pilihan model generate</span>
              </div>
              
              <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
                <button
                  type="button"
                  onClick={() => setAiEngine('gemini')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200",
                    aiEngine === 'gemini'
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200/10"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setAiEngine('groq')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200",
                    aiEngine === 'groq'
                      ? "bg-white text-pink-600 shadow-sm border border-slate-200/10"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Groq (Llama)
                </button>
              </div>

              {aiEngine === 'gemini' ? (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-bold">Pilih Model Utama:</span>
                    <div className="relative group inline-block">
                      <Info className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                        sistem akan memulai dari model utama ini untuk memproses gambar Anda.
                      </div>
                    </div>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 font-medium"
                  >
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] text-slate-400 font-bold">
                      {apiKeys.length} Gemini Key Aktif
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(true)}
                      className="text-[9px] text-indigo-600 hover:text-indigo-700 font-black uppercase tracking-wider underline underline-offset-2"
                    >
                      Kelola Key
                    </button>
                  </div>

                  {/* Auto Rotate Toggle Switch */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 border border-indigo-150 relative overflow-visible mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-700">Auto Rotate Model</span>
                      <div className="relative group inline-block">
                        <Info className="w-3.5 h-3.5 text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                          Saat aktif, sistem otomatis beralih model Gemini lain jika model utama mengalami limit kuota/rate limit.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAutoRotateModel}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1",
                        autoRotateModel 
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", autoRotateModel ? "bg-green-400 animate-pulse" : "bg-slate-400")} />
                      {autoRotateModel ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
               ) : (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-bold">Pilih Model Groq:</span>
                    <div className="relative group inline-block">
                      <Info className="w-3 h-3 text-slate-400 hover:text-pink-500 transition-colors cursor-pointer" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                        Varian model open-source Llama yang dijalankan menggunakan super-infra Groq.
                      </div>
                    </div>
                  </div>
                  <select
                    value={selectedGroqModel}
                    onChange={(e) => setSelectedGroqModel(e.target.value)}
                    className="w-full text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500/30 font-medium"
                  >
                    <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout (17B)</option>
                    <option value="meta-llama/llama-4-maverick">Llama 4 Maverick</option>
                  </select>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] text-slate-400 font-bold">
                      {groqKeys.length} Groq Key Aktif
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(true)}
                      className="text-[9px] text-pink-600 hover:text-pink-700 font-black uppercase tracking-wider underline underline-offset-2"
                    >
                      Kelola Key
                    </button>
                  </div>

                  {/* Auto Rotate Toggle Switch for Groq */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-pink-50/50 border border-pink-150 relative overflow-visible mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-700">Auto Rotate Model</span>
                      <div className="relative group inline-block">
                        <Info className="w-3.5 h-3.5 text-pink-500 hover:text-pink-700 transition-colors cursor-pointer" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-slate-900 text-white text-[9px] font-normal p-2 rounded-lg leading-normal shadow-md z-50 pointer-events-none">
                          Saat aktif, sistem otomatis beralih model Groq lain jika model utama mengalami limit kuota/rate limit.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAutoRotateGroqModel}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1",
                        autoRotateGroqModel 
                          ? "bg-pink-600 text-white shadow-sm" 
                          : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", autoRotateGroqModel ? "bg-green-400 animate-pulse" : "bg-slate-400")} />
                      {autoRotateGroqModel ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={generateMetadata}
              disabled={isGenerating || images.length === 0}
              className={cn(
                "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[.98] shadow-lg relative overflow-hidden",
                isGenerating 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                  : "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200"
              )}
              id="btn-generate-all"
            >
              <div className="flex items-center gap-3 relative z-10">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>GENERATING {formatTimer(startTime, currentTime)}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>MULAI GENERATE METADATA</span>
                  </>
                )}
              </div>
              {isGenerating && (
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ 
                    duration: images.filter(i => i.status !== 'completed').length * 5, 
                    ease: "linear" 
                  }}
                  className="absolute inset-0 bg-indigo-200/20"
                />
              )}
            </button>
            
            {!isGenerating && lastGenerationDuration && images.some(img => img.status === 'completed') && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 py-2 px-4 rounded-xl border border-green-100 shadow-sm"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                PROSES SELESAI DALAM {formatProcessingTime(lastGenerationDuration)}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Grid Image Gallery */}
      {images.length > 0 && (
        <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Daftar Gambar ({images.length})</h3>
            <div className="h-px flex-1 mx-4 bg-slate-100" />
          </div>
          
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {images.map((img) => (
              <div
                key={img.id}
                id={`image-item-${img.id}`}
                className={cn(
                  "group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer shadow-sm",
                  selectedId === img.id ? "border-indigo-500 ring-4 ring-indigo-50 scale-105 z-10" : "border-white bg-white/50 hover:border-indigo-200"
                )}
                onClick={() => setSelectedId(img.id)}
              >
                {img.file.type.startsWith('image/') ? (
                  <div className={cn(
                    "w-full h-full relative",
                    (viewMode === 'pngtree' || img.file.type === 'image/png') && "bg-transparency-pattern"
                  )}>
                    <img src={img.preview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                
                {/* Trash/Delete Button POJOK KANAN BAWAH */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImages(prev => prev.filter(i => i.id !== img.id));
                    if (selectedId === img.id) setSelectedId(null);
                  }}
                  className="absolute bottom-1 right-1 p-1 bg-red-500/90 rounded-lg shadow-sm text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Status Overlay */}
                <div className="absolute top-1 left-1 p-0.5 flex flex-col items-start gap-1 pointer-events-none">
                  {img.status === 'completed' && (
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      {img.processingTime && (
                        <div className="px-1.5 py-0.5 bg-green-500/90 backdrop-blur-sm text-[6px] text-white font-black rounded-full border border-white/20">
                          {formatProcessingTime(img.processingTime)}
                        </div>
                      )}
                    </div>
                  )}
                  {img.status === 'processing' && (
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    </div>
                  )}
                  {img.status === 'error' && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <AlertCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Hover effect */}
                <div className={cn(
                  "absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                  selectedId === img.id && "opacity-100"
                )} />
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
