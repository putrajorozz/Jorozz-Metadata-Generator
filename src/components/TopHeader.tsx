import { 
  Sparkles, 
  ChevronDown, 
  Key, 
  Info, 
  Plus, 
  Star,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { MODELS } from '../constants';
import { RefObject } from 'react';

interface TopHeaderProps {
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  favoriteModelId: string | null;
  setFavoriteModelId: (id: string | null) => void;
  apiKeys: string[];
  setShowKeyModal: (show: boolean) => void;
  setShowInfoPage: (show: boolean) => void;
  open: () => void;
  modelDropdownRef: RefObject<HTMLDivElement | null>;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
  isAudioMuted: boolean;
  toggleAudioMute: () => void;
}

export function TopHeader({
  selectedModel,
  setSelectedModel,
  showModelDropdown,
  setShowModelDropdown,
  favoriteModelId,
  setFavoriteModelId,
  apiKeys,
  setShowKeyModal,
  setShowInfoPage,
  open,
  modelDropdownRef,
  audioVolume,
  setAudioVolume,
  isAudioMuted,
  toggleAudioMute
}: TopHeaderProps) {
  return (
    <header className="p-3 sm:p-4 border-b border-slate-200 bg-white/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <h1 className="text-xs sm:text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-1.5 sm:gap-2">
          <Sparkles className="w-3.5 h-3.5 sm:w-5 h-5 text-indigo-600 shrink-0" />
          <span className="truncate">Jorozz Gen</span>
        </h1>
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <h2 className="hidden sm:block text-xs md:text-sm font-medium text-slate-500 truncate max-w-[120px] sm:max-w-[200px]">
          Metadata Generator
        </h2>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Settings / API Key Button Mobile */}
        <button 
          onClick={() => setShowKeyModal(true)}
          className="md:hidden p-2 text-slate-500 hover:text-indigo-600 transition-colors"
          title="API Keys"
          id="mobile-btn-keys"
        >
          <Key className="w-4 h-4" />
        </button>

        <div className="relative" ref={modelDropdownRef as any}>
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-100/80 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 sm:gap-2 transition-all"
            title="Pilih Model Gemini"
            id="btn-model-selection"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
            <span className="max-w-[60px] sm:max-w-[100px] truncate">
              {MODELS.find(m => m.id === selectedModel)?.name.split(' (')[0]}
            </span>
            <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showModelDropdown && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showModelDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
              >
                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold px-2">Pilih Model Gemini</span>
                </div>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelDropdown(false);
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors flex items-center justify-between gap-2",
                      selectedModel === m.id
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold">{m.name}</span>
                      <span className="text-[9px] text-slate-400 leading-tight">{m.description}</span>
                    </div>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFavoriteModelId(favoriteModelId === m.id ? null : m.id);
                      }}
                      className="p-1 hover:bg-slate-200 rounded-full cursor-pointer"
                    >
                      <Star className={cn("w-3.5 h-3.5", favoriteModelId === m.id ? "text-yellow-500 fill-current" : "text-slate-300")} />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <button 
          onClick={() => setShowKeyModal(true)}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors relative"
          title="Manage API Keys"
          id="btn-manage-keys"
        >
          <Key className="w-4 h-4" />
          {apiKeys.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full border border-white" />
          )}
        </button>

        {/* Volume & Mute Controller */}
        <div className="flex items-center gap-1 bg-slate-100/80 hover:bg-slate-200 border border-slate-200/50 p-1.5 rounded-xl transition-all group max-w-[40px] hover:max-w-[120px] duration-300 overflow-hidden shrink-0">
          <button
            onClick={toggleAudioMute}
            className="p-1 text-slate-500 hover:text-indigo-600 transition-colors rounded-lg shrink-0"
            title={isAudioMuted ? "Aktifkan Suara" : "Bungkam Suara"}
            id="btn-toggle-mute"
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-indigo-500" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isAudioMuted ? 0 : audioVolume}
            onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
            className="w-0 opacity-0 group-hover:w-16 group-hover:opacity-100 transition-all duration-300 h-1 accent-indigo-600 cursor-pointer outline-none shrink-0"
            title={`Volume: ${Math.round(audioVolume * 100)}%`}
          />
        </div>

        <button 
          onClick={() => setShowInfoPage(true)}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
          title="Informasi Website"
          id="btn-info"
        >
          <Info className="w-4 h-4" />
        </button>
        <button 
          onClick={open}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          id="btn-upload-header"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">Upload Gambar</span>
          <span className="xs:hidden">Upload</span>
        </button>
      </div>
    </header>
  );
}
