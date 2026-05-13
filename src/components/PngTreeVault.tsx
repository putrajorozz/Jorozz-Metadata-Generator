import { 
  Database, 
  Sparkles, 
  ChevronDown, 
  Key, 
  History, 
  Upload, 
  Loader2, 
  Trash2, 
  Check, 
  Copy,
  Plus,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ImageData } from '../types';
import { MODELS } from '../constants';
import { RefObject } from 'react';

interface PngTreeVaultProps {
  pngTreeAssets: ImageData[];
  selectedPngTreeId: string | null;
  setSelectedPngTreeId: (id: string | null) => void;
  setPngTreeAssets: (assets: ImageData[] | ((prev: ImageData[]) => ImageData[])) => void;
  isGenerating: boolean;
  generatePngTreeMetadata: () => void;
  isPngTreeDragActive: boolean;
  isUploading: boolean;
  openPngTree: () => void;
  getPngTreeRootProps: any;
  getPngTreeInputProps: any;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  setShowKeyModal: (show: boolean) => void;
  setShowInfoPage: (show: boolean) => void;
  setConfirmModal: (modal: any) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  modelDropdownRef: RefObject<HTMLDivElement>;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
  activeDownloadMenu: any;
  setActiveDownloadMenu: (menu: any) => void;
  exportExtension: string;
  setExportExtension: (ext: any) => void;
  downloadCSV: (imgs?: ImageData[]) => void;
  downloadAdobeStockCSV: (imgs?: ImageData[]) => void;
  downloadShutterstockCSV: (imgs?: ImageData[]) => void;
  titleLength: number;
  setTitleLength: (length: number) => void;
  keywordCount: number;
  setKeywordCount: (count: number) => void;
}

export function PngTreeVault({
  pngTreeAssets,
  selectedPngTreeId,
  setSelectedPngTreeId,
  setPngTreeAssets,
  isGenerating,
  generatePngTreeMetadata,
  isPngTreeDragActive,
  isUploading,
  openPngTree,
  getPngTreeRootProps,
  getPngTreeInputProps,
  selectedModel,
  setSelectedModel,
  showModelDropdown,
  setShowModelDropdown,
  setShowKeyModal,
  setShowInfoPage,
  setConfirmModal,
  addToast,
  modelDropdownRef,
  copyToClipboard,
  copiedField,
  activeDownloadMenu,
  setActiveDownloadMenu,
  exportExtension,
  setExportExtension,
  downloadCSV,
  downloadAdobeStockCSV,
  downloadShutterstockCSV,
  titleLength,
  setTitleLength,
  keywordCount,
  setKeywordCount
}: PngTreeVaultProps) {
  const selectedAsset = pngTreeAssets.find(a => a.id === selectedPngTreeId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
      {/* PNGTree Drag Overlay */}
      <AnimatePresence>
        {isPngTreeDragActive && !isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-indigo-600/20 backdrop-blur-sm flex items-center justify-center p-12"
          >
            <div className="w-full h-full border-4 border-dashed border-indigo-500 rounded-[3rem] bg-white/90 flex flex-col items-center justify-center text-indigo-600 shadow-2xl">
              <Upload className="w-20 h-20 animate-bounce mb-6" />
              <h3 className="text-4xl font-black tracking-tighter uppercase">DROP PNGTREE VAULT</h3>
              <p className="mt-2 font-bold text-slate-400">Add assets to the isolated processing queue</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header PNGTree Page */}
        <header className="p-4 border-b border-slate-200 bg-white/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-sm md:text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Database className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
              <span className="hidden xs:inline">PNGTree Pro</span>
            </h1>
            <div className="h-4 w-px bg-slate-200 hidden xs:block" />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Isolated Backend</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
            {/* Mobile Key Button */}
            <button 
              onClick={() => setShowKeyModal(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-indigo-600 transition-colors"
              id="pt-mobile-key-btn"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Model Selection */}
            <div className="relative hidden xl:block" ref={modelDropdownRef as any}>
              <button 
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="h-9 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 hover:border-indigo-200 transition-all shadow-sm group"
                id="pt-model-selection-btn"
              >
                <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">
                  {MODELS.find(m => m.id === selectedModel)?.name}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", showModelDropdown && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showModelDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-2"
                  >
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelDropdown(false);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all flex items-start gap-3",
                          selectedModel === m.id ? "bg-indigo-50 border border-indigo-100" : "hover:bg-slate-50 border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 p-1.5 rounded-lg transition-colors",
                          selectedModel === m.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          <Sparkles className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-bold", selectedModel === m.id ? "text-indigo-900" : "text-slate-700")}>{m.name}</p>
                          <p className="text-[9px] text-slate-400 leading-tight mt-0.5 line-clamp-2">{m.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={() => setShowKeyModal(true)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm"><Key className="w-4 h-4" /></button>
            <button onClick={() => setShowInfoPage(true)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm"><History className="w-4 h-4" /></button>
            
            <div className="h-6 w-px bg-slate-200 hidden xs:block" />
            
            <button 
              onClick={openPngTree}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] md:text-xs shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" /> UPLOAD
            </button>
            
            <button 
               onClick={() => {
                 setConfirmModal({
                   isOpen: true,
                   title: 'Clear Workspace',
                   message: 'Hapus semua aset dari workspace PNGTree?',
                   onConfirm: () => {
                     setPngTreeAssets([]);
                     setSelectedPngTreeId(null);
                     addToast("Workspace dikosongkan", "info");
                   }
                 });
               }}
               disabled={pngTreeAssets.length === 0}
               className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 rounded-xl transition-all shadow-sm disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
          {/* Left Panel */}
          <div className="w-full md:w-[400px] lg:w-[450px] shrink-0 h-[40vh] md:h-full border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col z-20">
            <div className="space-y-4 pt-4 border-t border-slate-100 px-4 mb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title Length ({titleLength})</label>
                  <button onClick={() => setTitleLength(100)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">Reset</button>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="200"
                  value={titleLength}
                  onChange={(e) => setTitleLength(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keywords Count ({keywordCount})</label>
                  <button onClick={() => setKeywordCount(20)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">Reset</button>
                </div>
                <input 
                  type="range"
                  min="5"
                  max="20"
                  value={keywordCount}
                  onChange={(e) => setKeywordCount(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Moved Generate Button */}
              <button 
                onClick={generatePngTreeMetadata}
                disabled={isGenerating || pngTreeAssets.filter(a => a.status === 'pending').length === 0}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isGenerating ? "GENERATING..." : "PROCESS ALL ASSETS"}
              </button>
            </div>

            <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50" {...getPngTreeRootProps()}>
              <input {...getPngTreeInputProps()} />
              <div 
                onClick={openPngTree}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-indigo-500" />
                </div>
                <h4 className="text-sm font-black text-slate-800">Add PNGTree Assets</h4>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Supports .jpg, .eps, .png</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {pngTreeAssets.map((asset) => (
                    <div 
                      key={asset.id}
                      onClick={() => setSelectedPngTreeId(asset.id)}
                      className={cn(
                        "group relative aspect-square rounded-xl overflow-hidden border transition-all cursor-pointer",
                        selectedPngTreeId === asset.id ? "border-indigo-600 ring-2 ring-indigo-500/20 shadow-md" : "border-slate-100 hover:border-indigo-300"
                      )}
                    style={{
                      backgroundImage: 'conic-gradient(#f1f5f9 25%, white 0 50%, #f1f5f9 0 75%, white 0)',
                      backgroundSize: '10px 10px',
                    }}
                  >
                    <img src={asset.preview} alt="" className="w-full h-full object-contain p-2" />
                    
                    <div className={cn(
                      "absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity",
                      selectedPngTreeId === asset.id && "opacity-100"
                    )} />

                    {/* Status badge */}
                    <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 z-10">
                       {asset.status === 'completed' && <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center text-white shadow-lg"><Check className="w-2.5 h-2.5" /></div>}
                       {asset.status === 'processing' && <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center text-white shadow-lg"><Loader2 className="w-2.5 h-2.5 animate-spin" /></div>}
                    </div>

                    {/* Individual Delete Button - Bottom Right */}
                    <div className="absolute bottom-1.5 right-1.5 z-10">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPngTreeAssets(prev => prev.filter(a => a.id !== asset.id));
                          if (selectedPngTreeId === asset.id) setSelectedPngTreeId(null);
                          addToast("Asset dihapus", "info");
                        }}
                        className="w-5 h-5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shadow-md active:scale-90"
                        title="Delete Asset"
                       >
                         <Trash2 className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Detailed View */}
          <div className="flex-1 overflow-y-auto bg-white p-4 md:p-8 custom-scrollbar">
            {selectedAsset ? (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Meta Hero Section */}
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 items-start">
                  <div className="aspect-square rounded-2xl overflow-hidden border-4 border-white shadow-xl shadow-slate-200"
                    style={{
                      backgroundImage: 'conic-gradient(#f1f5f9 25%, white 0 50%, #f1f5f9 0 75%, white 0)',
                      backgroundSize: '16px 16px',
                    }}
                  >
                    <img src={selectedAsset.preview} alt="" className="w-full h-full object-contain p-3" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-tighter border border-indigo-100">PRO ASSET</span>
                      <span className="text-[10px] font-bold text-slate-400">{selectedAsset.file.name}</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <h2 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-relaxed flex-1">
                        {selectedAsset.metadata?.pngTree?.title || "Waiting for generation..."}
                      </h2>
                      {selectedAsset.metadata?.pngTree?.title && (
                        <button 
                          onClick={() => copyToClipboard(selectedAsset.metadata!.pngTree!.title, 'p-title')}
                          className="shrink-0 p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all shadow-sm active:scale-95"
                          title="Copy Title"
                        >
                          {copiedField === 'p-title' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedAsset.status === 'completed' && selectedAsset.metadata?.pngTree && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                    <div className="space-y-6">
                      {/* 1. Main Keywords */}
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Keywords (Top 3)</label>
                          <button onClick={() => copyToClipboard(selectedAsset.metadata!.pngTree!.mainKeywords.join(', '), 'p-mkey')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                            {copiedField === 'p-mkey' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        <div className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] md:rounded-[1.5rem] flex gap-2 overflow-x-auto custom-scrollbar-hide">
                          {selectedAsset.metadata.pngTree.mainKeywords.map((k, i) => (
                            <button 
                              key={i}
                              onClick={() => copyToClipboard(k, `pmk-${i}`)}
                              className="px-3 py-1.5 bg-white border border-indigo-100 rounded-xl text-[10px] md:text-xs font-bold text-indigo-600 shadow-sm whitespace-nowrap hover:border-indigo-400 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                              {k}
                              {copiedField === `pmk-${i}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 text-slate-300" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Secondary Keywords */}
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secondary Keywords ({selectedAsset.metadata.pngTree.secondaryKeywords.slice(0, keywordCount).length} / {keywordCount})</label>
                          <button onClick={() => copyToClipboard(selectedAsset.metadata!.pngTree!.secondaryKeywords.slice(0, keywordCount).join(', '), 'p-skey')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                            {copiedField === 'p-skey' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        <div className="p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-[1.2rem] md:rounded-[1.5rem] flex flex-wrap gap-1.5 sm:gap-2 content-start min-h-[80px] md:min-h-[120px]">
                          {selectedAsset.metadata.pngTree.secondaryKeywords.slice(0, keywordCount).map((k, i) => (
                            <span key={i} className="px-2.5 py-1 bg-white text-[9px] md:text-[10px] font-bold text-slate-500 border border-slate-200 rounded-lg lowercase tracking-tight">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                       {/* 2. Main Copy Display */}
                       <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Copy / Text content</label>
                          <button onClick={() => copyToClipboard(selectedAsset.metadata!.pngTree!.mainCopy, 'p-copy')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                            {copiedField === 'p-copy' ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-[1.2rem] md:rounded-[1.5rem] text-slate-100 font-bold text-sm min-h-[80px] shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
                          <p className="relative z-10 leading-relaxed italic text-xs md:text-sm">{selectedAsset.metadata.pngTree.mainCopy || "No text content detected from analyzing the image."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mb-6 shadow-inner">
                  <Database className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">PRO Vault Empty</h3>
                <p className="text-slate-400 font-medium max-w-xs mt-2 text-sm leading-relaxed">Select or upload an asset to investigate its isolated metadata profile.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
