import { 
  BarChart2, 
  Image as ImageIcon, 
  Download, 
  Edit3, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Copy, 
  Loader2, 
  AlertCircle,
  X,
  ShieldCheck,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';
import { calculateSeoScore, sanitizeMicrostockMetadata } from '../lib/metadataUtils';

interface MetadataPanelProps {
  selectedImage: ImageData | undefined;
  setSelectedId: (id: string | null) => void;
  viewMode: 'standard' | 'pngtree';
  setViewMode: (mode: 'standard' | 'pngtree') => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  startEditing: () => void;
  editData: { 
    title: string; 
    description: string; 
    keywords: string;
    ptMainKeywords?: string;
    ptSecondaryKeywords?: string;
    ptMainCopy?: string;
  } | null;
  setEditData: (data: any) => void;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
  saveEdit: () => void;
  generateMetadata: () => void;
  isGenerating: boolean;
  selectedModel: string;
  regenerateSingleMetadata: (id: string) => void;
  activeDownloadMenu: { type: 'freepik' | 'adobe' | 'shutterstock' | 'dreamstime'; targetImages?: ImageData[] } | null;
  setActiveDownloadMenu: (menu: { type: 'freepik' | 'adobe' | 'shutterstock' | 'dreamstime'; targetImages?: ImageData[] } | null) => void;
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
  images: ImageData[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOptimizeMetadata?: (id: string) => void;
}

export function MetadataPanel({
  selectedImage,
  setSelectedId,
  viewMode,
  setViewMode,
  isEditing,
  setIsEditing,
  startEditing,
  editData,
  setEditData,
  copyToClipboard,
  copiedField,
  saveEdit,
  generateMetadata,
  isGenerating,
  selectedModel,
  regenerateSingleMetadata,
  activeDownloadMenu,
  setActiveDownloadMenu,
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
  images,
  addToast,
  onOptimizeMetadata
}: MetadataPanelProps) {
  const completedImages = images.filter(img => img.status === 'completed' && img.metadata);

  const seoAnalysis = useMemo(() => {
    if (!selectedImage || !selectedImage.metadata) return null;
    return calculateSeoScore(selectedImage.metadata, selectedImage.file.type === 'image/png');
  }, [selectedImage?.metadata, selectedImage?.file?.type]);

  // Intelligent Format Recommendation
  const formatRecommendation = (() => {
    if (!selectedImage) return '.png';
    const type = selectedImage.file.type;
    
    if (viewMode === 'pngtree') return '.png';
    if (type === 'image/svg+xml') return '.svg';
    if (type === 'image/png') return '.png';
    if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
    return '.eps';
  })();

  useEffect(() => {
    setExportExtension(formatRecommendation);
  }, [formatRecommendation, setExportExtension, selectedImage?.id]);

  if (!selectedImage) {
    return (
      <div className="flex flex-col gap-6 h-full">
        {/* Empty State / Hint */}
        <div className="flex-1 bg-white/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center text-slate-400">
          <ImageIcon className="w-10 h-10 mb-3 opacity-30" />
          <h3 className="text-sm font-bold text-slate-800">Detail Metadata</h3>
          <p className="text-xs font-medium mt-1">Pilih salah satu gambar di samping untuk melihat atau mengedit detail metadatanya secara spesifik.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col h-full min-h-[500px] relative transition-all"
    >
      {/* Detail Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-white relative shrink-0",
            (viewMode === 'pngtree' || selectedImage.file.type === 'image/png') && "bg-transparency-pattern"
          )}>
            <img src={selectedImage.preview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-slate-800 truncate">{selectedImage.file.name}</h3>
            <p className="text-[10px] text-slate-400 font-medium">{(selectedImage.file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 ml-2">
          <button 
            onClick={() => setViewMode('standard')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
              viewMode === 'standard' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
            )}
            id="btn-view-standard"
          >
            <BarChart2 className="w-3 h-3" /> Standard
          </button>
          <button 
            onClick={() => setViewMode('pngtree')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
              viewMode === 'pngtree' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
            )}
            id="btn-view-pngtree"
          >
            <ImageIcon className="w-3 h-3" /> PNGTree
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 sm:p-6 space-y-6">
        {selectedImage.status === 'completed' && selectedImage.metadata ? (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata Actions</h4>
                {!isEditing && (
                  <button 
                    onClick={startEditing}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    id="btn-edit-metadata"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              
              <div className="space-y-3 relative">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'freepik', label: 'Freepik', icon: <Download className="w-3.5 h-3.5 text-blue-500" /> },
                    { id: 'adobe', label: 'Adobe Stock', icon: <Download className="w-3.5 h-3.5 text-red-500" /> },
                    { id: 'shutterstock', label: 'Shutterstock', icon: <Download className="w-3.5 h-3.5 text-amber-500" /> },
                    { id: 'dreamstime', label: 'Dreamstime', icon: <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> }
                  ].map((p) => {
                    const isActive = activeDownloadMenu?.type === p.id;
                    return (
                      <div key={p.id} className="relative">
                        <button
                          onClick={() => {
                            if (p.id === 'dreamstime') {
                              downloadWithMetadata([selectedImage]);
                            } else {
                              if (isActive) setActiveDownloadMenu(null);
                              else setActiveDownloadMenu({ type: p.id as any, targetImages: [selectedImage] });
                            }
                          }}
                          className={cn(
                            "px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-bold shadow-xs hover:border-indigo-300 hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95",
                            isActive && "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-50"
                          )}
                        >
                          {p.icon}
                          {p.label}
                        </button>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute top-[calc(100%+8px)] left-0 w-56 p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-indigo-200/40 space-y-3.5 z-[100]"
                            >
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-3.5 bg-indigo-600 rounded-full" />
                                  <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{p.label}</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setActiveDownloadMenu(null); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="space-y-3">
                                {p.id === 'freepik' && (
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

                                {activeDownloadMenu?.type !== 'dreamstime' && (
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

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (p.id === 'adobe') downloadAdobeStockCSV([selectedImage]);
                                    else if (p.id === 'shutterstock') downloadShutterstockCSV([selectedImage]);
                                    else if (p.id === 'freepik') downloadCSV([selectedImage]);
                                    else if (p.id === 'dreamstime') downloadWithMetadata([selectedImage]);
                                    setActiveDownloadMenu(null);
                                  }}
                                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:bg-indigo-500 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
                                >
                                  {p.id === 'dreamstime' ? <Sparkles className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                  {p.id === 'dreamstime' ? "Download Image" : "Download"}
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
            </div>

            {/* Metadata Forms */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {/* Model and Key Info */}
              <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 mb-3 flex items-center justify-between">
                <p className="text-[10px] text-indigo-800">
                  Model: <strong>{selectedImage.metadata.usedModel}</strong> | Key: <strong>{selectedImage.metadata.usedApiKey}</strong>
                </p>
                {selectedImage.metadata.pngTree && (
                  <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">AI Analysis Complete</span>
                )}
              </div>

              {/* SEO Quality Score Card */}
              {seoAnalysis && (
                <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-md space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">SEO Quality Score</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                        seoAnalysis.level === 'excellent' && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                        seoAnalysis.level === 'good' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                        seoAnalysis.level === 'average' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                        seoAnalysis.level === 'poor' && "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      )}>
                        {seoAnalysis.score} / 100 • {seoAnalysis.level.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {seoAnalysis.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[9px] bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                        {item.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-slate-200">{item.label}</div>
                          <div className="text-slate-400 leading-tight text-[8px] mt-0.5">{item.tip}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {onOptimizeMetadata && (
                    <button
                      onClick={() => onOptimizeMetadata(selectedImage.id)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                      id="btn-auto-optimize-seo"
                    >
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                      Auto-Format & Sanitasi SEO Metadata
                    </button>
                  )}
                </div>
              )}
              
              {viewMode === 'standard' ? (
                <>
                  {/* Title Field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Judul</label>
                      {!isEditing && (
                        <button onClick={() => copyToClipboard(selectedImage.metadata!.title, 'title')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400" id="btn-copy-title">
                          {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <input 
                        value={editData?.title || ''}
                        onChange={(e) => setEditData((p: any) => p ? {...p, title: e.target.value} : null)}
                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none"
                      />
                    ) : (
                      <div className="p-4 bg-white/60 border border-slate-100 rounded-2xl text-slate-800 font-medium text-sm">
                        {selectedImage.metadata.title}
                      </div>
                    )}
                  </div>

                  {/* Description Field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Deskripsi</label>
                      {!isEditing && (
                        <button onClick={() => copyToClipboard(selectedImage.metadata!.description, 'desc')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400" id="btn-copy-desc">
                          {copiedField === 'desc' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        rows={3}
                        value={editData?.description || ''}
                        onChange={(e) => setEditData((p: any) => p ? {...p, description: e.target.value} : null)}
                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none resize-none"
                      />
                    ) : (
                      <div className="p-4 bg-white/60 border border-slate-100 rounded-2xl text-slate-600 text-sm leading-relaxed">
                        {selectedImage.metadata.description}
                      </div>
                    )}
                  </div>

                  {/* Keywords Field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Kata Kunci ({selectedImage.metadata.keywords.length})</label>
                      {!isEditing && (
                        <button onClick={() => copyToClipboard(selectedImage.metadata!.keywords.join(', '), 'keys')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400" id="btn-copy-keys">
                          {copiedField === 'keys' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea 
                        rows={4}
                        value={editData?.keywords || ''}
                        onChange={(e) => setEditData((p: any) => p ? {...p, keywords: e.target.value} : null)}
                        placeholder="Keywords separated by commas"
                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none resize-none"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedImage.metadata.keywords.map((k, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[11px] font-medium text-slate-600 shadow-sm">
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  {/* PNGTree Metadata Display */}
                  {selectedImage.metadata.pngTree ? (
                    <>
                      {/* PNGTree Title */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">1. Title</label>
                          </div>
                          {!isEditing && (
                            <button 
                              onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.title, 'pt-title')} 
                              className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                              id="btn-copy-pt-title"
                            >
                              <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy</span>
                              {copiedField === 'pt-title' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <input 
                            value={editData?.title || ''}
                            onChange={(e) => setEditData((p: any) => p ? {...p, title: e.target.value} : null)}
                            className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none"
                          />
                        ) : (
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-800 font-bold text-sm shadow-sm">
                            {selectedImage.metadata.pngTree.title}
                          </div>
                        )}
                      </div>

                      {/* Main Keywords */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">2. Main Keywords (2-3)</label>
                          </div>
                          {!isEditing && (
                            <button 
                              onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.mainKeywords.join(', '), 'pt-main-keys')} 
                              className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                              id="btn-copy-pt-main-keys"
                            >
                              <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy All</span>
                              {copiedField === 'pt-main-keys' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <input 
                            value={editData?.ptMainKeywords || ''}
                            onChange={(e) => setEditData((p: any) => p ? {...p, ptMainKeywords: e.target.value} : null)}
                            placeholder="Keywords separated by commas"
                            className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2 p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl">
                            {selectedImage.metadata.pngTree.mainKeywords.map((k, i) => (
                              <button 
                                key={i} 
                                onClick={() => copyToClipboard(k, `pt-mkey-${i}`)}
                                className="px-3 py-1.5 bg-white border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 shadow-xs flex items-center gap-2 hover:border-indigo-400 group"
                              >
                                {k}
                                {copiedField === `pt-mkey-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Secondary Keywords */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">3. Secondary Keywords ({selectedImage.metadata.pngTree.secondaryKeywords.length}/50)</label>
                          </div>
                          {!isEditing && (
                            <button 
                              onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.secondaryKeywords.join(', '), 'pt-sec-keys')} 
                              className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                              id="btn-copy-pt-sec-keys"
                            >
                              <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy All</span>
                              {copiedField === 'pt-sec-keys' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <textarea 
                            rows={4}
                            value={editData?.ptSecondaryKeywords || ''}
                            onChange={(e) => setEditData((p: any) => p ? {...p, ptSecondaryKeywords: e.target.value} : null)}
                            placeholder="Keywords separated by commas"
                            className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none resize-none"
                          />
                        ) : (
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl min-h-[100px]">
                            <div className="flex flex-wrap gap-1.5">
                              {selectedImage.metadata.pngTree.secondaryKeywords.map((k, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] border border-slate-100">
                                  {k}
                                </span>
                              ))}
                              {selectedImage.metadata.pngTree.secondaryKeywords.length === 0 && (
                                <span className="text-[10px] italic text-slate-400">Tidak ada kata kunci sekunder.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Main Copy */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">4. Main Copy / Text Content</label>
                          </div>
                          {!isEditing && (
                            <button 
                              onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.mainCopy, 'pt-copy')} 
                              className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                              id="btn-copy-pt-copy"
                            >
                              <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy</span>
                              {copiedField === 'pt-copy' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <textarea 
                            rows={3}
                            value={editData?.ptMainCopy || ''}
                            onChange={(e) => setEditData((p: any) => p ? {...p, ptMainCopy: e.target.value} : null)}
                            className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/10 focus:outline-none resize-none"
                          />
                        ) : (
                          <div className="p-4 bg-slate-800 text-slate-300 rounded-2xl text-xs font-mono border border-slate-700 shadow-inner">
                            {selectedImage.metadata.pngTree.mainCopy || "No text detected."}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-4">
                        <Sparkles className="w-6 h-6 text-indigo-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">PNGTree Data Belum Ada</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Silakan generate ulang (Regenerate) untuk mendapatkan format baru PNGTree.</p>
                      <button 
                        onClick={() => regenerateSingleMetadata(selectedImage.id)}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                        id="btn-generate-pt-single"
                      >
                        Generate PNGTree Sekarang
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-4">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">Batal</button>
                <button onClick={saveEdit} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">Simpan</button>
              </div>
            )}
          </div>
        ) : selectedImage.status === 'processing' ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <h3 className="font-bold text-slate-800">Menganalisis Gambar...</h3>
            <p className="text-xs text-slate-500 mt-1">Menggunakan {selectedModel}</p>
          </div>
        ) : selectedImage.status === 'error' ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <h3 className="font-bold text-slate-800">Terjadi Kesalahan</h3>
            <p className="text-xs text-red-500 mt-1 max-w-xs">{selectedImage.error}</p>
            <button onClick={generateMetadata} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Coba Lagi</button>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Sparkles className="w-10 h-10 text-indigo-300 mb-4" />
            <h3 className="font-bold text-slate-800">Siap Generate</h3>
            <p className="text-xs text-slate-500 mt-1">Klik tombol generate di bawah daftar gambar untuk memulai analisis AI</p>
          </div>
        )}
        </div>
      </div>
    </motion.div>
  );
}
