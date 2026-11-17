import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Info,
  X,
  Sparkles,
  Key,
  Layers,
  Edit3,
  Settings,
  Download,
  History,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CHANGELOG_DATA } from '../constants';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  const [expandedLogs, setExpandedLogs] = useState<string[]>([CHANGELOG_DATA[0]?.id || '']);

  const toggleLog = (id: string) => {
    setExpandedLogs(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
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
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Info className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Informasi Website</h2>
                  <p className="text-xs text-slate-500">Panduan fitur AI Metadata Generator</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 flex items-center justify-center mt-1">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Generate Metadata Otomatis</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Aplikasi ini menggunakan teknologi AI (Google Gemini) untuk menganalisis gambar Anda dan secara otomatis membuatkan Judul, Deskripsi, serta Kata Kunci (Keywords) yang relevan dan SEO-friendly untuk keperluan microstock.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-purple-50 flex items-center justify-center mt-1">
                    <Key className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Multi API Key (Rotasi)</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Anda dapat memasukkan lebih dari satu Gemini API Key. Sistem akan menggunakan key tersebut secara bergantian untuk menghindari limit (Rate Limit) dan mempercepat proses generate metadata dalam jumlah banyak.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center mt-1">
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Auto-Rotate Model AI</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Jika diaktifkan, saat model Gemini utama pilihan Anda mengalami kegagalan/limit (Rate Limit) pada semua API Key yang aktif, sistem akan memutar ke model Gemini alternatif secara dinamis agar seluruh proses batch tetap selesai. Jika dinonaktifkan, sistem hanya menggunakan model utama Anda dan langsung berhenti jika model tersebut limit.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-amber-50 flex items-center justify-center mt-1">
                    <Edit3 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Edit & Simpan Metadata</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hasil generate AI tidak selalu sempurna. Anda dapat mengedit Judul, Deskripsi, dan Kata Kunci secara manual langsung di dalam aplikasi, lalu menyimpannya sebelum mengunduh file CSV.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center mt-1">
                    <Settings className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Pengaturan Fleksibel</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Atur panjang minimal kata untuk Judul (5-20 kata) dan jumlah Kata Kunci (hingga 50 kata) sesuai dengan standar agensi microstock yang Anda tuju. Tersedia juga pilihan model AI yang bisa disesuaikan.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-rose-50 flex items-center justify-center mt-1">
                    <Download className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Export CSV Multi-Platform</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Unduh metadata dalam format CSV yang sudah disesuaikan dengan standar Freepik/Magnific, Adobe Stock, dan Shutterstock. Anda bisa memilih ekstensi file (.eps, .jpg, .png, .svg) dan memilih untuk mengunduh semua gambar atau hanya gambar yang dipilih.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  Perubahan Terbaru (Changelog)
                </h3>
                <div className="space-y-3">
                  {CHANGELOG_DATA.map((log) => {
                    const isExpanded = expandedLogs.includes(log.id);
                    return (
                      <div key={log.id} className="border border-slate-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleLog(log.id)}
                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {log.date} <span className="font-normal text-slate-500 ml-2">({log.title})</span>
                            </p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 bg-white border-t border-slate-100">
                                <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                                  {log.changes.map((change, idx) => (
                                    <li key={idx}>
                                      <span
                                        className={cn(
                                          'font-medium',
                                          change.type === 'new'
                                            ? 'text-emerald-600'
                                            : change.type === 'fix'
                                              ? 'text-rose-600'
                                              : 'text-blue-600'
                                        )}
                                      >
                                        {change.type === 'new' ? 'Fitur Baru:' : change.type === 'fix' ? 'Bug Fix:' : 'Peningkatan:'}
                                      </span>{' '}
                                      {change.text}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 text-center">
                  Dibuat untuk mempermudah alur kerja kontributor microstock.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
