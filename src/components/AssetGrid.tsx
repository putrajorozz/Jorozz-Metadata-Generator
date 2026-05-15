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
  Download 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';

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
  currentTime
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
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        Title Length ({titleLength})
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
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        Keywords Count ({keywordCount})
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
                      <div className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <Check className="w-2 h-2 text-white" />
                      </div>
                      {img.processingTime && (
                        <div className="px-1.5 py-0.5 bg-green-500/90 backdrop-blur-sm text-[6px] text-white font-black rounded-full border border-white/20">
                          {formatProcessingTime(img.processingTime)}
                        </div>
                      )}
                    </div>
                  )}
                  {img.status === 'processing' && (
                    <div className="w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                      <Loader2 className="w-2 h-2 text-white animate-spin" />
                    </div>
                  )}
                  {img.status === 'error' && (
                    <div className="w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <AlertCircle className="w-2 h-2 text-white" />
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
