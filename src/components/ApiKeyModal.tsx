import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key,
  X,
  Sparkles,
  Plus,
  Info,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiEngine: 'gemini' | 'groq';
  apiKeys: string[];
  activeApiKey: string | null;
  errorApiKeys: string[];
  newKey: string;
  setNewKey: (val: string) => void;
  onAddKey: () => void;
  onRemoveKey: (index: number) => void;
  groqKeys: string[];
  newGroqKey: string;
  setNewGroqKey: (val: string) => void;
  onAddGroqKey: () => void;
  onRemoveGroqKey: (index: number) => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  aiEngine,
  apiKeys,
  activeApiKey,
  errorApiKeys,
  newKey,
  setNewKey,
  onAddKey,
  onRemoveKey,
  groqKeys,
  newGroqKey,
  setNewGroqKey,
  onAddGroqKey,
  onRemoveGroqKey
}: ApiKeyModalProps) {
  const [activeKeyTab, setActiveKeyTab] = useState<'gemini' | 'groq'>('gemini');
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<number>>(new Set());
  const [visibleGroqKeys, setVisibleGroqKeys] = useState<Set<number>>(new Set());
  const [copiedGroqKeys, setCopiedGroqKeys] = useState<Set<number>>(new Set());

  const toggleKeyVisibility = (index: number) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                Manage API Keys
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tab Switcher inside Modal */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveKeyTab('gemini')}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                    activeKeyTab === 'gemini'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  Gemini Keys ({apiKeys.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKeyTab('groq')}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                    activeKeyTab === 'groq'
                      ? 'bg-white text-pink-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  Groq Keys ({groqKeys.length})
                </button>
              </div>

              {activeKeyTab === 'gemini' ? (
                <>
                  <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-2 text-[11px] font-medium text-indigo-900">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {apiKeys.length > 1 ? (
                        <>Terdeteksi <strong>{apiKeys.length} API Keys</strong>. Fitur Auto-Rotate aktif untuk <strong>Model & API Key</strong>.</>
                      ) : apiKeys.length === 1 ? (
                        <>Terdeteksi <strong>1 API Key</strong>. Fitur Auto-Rotate aktif untuk <strong>Model saja</strong> (bebas macet limit kuota).</>
                      ) : (
                        <>Belum ada API Key. Tambahkan minimal 1 API key untuk memulai.</>
                      )}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <textarea
                        placeholder="Masukkan satu atau banyak Gemini API Key (pisahkan dengan baris baru)..."
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        rows={newKey.split('\n').length > 3 ? 5 : 3}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none custom-scrollbar"
                      />
                      <div className="flex flex-col justify-end">
                        <button
                          onClick={onAddKey}
                          className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all hover:shadow-lg active:scale-95"
                          title="Tambah Key"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 px-1">
                      <Info className="w-3 h-3 inline mr-1" />
                      Bisa memasukkan banyak key / log sekaligus dipisah baris baru (dimulai AIza atau AQ.).
                    </p>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {apiKeys.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8 font-medium">Belum ada Gemini API Key yang disimpan.</p>
                    ) : (
                      apiKeys.map((key, i) => {
                        const isActive = activeApiKey === key && aiEngine === 'gemini';
                        const hasError = errorApiKeys.includes(key);

                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl border transition-all',
                              isActive
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                : hasError
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-slate-50 border-slate-100'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isActive ? (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                              ) : hasError ? (
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                              ) : (
                                <Key className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'text-xs font-mono truncate max-w-[180px]',
                                  isActive ? 'text-indigo-700 font-bold' : hasError ? 'text-red-700' : 'text-slate-500'
                                )}
                              >
                                {visibleKeys.has(i) ? key : `${key.substring(0, 8)}••••••••${key.substring(key.length - 4)}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(key);
                                  setCopiedKeys(prev => {
                                    const next = new Set(prev);
                                    next.add(i);
                                    return next;
                                  });
                                  setTimeout(() => {
                                    setCopiedKeys(prev => {
                                      const next = new Set(prev);
                                      next.delete(i);
                                      return next;
                                    });
                                  }, 2000);
                                }}
                                className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors shrink-0"
                                title="Copy API Key"
                              >
                                {copiedKeys.has(i) ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => toggleKeyVisibility(i)}
                                className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors shrink-0"
                              >
                                {visibleKeys.has(i) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => onRemoveKey(i)}
                                className="p-1.5 hover:bg-red-100 text-red-400 rounded-lg transition-colors shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2.5 bg-pink-50 border border-pink-100 rounded-2xl flex items-center gap-2 text-[11px] font-medium text-pink-900">
                    <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
                    <span>
                      {groqKeys.length > 1 ? (
                        <>Terdeteksi <strong>{groqKeys.length} Groq Keys</strong>. Fitur Auto-Rotate aktif untuk <strong>Model & API Key Groq</strong>.</>
                      ) : groqKeys.length === 1 ? (
                        <>Terdeteksi <strong>1 Groq Key</strong>. Fitur Auto-Rotate aktif untuk <strong>Model Groq saja</strong>.</>
                      ) : (
                        <>Belum ada Groq API Key. Tambahkan minimal 1 key untuk mulai.</>
                      )}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <textarea
                        placeholder="Masukkan satu atau banyak Groq API Key (pisahkan dengan baris baru)..."
                        value={newGroqKey}
                        onChange={(e) => setNewGroqKey(e.target.value)}
                        rows={newGroqKey.split('\n').length > 3 ? 5 : 3}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none custom-scrollbar"
                      />
                      <div className="flex flex-col justify-end">
                        <button
                          onClick={onAddGroqKey}
                          className="p-3 bg-pink-600 text-white rounded-2xl hover:bg-pink-700 transition-all hover:shadow-lg active:scale-95"
                          title="Tambah Groq Key"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 px-1">
                      <Info className="w-3 h-3 inline mr-1" />
                      Bisa memasukkan banyak key sekaligus dipisah baris baru (biasanya diawali gsk_).
                    </p>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {groqKeys.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8 font-medium">Belum ada Groq API Key yang disimpan.</p>
                    ) : (
                      groqKeys.map((key, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                          <div className="flex items-center gap-3 min-w-0">
                            <Key className="w-4 h-4 text-pink-500 shrink-0" />
                            <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">
                              {visibleGroqKeys.has(i) ? key : `${key.substring(0, 8)}••••••••${key.substring(key.length - 4)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(key);
                                setCopiedGroqKeys(prev => {
                                  const next = new Set(prev);
                                  next.add(i);
                                  return next;
                                });
                                setTimeout(() => {
                                  setCopiedGroqKeys(prev => {
                                    const next = new Set(prev);
                                    next.delete(i);
                                    return next;
                                  });
                                }, 2000);
                              }}
                              className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors shrink-0"
                              title="Copy API Key"
                            >
                              {copiedGroqKeys.has(i) ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setVisibleGroqKeys(prev => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                });
                              }}
                              className="p-1.5 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors shrink-0"
                            >
                              {visibleGroqKeys.has(i) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => onRemoveGroqKey(i)}
                              className="p-1.5 hover:bg-red-100 text-red-300 rounded-lg transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
