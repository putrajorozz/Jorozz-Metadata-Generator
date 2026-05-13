import { 
  Upload, 
  FileText, 
  X, 
  Check, 
  Loader2, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Sparkles 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';

interface AssetGridProps {
  images: ImageData[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setImages: (images: ImageData[] | ((prev: ImageData[]) => ImageData[])) => void;
  isDragActive: boolean;
  open: () => void;
  showSettingsPanel: boolean;
  setShowSettingsPanel: (show: boolean) => void;
  titleLength: number;
  setTitleLength: (val: number) => void;
  keywordCount: number;
  setKeywordCount: (val: number) => void;
  generateMetadata: () => void;
  isGenerating: boolean;
}

export function AssetGrid({
  images,
  selectedId,
  setSelectedId,
  setImages,
  isDragActive,
  open,
  showSettingsPanel,
  setShowSettingsPanel,
  titleLength,
  setTitleLength,
  keywordCount,
  setKeywordCount,
  generateMetadata,
  isGenerating
}: AssetGridProps) {
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
                  <img src={img.preview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImages(prev => prev.filter(i => i.id !== img.id));
                    if (selectedId === img.id) setSelectedId(null);
                  }}
                  className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow-sm text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Status Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-1 flex justify-end pointer-events-none">
                  {img.status === 'completed' && (
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  {img.status === 'processing' && (
                    <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                    </div>
                  )}
                  {img.status === 'error' && (
                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <AlertCircle className="w-2.5 h-2.5 text-white" />
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
