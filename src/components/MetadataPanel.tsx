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
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';

interface MetadataPanelProps {
  selectedImage: ImageData | undefined;
  setSelectedId: (id: string | null) => void;
  viewMode: 'standard' | 'pngtree';
  setViewMode: (mode: 'standard' | 'pngtree') => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editData: { title: string; description: string; keywords: string } | null;
  setEditData: (data: { title: string; description: string; keywords: string } | null | ((prev: any) => any)) => void;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
  saveEdit: () => void;
  generateMetadata: () => void;
  isGenerating: boolean;
  selectedModel: string;
  regenerateSingleMetadata: (id: string) => void;
  activeDownloadMenu: { type: 'adobe' | 'shutterstock'; targetImages?: ImageData[] } | null;
  setActiveDownloadMenu: (menu: { type: 'adobe' | 'shutterstock'; targetImages?: ImageData[] } | null) => void;
  exportExtension: string;
  setExportExtension: (ext: any) => void;
  downloadCSV: (images?: ImageData[]) => void;
  downloadAdobeStockCSV: (images?: ImageData[]) => void;
  downloadShutterstockCSV: (images?: ImageData[]) => void;
  images: ImageData[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function MetadataPanel({
  selectedImage,
  setSelectedId,
  viewMode,
  setViewMode,
  isEditing,
  setIsEditing,
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
  downloadCSV,
  downloadAdobeStockCSV,
  downloadShutterstockCSV,
  images,
  addToast
}: MetadataPanelProps) {
  const completedImages = images.filter(img => img.status === 'completed' && img.metadata);

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
      className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full min-h-[500px]"
    >
      {/* Detail Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-white relative",
            viewMode === 'pngtree' && "bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat"
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
                {!isEditing && viewMode === 'standard' && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    id="btn-edit-metadata"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              
              <AnimatePresence mode="wait">
                {activeDownloadMenu ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Pilih Ekstensi ({activeDownloadMenu.type})</span>
                      <button onClick={() => setActiveDownloadMenu(null)} className="text-white/60 hover:text-white"><ChevronRight className="w-4 h-4 rotate-180" /></button>
                    </div>
                    <div className="flex gap-2">
                      {(['.eps', '.jpg', '.png'] as const).map((ext) => (
                        <button
                          key={ext}
                          onClick={() => setExportExtension(ext)}
                          className={cn(
                            "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border",
                            exportExtension === ext
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          {ext}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (activeDownloadMenu.type === 'adobe') downloadAdobeStockCSV([selectedImage]);
                        else downloadShutterstockCSV([selectedImage]);
                        setActiveDownloadMenu(null);
                      }}
                      className="w-full py-3 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 flex items-center justify-center gap-2"
                      id="btn-confirm-download"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                    </button>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadCSV([selectedImage])}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
                      id="btn-download-freepik"
                    >
                      <Download className="w-4 h-4" /> Freepik
                    </button>
                    <button
                      onClick={() => setActiveDownloadMenu({ type: 'adobe', targetImages: [selectedImage] })}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
                      id="btn-download-adobe"
                    >
                      <Download className="w-4 h-4" /> Adobe Stock
                    </button>
                    <button
                      onClick={() => setActiveDownloadMenu({ type: 'shutterstock', targetImages: [selectedImage] })}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
                      id="btn-download-shutterstock"
                    >
                      <Download className="w-4 h-4" /> Shutterstock
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Metadata Forms */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {/* Model and Key Info */}
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-4 flex items-center justify-between">
                <p className="text-[10px] text-indigo-800">
                  Model: <strong>{selectedImage.metadata.usedModel}</strong> | Key: <strong>{selectedImage.metadata.usedApiKey}</strong>
                </p>
                {selectedImage.metadata.pngTree && (
                  <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">AI Analysis Complete</span>
                )}
              </div>
              
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
                          <button 
                            onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.title, 'pt-title')} 
                            className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                            id="btn-copy-pt-title"
                          >
                            <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy</span>
                            {copiedField === 'pt-title' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-800 font-bold text-sm shadow-sm">
                          {selectedImage.metadata.pngTree.title}
                        </div>
                      </div>

                      {/* Main Keywords */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">2. Main Keywords (2-3)</label>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.mainKeywords.join(', '), 'pt-main-keys')} 
                            className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                            id="btn-copy-pt-main-keys"
                          >
                            <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy All</span>
                            {copiedField === 'pt-main-keys' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
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
                      </div>

                      {/* Secondary Keywords */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">3. Secondary Keywords ({selectedImage.metadata.pngTree.secondaryKeywords.length}/50)</label>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.secondaryKeywords.join(', '), 'pt-sec-keys')} 
                            className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                            id="btn-copy-pt-sec-keys"
                          >
                            <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy All</span>
                            {copiedField === 'pt-sec-keys' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
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
                      </div>

                      {/* Main Copy */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">4. Main Copy / Text Content</label>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(selectedImage.metadata!.pngTree!.mainCopy, 'pt-copy')} 
                            className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all group"
                            id="btn-copy-pt-copy"
                          >
                            <span className="text-[9px] font-bold uppercase group-hover:block transition-all">Copy</span>
                            {copiedField === 'pt-copy' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="p-4 bg-slate-800 text-slate-300 rounded-2xl text-xs font-mono border border-slate-700 shadow-inner">
                          {selectedImage.metadata.pngTree.mainCopy || "No text detected."}
                        </div>
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

            {isEditing && viewMode === 'standard' && (
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
