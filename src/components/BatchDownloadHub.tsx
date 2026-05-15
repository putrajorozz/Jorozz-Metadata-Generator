import { 
  Download, 
  FileText, 
  X, 
  Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';

interface BatchDownloadHubProps {
  images: ImageData[];
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
  viewMode: 'standard' | 'pngtree';
}

export function BatchDownloadHub({
  images,
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
  setActivePlatform,
  viewMode
}: BatchDownloadHubProps) {
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
            <div className="grid grid-cols-4 gap-2">
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
                      
                      <div className="flex flex-col items-center overflow-hidden">
                        <span className="text-[9px] font-black uppercase text-slate-700 leading-none truncate w-full text-center">{p.label.split(' ')[0]}</span>
                        <span className="text-[7px] font-bold text-slate-400 mt-0.5 truncate w-full text-center">{p.sublabel}</span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-64 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-indigo-500/10 z-[999] space-y-4"
                        >
                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45" />
                          <div className="flex items-center justify-between px-1 relative z-10">
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
                              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:bg-indigo-500 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
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
              <p className="text-[9px] text-center text-slate-400 font-medium animate-pulse mt-3">
                Tunggu proses generate selesai untuk mendownload...
              </p>
            )}
          </>
        ) : (
          <div className="py-2 flex flex-col items-center text-center">
            <p className="text-[10px] text-slate-400 font-medium italic">Belum ada hasil generate untuk didownload.</p>
          </div>
        )}
      </div>
    </div>
  );
}
