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
import { useEffect } from 'react';
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
  downloadCSV: (images?: ImageData[]) => void;
  downloadAdobeStockCSV: (images?: ImageData[]) => void;
  downloadShutterstockCSV: (images?: ImageData[]) => void;
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
  downloadCSV,
  downloadAdobeStockCSV,
  downloadShutterstockCSV
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
      <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        <div className="p-3 bg-indigo-600/10 border-b border-indigo-100/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Batch Download Hub</h3>
          </div>
          <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[8px] font-black">
            {completedImages.length} READY
          </span>
        </div>
        
        <div className="p-4 space-y-4">
          {completedImages.length > 0 ? (
            <>
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Format Export:</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['.eps', '.jpg', '.png', '.svg'] as const).map((ext) => {
                    const isRecommended = formatRecommendation === ext;
                    return (
                      <button
                        key={ext}
                        onClick={() => setExportExtension(ext)}
                        className={cn(
                          "relative py-2 rounded-xl text-[10px] font-black transition-all border flex flex-col items-center justify-center gap-0.5",
                          exportExtension === ext
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md active:scale-95"
                            : cn(
                                "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50",
                                isRecommended && "border-indigo-300 bg-indigo-50/50"
                              )
                        )}
                      >
                        {ext}
                        {isRecommended && exportExtension !== ext && (
                          <div className="absolute -top-1.5 px-1 bg-indigo-500 text-white text-[6px] rounded-full uppercase tracking-tighter">
                            BEST
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Freepik', label: 'Freepik', action: downloadCSV, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { id: 'Adobe', label: 'Adobe Stock', action: downloadAdobeStockCSV, color: 'text-red-600', bg: 'bg-red-50' },
                  { id: 'Shutterstock', label: 'Shutterstock', action: downloadShutterstockCSV, color: 'text-amber-600', bg: 'bg-amber-50' }
                ].map((p) => {
                  return (
                    <button
                      key={p.id}
                      onClick={() => p.action()}
                      disabled={isGenerating}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all group",
                        isGenerating 
                          ? "opacity-40 cursor-not-allowed grayscale" 
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md active:scale-95 shadow-sm"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", p.bg)}>
                        <FileText className={cn("w-4 h-4", p.color)} />
                      </div>
                      
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black uppercase text-slate-700 leading-none">{p.label.split(' ')[0]}</span>
                        <span className="text-[7px] font-bold text-slate-400 mt-0.5">CSV BATCH</span>
                      </div>
                    </button>
                  );
                })}
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

      {/* Grid Image Gallery */}
      {images.length > 0 && (
        <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Daftar Gambar ({images.length})</h3>
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

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]"
            >
              Metadata Settings
              {showSettingsPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showSettingsPanel && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">Title Length ({titleLength})</label>
                    <button onClick={() => setTitleLength(100)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">Reset</button>
                  </div>
                  <input 
                    type="range"
                    min="30"
                    max="200"
                    value={titleLength}
                    onChange={(e) => setTitleLength(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">Keywords Count ({keywordCount})</label>
                    <button onClick={() => setKeywordCount(50)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">Reset</button>
                  </div>
                  <input 
                    type="range"
                    min="5"
                    max="50"
                    value={keywordCount}
                    onChange={(e) => setKeywordCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </>
            )}
          </div>

          <button 
            onClick={generateMetadata}
            disabled={isGenerating || images.length === 0}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[.98]"
            id="btn-generate-all"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Sedang..." : "Generate"}
          </button>
        </div>
      )}
    </div>
  );
}
