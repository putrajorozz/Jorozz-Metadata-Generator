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
  exportExtension: string;
  setExportExtension: (ext: any) => void;
  isGenerativeAI: boolean;
  setIsGenerativeAI: (val: boolean) => void;
  aiModel: string;
  setAiModel: (val: string) => void;
  downloadCSV: (images?: ImageData[]) => void;
  downloadAdobeStockCSV: (images?: ImageData[]) => void;
  downloadShutterstockCSV: (images?: ImageData[]) => void;
  downloadWithMetadata: (images?: ImageData[]) => void;
  activePlatform: 'Freepik' | 'Adobe Stock' | 'Shutterstock' | 'Dreamstime' | null;
  setActivePlatform: (platform: 'Freepik' | 'Adobe Stock' | 'Shutterstock' | 'Dreamstime' | null) => void;
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
  exportExtension,
  setExportExtension,
  isGenerativeAI,
  setIsGenerativeAI,
  aiModel,
  setAiModel,
  downloadCSV,
  downloadAdobeStockCSV,
  downloadShutterstockCSV,
  downloadWithMetadata,
  activePlatform,
  setActivePlatform
}: AssetGridProps) {
  const completedImages = images.filter(img => img.status === 'completed' && img.metadata);

  // Intelligent Format Recommendation
  const formatRecommendation = (() => {
    if (completedImages.length === 0) return '.png';
    const formats = completedImages.map(img => img.file.type);
    const pngCount = formats.filter(f => f === 'image/png').length;
    const svgCount = formats.filter(f => f === 'image/svg+xml').length;
    const jpgCount = formats.filter(f => f === 'image/jpeg' || f === 'image/jpg').length;
    
    if (viewMode === 'pngtree') return '.png'; 
    if (svgCount > 0) return '.svg';
    if (pngCount > jpgCount) return '.png';
    if (jpgCount > 0) return '.jpg';
    return '.eps'; // Default for vectors/others
  })();

  useEffect(() => {
    setExportExtension(formatRecommendation);
  }, [formatRecommendation, setExportExtension]);

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

      {/* Batch Download Hub - Moved to top for quick access */}
      <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 flex flex-col shadow-sm transition-all relative">
        <div className="p-3 bg-indigo-600/10 border-b border-indigo-100/50 flex items-center justify-between rounded-t-3xl text-indigo-700">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Batch Download Hub</h3>
          </div>
          <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[8px] font-black">
            {completedImages.length} READY
          </span>
        </div>
        
        <div className="p-4">
          {completedImages.length > 0 ? (
            <>
              <div className="relative">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'Freepik', label: 'Freepik', action: downloadCSV, color: 'text-blue-600', bg: 'bg-blue-50', sublabel: 'CSV BATCH' },
                  { id: 'Adobe Stock', label: 'Adobe Stock', action: downloadAdobeStockCSV, color: 'text-red-600', bg: 'bg-red-50', sublabel: 'CSV BATCH' },
                  { id: 'Shutterstock', label: 'Shutterstock', action: downloadShutterstockCSV, color: 'text-amber-600', bg: 'bg-amber-50', sublabel: 'CSV BATCH' },
                  { id: 'Dreamstime', label: 'Dreamstime', action: downloadWithMetadata, color: 'text-emerald-600', bg: 'bg-emerald-50', sublabel: 'IMG METADATA' }
                ].map((p) => {
                  const isActive = activePlatform === p.label;
                  return (
                    <div key={p.id} className="relative">
                      <button
                        onClick={() => {
                          if (p.id === 'Dreamstime') {
                            downloadWithMetadata();
                          } else {
                            if (isActive) setActivePlatform(null);
                            else setActivePlatform(p.label as any);
                          }
                        }}
                        disabled={isGenerating}
                        className={cn(
                          "w-full relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all group",
                          isGenerating 
                            ? "opacity-40 cursor-not-allowed grayscale" 
                            : cn(
                                "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md active:scale-95 shadow-sm",
                                isActive && "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-50 shadow-indigo-100/50"
                              )
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", p.bg)}>
                          {p.id === 'Dreamstime' ? <Sparkles className={cn("w-4 h-4", p.color)} /> : <FileText className={cn("w-4 h-4", p.color)} />}
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black uppercase text-slate-700 leading-none">{p.label.split(' ')[0]}</span>
                          <span className="text-[7px] font-bold text-slate-400 mt-0.5">{p.sublabel}</span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-56 p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-indigo-200/40 z-[100] space-y-3"
                          >
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-3.5 bg-indigo-600 rounded-full" />
                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{p.label}</span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setActivePlatform(null); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              {p.id !== 'Dreamstime' && (
                                <div className="space-y-1.5">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight px-1">Format:</span>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {(['.eps', '.jpg', '.png', '.svg'] as const).map((ext) => {
                                      const isRecommended = formatRecommendation === ext;
                                      return (
                                        <button
                                          key={ext}
                                          onClick={(e) => { e.stopPropagation(); setExportExtension(ext); }}
                                          className={cn(
                                            "relative py-1.5 rounded-lg text-[9px] font-black transition-all border flex items-center justify-center",
                                            exportExtension === ext
                                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                              : cn(
                                                  "bg-white border-slate-200 text-slate-500 hover:bg-slate-50",
                                                  isRecommended && "border-indigo-200 bg-indigo-50"
                                                )
                                          )}
                                        >
                                          {ext}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {p.label === 'Freepik' && (
                                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3 text-indigo-500" />
                                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight">AI Generated</span>
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setIsGenerativeAI(!isGenerativeAI); }}
                                      className={cn(
                                        "w-6 h-3 rounded-full relative transition-colors duration-200 shadow-inner",
                                        isGenerativeAI ? "bg-indigo-600" : "bg-slate-300"
                                      )}
                                    >
                                      <div className={cn(
                                        "absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-200 shadow-sm",
                                        isGenerativeAI ? "translate-x-3" : "translate-x-0"
                                      )} />
                                    </button>
                                  </div>
                                  
                                  {isGenerativeAI && (
                                    <input 
                                      type="text"
                                      value={aiModel}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setAiModel(e.target.value)}
                                      className="w-full px-2.5 py-1 bg-white border border-slate-100 rounded-lg text-[9px] focus:ring-1 focus:ring-indigo-500/20 focus:outline-none placeholder:text-slate-300 shadow-sm"
                                    />
                                  )}
                                </div>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  p.action();
                                  setActivePlatform(null);
                                }}
                                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                              >
                                {p.id === 'Dreamstime' ? (
                                  <>
                                    <Sparkles className="w-3 h-3" /> Download ZIP (Metadata)
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" /> Download CSV
                                  </>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              </div>
              {isGenerating && (
                <p className="text-[9px] text-center text-slate-400 font-medium animate-pulse">
                  Tunggu proses generate selesai untuk mendownload...
                </p>
              )}
            </>
          ) : (
            <div className="py-4 flex flex-col items-center text-center">
              <p className="text-[10px] text-slate-400 font-medium italic">Belum ada hasil generate untuk didownload.</p>
            </div>
          )}
        </div>
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
                "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[.98] shadow-lg",
                isGenerating 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                  : "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200"
              )}
              id="btn-generate-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  PROSES GENERATING...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  MULAI GENERATE METADATA
                </>
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
                <div className="absolute top-1 left-1 p-0.5 flex justify-end pointer-events-none">
                  {img.status === 'completed' && (
                    <div className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <Check className="w-2 h-2 text-white" />
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
