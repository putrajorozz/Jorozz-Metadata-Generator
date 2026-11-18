import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Trash2, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Loader2,
  X,
  Copy,
  Check,
  Key,
  Plus,
  AlertCircle,
  Info,
  Menu,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  Star,
  Eye,
  EyeOff,
  Edit3,
  Search,
  Image as ImageIcon,
  FileText,
  Layers,
  MoreVertical,
  Pause,
  Play,
  Square,
  AlertTriangle,
  Chrome,
  Ruler
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import * as piexif from "piexifjs";
import JSZip from "jszip";
import { buildMicrostockPrompt, sanitizeMicrostockMetadata, cleanShutterstockText } from './lib/metadataUtils';
import { cn } from './lib/utils';

// Import new components
import { TopHeader } from './components/TopHeader';
import { AssetGrid } from './components/AssetGrid';
import { MetadataPanel } from './components/MetadataPanel';
import { BatchDownloadHub } from './components/BatchDownloadHub';
import { ShutterstockExtensionImporter } from './components/ShutterstockExtensionImporter';
import { FreepikDimensionCalculator } from './components/FreepikDimensionCalculator';
import { ApiKeyModal } from './components/ApiKeyModal';
import { InfoModal } from './components/InfoModal';
import { categorizeApiError, maskApiKey } from './lib/errorDiagnostics';
import { exportFreepikCSV, exportAdobeStockCSV, exportShutterstockCSV } from './lib/csvExporters';
import { useBatchGenerator } from './hooks/useBatchGenerator';

// Import constants and types
import { MODELS, GROQ_MODELS } from './constants';
import { ImageData, PngTreeMetadata, Toast, ErrorDiagnostic } from './types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'generator' | 'shutterstock_extension' | 'freepik_calculator'>('generator');
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'pngtree'>('standard');
  const {
    isGenerating,
    setIsGenerating,
    isPaused,
    setIsPaused,
    progress,
    setProgress,
    elapsedBeforePause,
    setElapsedBeforePause,
    isPausedRef,
    isCancelledRef,
    pausePromiseResolveRef,
    sessionStartTimeRef,
    lastSuccessKeyIndex,
    lastSuccessModelIndex,
    lastSuccessGroqModelIndex,
    autoRotateModel,
    toggleAutoRotateModel,
    autoRotateGroqModel,
    toggleAutoRotateGroqModel,
    autoRetryFailed,
    toggleAutoRetryFailed
  } = useBatchGenerator({
    onToast: (message, type) => addToast(message, type)
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const favorite = localStorage.getItem('favorite_model_id');
    if (favorite && MODELS.some(m => m.id === favorite)) return favorite;
    return MODELS[0].id;
  });
  const [keywordCount, setKeywordCount] = useState(50);
  const [titleLength, setTitleLength] = useState(100);
  const [isGenerativeAI, setIsGenerativeAI] = useState(false);
  const [aiModel, setAiModel] = useState('Google Nano Banana');
  const [exportExtension, setExportExtension] = useState<'.eps' | '.jpg' | '.png' | '.svg'>('.eps');
  const [exportPlatform, setExportPlatform] = useState<'Freepik' | 'Adobe' | 'Shutterstock' | null>(null);
  const [favoriteModelId, setFavoriteModelId] = useState<string | null>(() => localStorage.getItem('favorite_model_id') || null);
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [activePlatform, setActivePlatform] = useState<'Freepik' | 'Adobe Stock' | 'Shutterstock' | 'Dreamstime' | null>(null);
  const [activeDownloadMenu, setActiveDownloadMenu] = useState<{
    type: 'freepik' | 'adobe' | 'shutterstock' | 'dreamstime';
    targetImages?: ImageData[];
  } | null>(null);
  const [autoProcess, setAutoProcess] = useState(true);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [showSingleDownloadDropdown, setShowSingleDownloadDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const singleDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const chimeAudio = useRef<HTMLAudioElement | null>(null);
  const successAudio = useRef<HTMLAudioElement | null>(null);
  const completeAudio = useRef<HTMLAudioElement | null>(null);
  const downloadHubRef = useRef<HTMLDivElement>(null);

  const [audioVolume, setAudioVolume] = useState<number>(() => {
    const saved = localStorage.getItem('audio_volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('is_audio_muted');
    return saved === 'true';
  });

  useEffect(() => {
    chimeAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    successAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    completeAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3'); // Different sound for batch finish
  }, []);

  useEffect(() => {
    if (chimeAudio.current) {
      chimeAudio.current.volume = isAudioMuted ? 0 : audioVolume * 0.4;
      chimeAudio.current.muted = isAudioMuted;
    }
    if (successAudio.current) {
      successAudio.current.volume = isAudioMuted ? 0 : audioVolume * 0.5;
      successAudio.current.muted = isAudioMuted;
    }
    if (completeAudio.current) {
      completeAudio.current.volume = isAudioMuted ? 0 : audioVolume * 0.9;
      completeAudio.current.muted = isAudioMuted;
    }
  }, [audioVolume, isAudioMuted]);

  const handleVolumeChange = (newVolume: number) => {
    setAudioVolume(newVolume);
    localStorage.setItem('audio_volume', newVolume.toString());
  };

  const handleToggleMute = () => {
    setIsAudioMuted(prev => {
      const next = !prev;
      localStorage.setItem('is_audio_muted', next.toString());
      addToast(next ? "Audio DIBUNGKAM (Mute)" : "Audio DIAKTIFKAN (Unmute)", next ? "info" : "success");
      return next;
    });
  };

  const [styleHint, setStyleHint] = useState<string>(() => localStorage.getItem('style_hint') || '');
  const [excludedTitleWords, setExcludedTitleWords] = useState<string>(() => {
    const saved = localStorage.getItem('excluded_title_words');
    return saved !== null ? saved : 'set of, flat vector';
  });
  const [titlePreset, setTitlePreset] = useState<'commercial' | 'minimalist' | 'detailed' | 'ecommerce'>(() => {
    return (localStorage.getItem('title_preset') as any) || 'commercial';
  });

  useEffect(() => {
    localStorage.setItem('style_hint', styleHint);
  }, [styleHint]);

  useEffect(() => {
    localStorage.setItem('excluded_title_words', excludedTitleWords);
  }, [excludedTitleWords]);

  useEffect(() => {
    localStorage.setItem('title_preset', titlePreset);
  }, [titlePreset]);

  const handleOptimizeMetadata = useCallback((id: string) => {
    setImages(prev => prev.map(img => {
      if (img.id === id && img.metadata) {
        const sanitized = sanitizeMicrostockMetadata(img.metadata, keywordCount, excludedTitleWords);
        addToast("Metadata berhasil diformat & disanitasi secara SEO", "success");
        return {
          ...img,
          metadata: {
            ...img.metadata,
            ...sanitized
          }
        };
      }
      return img;
    }));
  }, [keywordCount]);

  const playChime = () => chimeAudio.current?.play().catch(() => {});
  const playSuccess = () => successAudio.current?.play().catch(() => {});
  const playComplete = () => completeAudio.current?.play().catch(() => {});

  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('gemini_api_keys');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Global AI Engine State ('gemini' | 'groq')
  const [aiEngine, setAiEngine] = useState<'gemini' | 'groq'>(() => {
    const saved = localStorage.getItem('global_ai_engine');
    return (saved as 'gemini' | 'groq') || 'gemini';
  });

  // Global Groq API Keys State
  const [groqKeys, setGroqKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('groq_api_keys');
    return saved ? JSON.parse(saved) : [];
  });

  // Global Groq Model Selection State
  const [selectedGroqModel, setSelectedGroqModel] = useState<string>(() => {
    return localStorage.getItem('global_groq_model') || 'meta-llama/llama-4-scout-17b-16e-instruct';
  });

  const [activeApiKey, setActiveApiKey] = useState<string | null>(null);
  const [errorApiKeys, setErrorApiKeys] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<number>>(new Set());
  
  const [activeKeyTab, setActiveKeyTab] = useState<'gemini' | 'groq'>('gemini');
  const [newGroqKey, setNewGroqKey] = useState('');
  const [visibleGroqKeys, setVisibleGroqKeys] = useState<Set<number>>(new Set());
  const [copiedGroqKeys, setCopiedGroqKeys] = useState<Set<number>>(new Set());

  // Dynamic Persist of Global Variables
  useEffect(() => {
    localStorage.setItem('global_ai_engine', aiEngine);
  }, [aiEngine]);

  useEffect(() => {
    localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys));
  }, [groqKeys]);

  useEffect(() => {
    localStorage.setItem('global_groq_model', selectedGroqModel);
  }, [selectedGroqModel]);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const toggleKeyVisibility = (index: number) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const [showInfoPage, setShowInfoPage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]); // Track job IDs
  const MAX_CONCURRENT = 3; // Limit parallel AI processing
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [newKey, setNewKey] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [lastGenerationDuration, setLastGenerationDuration] = useState<number | null>(null);
  const [activeModelDisplay, setActiveModelDisplay] = useState<string>('');
  const [activeKeyDisplay, setActiveKeyDisplay] = useState<string>('');
  const [currentStatusDetail, setCurrentStatusDetail] = useState<string>('');
  const [lastRotationWarning, setLastRotationWarning] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    let interval: any;
    if (isGenerating && !isPaused && sessionStartTimeRef.current) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 10);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isPaused]);

  const pauseGeneration = () => {
    if (!isGenerating || isPaused) return;
    isPausedRef.current = true;
    setIsPaused(true);
    const now = Date.now();
    if (sessionStartTimeRef.current) {
      setElapsedBeforePause(prev => prev + (now - sessionStartTimeRef.current!));
      sessionStartTimeRef.current = null;
    }
    addToast("⏸️ Proses generate dijeda (Paused)", "info");
  };

  const resumeGeneration = () => {
    if (!isGenerating || !isPaused) return;
    isPausedRef.current = false;
    setIsPaused(false);
    sessionStartTimeRef.current = Date.now();
    setCurrentTime(Date.now());
    if (pausePromiseResolveRef.current) {
      pausePromiseResolveRef.current();
      pausePromiseResolveRef.current = null;
    }
    addToast("▶️ Melanjutkan proses generate...", "info");
  };

  const stopGeneration = () => {
    if (!isGenerating) return;
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    if (pausePromiseResolveRef.current) {
      pausePromiseResolveRef.current();
      pausePromiseResolveRef.current = null;
    }

    const now = Date.now();
    const extra = sessionStartTimeRef.current ? (now - sessionStartTimeRef.current) : 0;
    const finalDuration = elapsedBeforePause + extra;
    setLastGenerationDuration(finalDuration > 0 ? finalDuration : null);

    setIsGenerating(false);
    setActiveModelDisplay('');
    setActiveKeyDisplay('');
    setCurrentStatusDetail('');
    setLastRotationWarning(null);
    setStartTime(null);
    setCurrentTime(null);
    setElapsedBeforePause(0);
    sessionStartTimeRef.current = null;
    setActiveApiKey(null);

    setImages(prev => prev.map(img => img.status === 'processing' ? { ...img, status: 'pending' } : img));
    addToast("⏹️ Proses generate dihentikan (Stopped)", "info");
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ 
    title: string; 
    description: string; 
    keywords: string;
    category1?: string;
    category2?: string;
    adobeCategory?: string;
    ptMainKeywords?: string;
    ptSecondaryKeywords?: string;
    ptMainCopy?: string;
    editorialRecommendation?: 'editorial' | 'commercial';
    editorialReasoning?: string;
    isAiSuspected?: boolean;
    aiDetectionReasoning?: string;
  } | null>(null);
  const [showBulkOptions, setShowBulkOptions] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(() => {
    const saved = localStorage.getItem('show_settings_panel');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('show_settings_panel', JSON.stringify(showSettingsPanel));
  }, [showSettingsPanel]);

  useEffect(() => {
    if (favoriteModelId) {
      localStorage.setItem('favorite_model_id', favoriteModelId);
    } else {
      localStorage.removeItem('favorite_model_id');
    }
  }, [favoriteModelId]);

  const startEditing = () => {
    if (selectedImage?.metadata) {
      setEditData({
        title: selectedImage.metadata.title,
        description: selectedImage.metadata.description,
        keywords: selectedImage.metadata.keywords.join(', '),
        category1: selectedImage.metadata.categories?.[0] || '',
        category2: selectedImage.metadata.categories?.[1] || '',
        adobeCategory: selectedImage.metadata.adobeCategory || '',
        ptMainKeywords: selectedImage.metadata.pngTree?.mainKeywords.join(', ') || '',
        ptSecondaryKeywords: selectedImage.metadata.pngTree?.secondaryKeywords.join(', ') || '',
        ptMainCopy: selectedImage.metadata.pngTree?.mainCopy || '',
        editorialRecommendation: selectedImage.metadata.editorialRecommendation || 'commercial',
        editorialReasoning: selectedImage.metadata.editorialReasoning || '',
        isAiSuspected: Boolean(selectedImage.metadata.isAiSuspected),
        aiDetectionReasoning: selectedImage.metadata.aiDetectionReasoning || ''
      });
      setIsEditing(true);
    }
  };

  const saveEdit = async () => {
    if (editData && selectedId) {
      const keywordsArray = editData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
      
      const updatedImage = images.find(img => img.id === selectedId);
      if (updatedImage && updatedImage.metadata) {
        const cat1 = editData.category1 !== undefined ? editData.category1.trim() : (updatedImage.metadata.categories?.[0] || '');
        const cat2 = editData.category2 !== undefined ? editData.category2.trim() : (updatedImage.metadata.categories?.[1] || '');
        const categoriesArray = [cat1, cat2].filter(Boolean);

        const adobeCat = editData.adobeCategory !== undefined ? editData.adobeCategory.trim() : (updatedImage.metadata.adobeCategory || '');

        const pngTreeData = updatedImage.metadata.pngTree ? {
          title: editData.title,
          mainKeywords: editData.ptMainKeywords ? editData.ptMainKeywords.split(',').map(k => k.trim()).filter(k => k !== '') : updatedImage.metadata.pngTree.mainKeywords,
          secondaryKeywords: editData.ptSecondaryKeywords ? editData.ptSecondaryKeywords.split(',').map(k => k.trim()).filter(k => k !== '') : updatedImage.metadata.pngTree.secondaryKeywords,
          mainCopy: editData.ptMainCopy ?? updatedImage.metadata.pngTree.mainCopy
        } : undefined;

        const newImage = {
          ...updatedImage,
          metadata: {
            ...updatedImage.metadata,
            title: editData.title,
            description: editData.description,
            keywords: keywordsArray,
            categories: categoriesArray,
            adobeCategory: adobeCat,
            editorialRecommendation: editData.editorialRecommendation || 'commercial',
            editorialReasoning: editData.editorialReasoning || '',
            isAiSuspected: editData.isAiSuspected !== undefined ? editData.isAiSuspected : Boolean(updatedImage.metadata.isAiSuspected),
            aiDetectionReasoning: editData.aiDetectionReasoning !== undefined ? editData.aiDetectionReasoning : (updatedImage.metadata.aiDetectionReasoning || ''),
            pngTree: pngTreeData
          }
        };
        
        setImages(prev => prev.map(img => img.id === selectedId ? newImage : img));
      }
      
      setIsEditing(false);
      setEditData(null);
      addToast("Metadata berhasil diperbarui", "success");
    }
  };

  useEffect(() => {
    setIsEditing(false);
    setEditData(null);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) {
      const element = document.getElementById(`image-item-${selectedId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDownloadDropdown(false);
      }
      if (singleDropdownRef.current && !singleDropdownRef.current.contains(event.target as Node)) {
        setShowSingleDownloadDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type }];
      return newToasts.length > 3 ? newToasts.slice(newToasts.length - 3) : newToasts;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    let duplicateCount = 0;
    try {
      const newImages: ImageData[] = [];
      
      // Get current hashes
      const existingHashes = new Set(images.map(img => img.hash).filter(Boolean));

      for (const file of acceptedFiles) {
        const hash = await getFileHash(file);
        
        if (existingHashes.has(hash)) {
          duplicateCount++;
          continue;
        }

        const blobUrl = await processImage(file);
        newImages.push({
          id: Math.random().toString(36).substring(7),
          file,
          preview: blobUrl,
          hash,
          status: 'pending' as const,
          isAiGenerated: false,
        });
        existingHashes.add(hash);
      }

      if (duplicateCount > 0) {
        addToast(`${duplicateCount} gambar duplikat dilewati`, "info");
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
        setSelectedId(newImages[0].id);
      }
    } catch (err) {
      console.error("Error creating previews", err);
      addToast("Gagal memproses beberapa gambar", "error");
    } finally {
      setIsUploading(false);
    }
  }, [images]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg']
    },
    multiple: true,
    noClick: true
  });

  const getErrorMessage = (error: any): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && error.type === 'error' && error.target instanceof FileReader) {
      return error.target.error ? error.target.error.message : "Gagal membaca file gambar";
    }
    if (error && error.type === 'error' && error.target instanceof Image) {
      return "Gagal memuat gambar";
    }
    return "Terjadi kesalahan yang tidak diketahui";
  };

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height); // Ensure transparency is cleared
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const mimeType = file.type === 'image/png' || file.type === 'image/svg+xml' ? 'image/png' : 'image/jpeg';
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error("Canvas to Blob failed"));
          }
        }, mimeType, mimeType === 'image/jpeg' ? 0.6 : 1.0);
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar untuk preview"));
      img.src = URL.createObjectURL(file);
    });
  };

  const removeImage = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Gambar',
      message: 'Apakah Anda yakin ingin menghapus gambar ini?',
      onConfirm: () => {
        setImages(prev => {
          const imgToRemove = prev.find(img => img.id === id);
          if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview);
          const filtered = prev.filter(img => img.id !== id);
          if (selectedId === id) {
            setSelectedId(filtered.length > 0 ? filtered[0].id : null);
          }
          return filtered;
        });
        addToast("Gambar dihapus", "info");
      }
    });
  };

  const selectedImage = useMemo(() => 
    images.find(img => img.id === selectedId), 
  [images, selectedId]);

  const generateMetadata = async () => {
    if (images.length === 0 || isGenerating) return;

    if (aiEngine === 'gemini') {
      if (apiKeys.length === 0) {
        addToast("Silakan masukkan API Key Anda terlebih dahulu untuk memulai", "error");
        setShowKeyModal(true);
        return;
      }
    } else {
      if (groqKeys.length === 0) {
        addToast("Silakan masukkan Groq API Key Anda terlebih dahulu untuk memulai", "error");
        setShowKeyModal(true);
        return;
      }
    }

    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsGenerating(true);
    setProgress(0);
    setErrorApiKeys([]);
    const batchStartTime = Date.now();
    sessionStartTimeRef.current = batchStartTime;
    setStartTime(batchStartTime);
    setCurrentTime(batchStartTime);
    setElapsedBeforePause(0);
    setLastGenerationDuration(null);

    const pendingImages = images.filter(img => img.status !== 'completed');
    let completedCount = 0;
    const failedImageIds: string[] = [];

    // Use current successful indices as starting point
    let currentKeyIndex = lastSuccessKeyIndex.current % (aiEngine === 'gemini' ? apiKeys.length : groqKeys.length);
    let modelIndex = autoRotateModel ? (lastSuccessModelIndex.current % MODELS.length) : MODELS.findIndex(m => m.id === selectedModel);
    if (modelIndex === -1) modelIndex = 0;
    
    let groqModelIndex = autoRotateGroqModel ? (lastSuccessGroqModelIndex.current % GROQ_MODELS.length) : GROQ_MODELS.findIndex(m => m.id === selectedGroqModel);
    if (groqModelIndex === -1) groqModelIndex = 0;

    for (const img of pendingImages) {
      if (isCancelledRef.current) {
        break;
      }

      if (isPausedRef.current) {
        await new Promise<void>(resolve => {
          pausePromiseResolveRef.current = resolve;
        });
        if (isCancelledRef.current) {
          break;
        }
      }

      const imageStartTime = Date.now();
      setSelectedId(img.id);

      let success = false;
      let lastErrorMessage = "Semua API Key dan Model gagal atau kuota habis";
      let lastDiagnostic: ErrorDiagnostic | undefined;

      if (aiEngine === 'gemini') {
        let modelsTried = 0;
        const totalModels = autoRotateModel ? MODELS.length : 1;

        // Outer loop: Models
        while (!success && modelsTried < totalModels) {
          const currentModelId = MODELS[modelIndex].id;
          const currentModelName = MODELS[modelIndex].name;
          let keysTried = 0;
          const totalKeys = apiKeys.length;

          // Inner loop: Keys
          while (!success && keysTried < totalKeys) {
            // Normalize key index
            const actualKeyIndex = currentKeyIndex % totalKeys;
            const currentKey = apiKeys[actualKeyIndex];
            const maskedKey = maskApiKey(currentKey, actualKeyIndex);
            
            setActiveApiKey(currentKey);
            setActiveModelDisplay(currentModelName);
            setActiveKeyDisplay(maskedKey);
            setCurrentStatusDetail(`Menganalisis visual dengan ${currentModelName} [${maskedKey}]`);

            setImages(prev => prev.map(i => 
              i.id === img.id ? { ...i, status: 'processing', activeModel: currentModelName, activeKey: maskedKey } : i
            ));

            const ai = new GoogleGenAI({ apiKey: currentKey });

            try {
              // Read file as base64
              const reader = new FileReader();
              const base64Data = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve((reader.result as string).split(",")[1]);
                reader.onerror = () => reject(new Error(reader.error?.message || "Gagal membaca file gambar"));
                reader.readAsDataURL(img.file);
              });
              
              let mimeType = img.file.type || "image/jpeg";
              const isTransparent = img.file.type === 'image/png' || img.file.type === 'image/svg+xml';
              
              const promptText = buildMicrostockPrompt({
                isTransparent,
                titleLength,
                keywordCount,
                styleHint,
                excludedTitleWords,
                titlePreset
              });
              
              const response = await ai.models.generateContent({
                model: currentModelId,
                contents: {
                  parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: promptText },
                  ],
                },
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                      categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                      adobeCategory: { type: Type.STRING },
                      pngTreeMainKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                      pngTreeSecondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                      pngTreeMainCopy: { type: Type.STRING },
                      editorialRecommendation: { type: Type.STRING },
                      editorialReasoning: { type: Type.STRING },
                      isAiSuspected: { type: Type.BOOLEAN },
                      aiDetectionReasoning: { type: Type.STRING }
                    },
                    required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy", "editorialRecommendation", "editorialReasoning", "isAiSuspected", "aiDetectionReasoning"]
                  }
                }
              });

              if (!response.text) {
                throw new Error("Empty response from Gemini API");
              }

              const result = JSON.parse(response.text);
              const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);
              
              const updatedMetadata = {
                title: sanitized.title,
                description: sanitized.description,
                keywords: sanitized.keywords,
                categories: sanitized.categories,
                adobeCategory: sanitized.adobeCategory,
                editorialRecommendation: sanitized.editorialRecommendation as any,
                editorialReasoning: sanitized.editorialReasoning,
                isAiSuspected: sanitized.isAiSuspected,
                aiDetectionReasoning: sanitized.aiDetectionReasoning,
                prompt: promptText,
                model: currentModelId,
                usedModel: MODELS[modelIndex].name,
                usedApiKey: currentKey.slice(-4),
                pngTree: sanitized.pngTree
              };

              const duration = Date.now() - imageStartTime;
              setImages(prev => prev.map(i => i.id === img.id ? { 
                ...i, 
                status: 'completed', 
                metadata: updatedMetadata, 
                processingTime: duration,
                activeModel: currentModelName,
                activeKey: maskedKey,
                error: undefined,
                errorDiagnostic: undefined
              } : i));
              success = true;
              setLastRotationWarning(null);
              
              // SAVE successful pair
              lastSuccessKeyIndex.current = actualKeyIndex;
              lastSuccessModelIndex.current = modelIndex;
              
              addToast(`Berhasil generate: ${img.file.name}`, "success");
              playChime();
            } catch (error) {
              console.error(`Error with key ${actualKeyIndex} on model ${currentModelId}:`, error);
              const diag = categorizeApiError(error, { modelName: currentModelName, keyMasked: maskedKey });
              lastDiagnostic = diag;
              lastErrorMessage = diag.description || getErrorMessage(error);
              setErrorApiKeys(prev => [...new Set([...prev, currentKey])]);
              
              if (totalKeys > 1) {
                setLastRotationWarning({
                  message: `${diag.badge} pada ${maskedKey} (${currentModelName}) → Merotasi ke API Key berikutnya...`,
                  type: diag.type
                });

                if (diag.type === 'rate_limit') {
                  addToast(`⚠️ Rate Limit (429) ${maskedKey} → Mencoba Key berikutnya...`, "error");
                } else if (diag.type === 'model_not_found') {
                  addToast(`⚠️ Model ${currentModelName} tidak tersedia (404) → Rotasi model...`, "error");
                } else if (diag.type === 'invalid_key') {
                  addToast(`⚠️ ${maskedKey} Tidak Valid → Mencoba Key berikutnya...`, "error");
                }
              } else {
                setLastRotationWarning({
                  message: `${diag.badge} pada ${currentModelName} [1 Key Terdaftar] → Merotasi ke Model berikutnya...`,
                  type: diag.type
                });

                if (diag.type === 'rate_limit') {
                  addToast(`⚠️ Rate Limit (429) pada ${currentModelName} (1 Key) → Rotasi Model...`, "error");
                } else if (diag.type === 'model_not_found') {
                  addToast(`⚠️ Model ${currentModelName} tidak tersedia (404) → Rotasi Model...`, "error");
                } else if (diag.type === 'invalid_key') {
                  addToast(`⚠️ Key tidak valid → Rotasi Model...`, "error");
                }
              }
              
              // Try next key for the SAME model
              currentKeyIndex++;
              keysTried++;
            }
          }

          if (!success) {
            // All keys failed for this model, rotate to next model
            const prevModelName = MODELS[modelIndex].name;
            modelIndex = (modelIndex + 1) % MODELS.length;
            // IMPORTANT: reset key index to 0 so we try all keys for the NEW model
            currentKeyIndex = 0; 
            modelsTried++;
            
            if (modelsTried < totalModels) {
              setLastRotationWarning({
                message: totalKeys > 1 
                  ? `Semua key gagal pada ${prevModelName} → Mencoba model ${MODELS[modelIndex].name}...`
                  : `Limit pada ${prevModelName} → Merotasi ke model ${MODELS[modelIndex].name}...`,
                type: 'model_not_found'
              });
              addToast(`🔄 Rotasi Model: Mencoba ${MODELS[modelIndex].name}`, "info");
            }
          }
        }
      } else {
        // Groq Engine Logic with Model & Key Rotation
        let modelsTried = 0;
        const totalModels = autoRotateGroqModel ? GROQ_MODELS.length : 1;

        // Outer loop: Groq Models
        while (!success && modelsTried < totalModels) {
          const currentModelId = GROQ_MODELS[groqModelIndex].id;
          const currentModelName = GROQ_MODELS[groqModelIndex].name;
          let keysTried = 0;
          const totalKeys = groqKeys.length;

          // Inner loop: Groq Keys
          while (!success && keysTried < totalKeys) {
            const actualKeyIndex = currentKeyIndex % totalKeys;
            const activeKey = groqKeys[actualKeyIndex];
            const maskedKey = maskApiKey(activeKey, actualKeyIndex);

            setActiveApiKey(activeKey);
            setActiveModelDisplay(currentModelName);
            setActiveKeyDisplay(maskedKey);
            setCurrentStatusDetail(`Menganalisis visual dengan Groq ${currentModelName} [${maskedKey}]`);

            setImages(prev => prev.map(i => 
              i.id === img.id ? { ...i, status: 'processing', activeModel: currentModelName, activeKey: maskedKey } : i
            ));

            try {
              // Read file as base64
              const reader = new FileReader();
              const base64Data = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve((reader.result as string).split(",")[1]);
                reader.onerror = () => reject(new Error(reader.error?.message || "Gagal membaca file gambar"));
                reader.readAsDataURL(img.file);
              });
              
              let mimeType = img.file.type || "image/jpeg";
              const isTransparent = img.file.type === 'image/png' || img.file.type === 'image/svg+xml';
              
              const promptText = buildMicrostockPrompt({
                isTransparent,
                titleLength,
                keywordCount,
                styleHint,
                excludedTitleWords,
                titlePreset
              });

              const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${activeKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: currentModelId,
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: promptText + "\nRemember: return a raw JSON object conforming EXACTLY to the requested schema. No markdown wrapping unless necessary."
                        },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:${mimeType};base64,${base64Data}`
                          }
                        }
                      ]
                    }
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0.2
                })
              });

              if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error?.message || `HTTP ${response.status}`);
              }

              const responseData = await response.json();
              let resultText = responseData.choices?.[0]?.message?.content?.trim() || '{}';
              
              if (resultText.startsWith('```')) {
                resultText = resultText.replace(/^```(?:json)?\n?|```$/g, '').trim();
              }

              const result = JSON.parse(resultText);
              const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);

              const updatedMetadata = {
                title: sanitized.title,
                description: sanitized.description,
                keywords: sanitized.keywords,
                categories: sanitized.categories,
                adobeCategory: sanitized.adobeCategory,
                editorialRecommendation: sanitized.editorialRecommendation as any,
                editorialReasoning: sanitized.editorialReasoning,
                isAiSuspected: sanitized.isAiSuspected,
                aiDetectionReasoning: sanitized.aiDetectionReasoning,
                prompt: promptText,
                model: currentModelId,
                usedModel: "Groq " + (
                  currentModelId.includes("llama-4-scout") ? "Llama 4 Scout" :
                  currentModelId.includes("llama-4-maverick") ? "Llama 4 Maverick" :
                  currentModelId.includes("90b") ? "90B" : "11B"
                ),
                usedApiKey: activeKey.slice(-4),
                pngTree: sanitized.pngTree
              };

              const duration = Date.now() - imageStartTime;
              setImages(prev => prev.map(i => i.id === img.id ? { 
                ...i, 
                status: 'completed', 
                metadata: updatedMetadata, 
                processingTime: duration,
                activeModel: currentModelName,
                activeKey: maskedKey,
                error: undefined,
                errorDiagnostic: undefined
              } : i));
              success = true;
              setLastRotationWarning(null);
              lastSuccessKeyIndex.current = actualKeyIndex;
              lastSuccessGroqModelIndex.current = groqModelIndex;
              addToast(`Berhasil generate: ${img.file.name}`, "success");
              playChime();
            } catch (error: any) {
              console.error(`Error with keyIndex ${actualKeyIndex} on model ${currentModelId}:`, error);
              const diag = categorizeApiError(error, { modelName: currentModelName, keyMasked: maskedKey });
              lastDiagnostic = diag;
              lastErrorMessage = diag.description || (error.message || error);
              
              if (totalKeys > 1) {
                setLastRotationWarning({
                  message: `${diag.badge} pada ${maskedKey} (${currentModelName}) → Merotasi Groq key...`,
                  type: diag.type
                });
              } else {
                setLastRotationWarning({
                  message: `${diag.badge} pada ${currentModelName} [1 Groq Key] → Merotasi ke Model Groq berikutnya...`,
                  type: diag.type
                });
              }
              
              currentKeyIndex++;
              keysTried++;
            }
          }

          if (!success) {
            // All keys failed for this model, rotate to next Groq model
            const prevModelName = GROQ_MODELS[groqModelIndex].name;
            groqModelIndex = (groqModelIndex + 1) % GROQ_MODELS.length;
            currentKeyIndex = 0; 
            modelsTried++;
            
            if (modelsTried < totalModels) {
              setLastRotationWarning({
                message: totalKeys > 1 
                  ? `Semua key gagal pada ${prevModelName} → Mencoba model Groq ${GROQ_MODELS[groqModelIndex].name}...`
                  : `Limit pada ${prevModelName} → Merotasi ke model Groq ${GROQ_MODELS[groqModelIndex].name}...`,
                type: 'model_not_found'
              });
              addToast(`🔄 Rotasi Model Groq: Mencoba ${GROQ_MODELS[groqModelIndex].name}`, "info");
            }
          }
        }
      }

      if (!success) {
        failedImageIds.push(img.id);
        setImages(prev => prev.map(i => 
          i.id === img.id ? { 
            ...i, 
            status: 'error', 
            error: lastErrorMessage,
            errorDiagnostic: lastDiagnostic
          } : i
        ));
        addToast(`Gagal generate: ${img.file.name}`, "error");
      }

      completedCount++;
      setProgress((completedCount / pendingImages.length) * 100);
    }

    // Auto-Retry background pass if enabled and there are failed images
    if (!isCancelledRef.current && autoRetryFailed && failedImageIds.length > 0) {
      addToast(`⚡ Auto-Retry: Menjalankan percobaan ulang untuk ${failedImageIds.length} gambar yang gagal...`, "info");
      const recoveredCount = await processAutoRetryBatch(failedImageIds);
      if (recoveredCount > 0) {
        addToast(`🎉 Auto-Retry Selesai! ${recoveredCount} dari ${failedImageIds.length} gambar berhasil dipulihkan.`, "success");
      }
    }

    const now = Date.now();
    const extra = sessionStartTimeRef.current ? (now - sessionStartTimeRef.current) : 0;
    const finalDuration = elapsedBeforePause + extra;

    setIsGenerating(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setActiveModelDisplay('');
    setActiveKeyDisplay('');
    setCurrentStatusDetail('');
    setLastRotationWarning(null);
    setLastGenerationDuration(finalDuration > 0 ? finalDuration : null);
    setStartTime(null);
    setCurrentTime(null);
    setElapsedBeforePause(0);
    sessionStartTimeRef.current = null;
    setActiveApiKey(null);
    
    if (!isCancelledRef.current) {
      // Check if we just finished the batch
      addToast("Semua gambar berhasil diproses!", "success");
      playComplete(); 
      
      // Auto scroll with robust calculation and 800ms delay to ensure layout is settled
      setTimeout(() => {
        if (downloadHubRef.current) {
          const elementRect = downloadHubRef.current.getBoundingClientRect();
          const absoluteElementTop = elementRect.top + window.pageYOffset;
          const scrollToY = absoluteElementTop - 120;
          
          window.scrollTo({
            top: scrollToY,
            behavior: 'smooth'
          });
        }
      }, 800);
    }
  };

  const processAutoRetryBatch = async (failedIds: string[]): Promise<number> => {
    if (failedIds.length === 0) return 0;

    const activeKeys = aiEngine === 'gemini' ? apiKeys : groqKeys;
    if (activeKeys.length === 0) return 0;

    let recoveredCount = 0;

    for (let i = 0; i < failedIds.length; i++) {
      if (isCancelledRef.current) break;

      if (isPausedRef.current) {
        await new Promise<void>(resolve => {
          pausePromiseResolveRef.current = resolve;
        });
        if (isCancelledRef.current) break;
      }

      const id = failedIds[i];

      let currentImg: ImageData | undefined;
      setImages(prev => {
        currentImg = prev.find(item => item.id === id);
        if (currentImg) {
          return prev.map(item => item.id === id ? { ...item, status: 'processing', error: undefined } : item);
        }
        return prev;
      });

      if (!currentImg) continue;
      setSelectedId(id);

      const imageStartTime = Date.now();
      let success = false;
      let lastErrorMessage = "Auto-retry gagal pada semua API key";

      if (aiEngine === 'gemini') {
        const totalKeys = apiKeys.length;
        let keysTried = 0;
        let startKeyIdx = (lastSuccessKeyIndex.current + 1) % totalKeys;
        let modelIndex = autoRotateModel ? (lastSuccessModelIndex.current % MODELS.length) : MODELS.findIndex(m => m.id === selectedModel);
        if (modelIndex === -1) modelIndex = 0;
        const currentModelId = MODELS[modelIndex].id;

        while (!success && keysTried < totalKeys) {
          const actualKeyIndex = (startKeyIdx + keysTried) % totalKeys;
          const currentKey = apiKeys[actualKeyIndex];
          setActiveApiKey(currentKey);

          try {
            const ai = new GoogleGenAI({ apiKey: currentKey });
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
              reader.readAsDataURL(currentImg!.file);
            });

            let mimeType = currentImg!.file.type || "image/jpeg";
            const isTransparent = currentImg!.file.type === 'image/png' || currentImg!.file.type === 'image/svg+xml';
            const promptText = buildMicrostockPrompt({ isTransparent, titleLength, keywordCount, styleHint, titlePreset, excludedTitleWords });

            const response = await ai.models.generateContent({
              model: currentModelId,
              contents: {
                parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: promptText },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                    adobeCategory: { type: Type.STRING },
                    pngTreeMainKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeSecondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeMainCopy: { type: Type.STRING },
                    editorialRecommendation: { type: Type.STRING },
                    editorialReasoning: { type: Type.STRING },
                    isAiSuspected: { type: Type.BOOLEAN },
                    aiDetectionReasoning: { type: Type.STRING }
                  },
                  required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy", "editorialRecommendation", "editorialReasoning", "isAiSuspected", "aiDetectionReasoning"]
                }
              }
            });

            if (!response.text) throw new Error("Empty response from Gemini API");
            const result = JSON.parse(response.text);
            const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);

            const updatedMetadata = {
              title: sanitized.title,
              description: sanitized.description,
              keywords: sanitized.keywords,
              categories: sanitized.categories,
              adobeCategory: sanitized.adobeCategory,
              editorialRecommendation: sanitized.editorialRecommendation as any,
              editorialReasoning: sanitized.editorialReasoning,
              isAiSuspected: sanitized.isAiSuspected,
              aiDetectionReasoning: sanitized.aiDetectionReasoning,
              prompt: promptText,
              model: currentModelId,
              usedModel: MODELS[modelIndex].name,
              usedApiKey: currentKey.slice(-4),
              pngTree: sanitized.pngTree
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(item => item.id === id ? { ...item, status: 'completed', metadata: updatedMetadata, processingTime: duration } : item));
            success = true;
            recoveredCount++;
            lastSuccessKeyIndex.current = actualKeyIndex;
            addToast(`✨ Auto-Retry Dipulihkan: ${currentImg!.file.name}`, "success");
            playChime();
          } catch (err: any) {
            console.error(`Auto-Retry Gemini key error (${actualKeyIndex}):`, err);
            lastErrorMessage = getErrorMessage(err);
            setErrorApiKeys(prev => [...new Set([...prev, currentKey])]);
            keysTried++;
          }
        }
      } else {
        const totalKeys = groqKeys.length;
        let keysTried = 0;
        let startKeyIdx = (lastSuccessKeyIndex.current + 1) % totalKeys;
        let groqModelIndex = autoRotateGroqModel ? (lastSuccessGroqModelIndex.current % GROQ_MODELS.length) : GROQ_MODELS.findIndex(m => m.id === selectedGroqModel);
        if (groqModelIndex === -1) groqModelIndex = 0;
        const currentModelId = GROQ_MODELS[groqModelIndex].id;

        while (!success && keysTried < totalKeys) {
          const actualKeyIndex = (startKeyIdx + keysTried) % totalKeys;
          const activeKey = groqKeys[actualKeyIndex];
          setActiveApiKey(activeKey);

          try {
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
              reader.readAsDataURL(currentImg!.file);
            });

            let mimeType = currentImg!.file.type || "image/jpeg";
            const isTransparent = currentImg!.file.type === 'image/png' || currentImg!.file.type === 'image/svg+xml';
            const promptText = buildMicrostockPrompt({ isTransparent, titleLength, keywordCount, styleHint, titlePreset, excludedTitleWords });

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${activeKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: currentModelId,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: promptText + "\nRemember: return raw JSON object."
                      },
                      {
                        type: "image_url",
                        image_url: { url: `data:${mimeType};base64,${base64Data}` }
                      }
                    ]
                  }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2
              })
            });

            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody.error?.message || `HTTP ${response.status}`);
            }

            const responseData = await response.json();
            let resultText = responseData.choices?.[0]?.message?.content?.trim() || '{}';
            if (resultText.startsWith('```')) {
              resultText = resultText.replace(/^```(?:json)?\n?|```$/g, '').trim();
            }

            const result = JSON.parse(resultText);
            const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);

            const updatedMetadata = {
              title: sanitized.title,
              description: sanitized.description,
              keywords: sanitized.keywords,
              categories: sanitized.categories,
              adobeCategory: sanitized.adobeCategory,
              editorialRecommendation: sanitized.editorialRecommendation as any,
              editorialReasoning: sanitized.editorialReasoning,
              isAiSuspected: sanitized.isAiSuspected,
              aiDetectionReasoning: sanitized.aiDetectionReasoning,
              prompt: promptText,
              model: currentModelId,
              usedModel: "Groq " + (
                currentModelId.includes("llama-4-scout") ? "Llama 4 Scout" :
                currentModelId.includes("llama-4-maverick") ? "Llama 4 Maverick" :
                currentModelId.includes("90b") ? "90B" : "11B"
              ),
              usedApiKey: activeKey.slice(-4),
              pngTree: sanitized.pngTree
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(item => item.id === id ? { ...item, status: 'completed', metadata: updatedMetadata, processingTime: duration } : item));
            success = true;
            recoveredCount++;
            lastSuccessKeyIndex.current = actualKeyIndex;
            addToast(`✨ Auto-Retry Dipulihkan: ${currentImg!.file.name}`, "success");
            playChime();
          } catch (err: any) {
            console.error(`Auto-Retry Groq key error (${actualKeyIndex}):`, err);
            lastErrorMessage = err.message || err;
            keysTried++;
          }
        }
      }

      if (!success) {
        setImages(prev => prev.map(item => item.id === id ? { ...item, status: 'error', error: lastErrorMessage } : item));
      }
    }

    return recoveredCount;
  };

  const handleManualAutoRetry = async () => {
    const failedIds = images.filter(i => i.status === 'error').map(i => i.id);
    if (failedIds.length === 0) {
      addToast("Tidak ada gambar yang gagal untuk di-retry", "info");
      return;
    }
    if (isGenerating) return;

    isCancelledRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    setIsGenerating(true);
    const batchStartTime = Date.now();
    sessionStartTimeRef.current = batchStartTime;
    setStartTime(batchStartTime);
    setCurrentTime(batchStartTime);
    setElapsedBeforePause(0);

    const recovered = await processAutoRetryBatch(failedIds);

    const now = Date.now();
    const extra = sessionStartTimeRef.current ? (now - sessionStartTimeRef.current) : 0;
    const finalDuration = elapsedBeforePause + extra;

    if (recovered > 0) {
      addToast(`🎉 Auto-Retry Selesai! ${recovered} dari ${failedIds.length} gambar berhasil dipulihkan.`, "success");
    } else if (!isCancelledRef.current) {
      addToast("Auto-Retry selesai. Semua API key telah dicoba.", "info");
    }

    setIsGenerating(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setLastGenerationDuration(finalDuration > 0 ? finalDuration : null);
    setStartTime(null);
    setCurrentTime(null);
    setElapsedBeforePause(0);
    sessionStartTimeRef.current = null;
    setActiveApiKey(null);
  };

  const regenerateSingleMetadata = async (id: string) => {
    const img = images.find(i => i.id === id);
    if (!img || isGenerating) return;

    if (aiEngine === 'gemini') {
      if (apiKeys.length === 0) {
        addToast("Silakan masukkan API Key Anda terlebih dahulu untuk memulai", "error");
        setShowKeyModal(true);
        return;
      }
    } else {
      if (groqKeys.length === 0) {
        addToast("Silakan masukkan Groq API Key Anda terlebih dahulu untuk memulai", "error");
        setShowKeyModal(true);
        return;
      }
    }

    setSelectedId(id);
    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));
    setErrorApiKeys([]);
    const batchStartTime = Date.now();
    setStartTime(batchStartTime);
    setCurrentTime(batchStartTime);
    setLastGenerationDuration(null);
    setIsGenerating(true);
    
    let currentKeyIndex = lastSuccessKeyIndex.current % (aiEngine === 'gemini' ? apiKeys.length : groqKeys.length);
    let modelIndex = autoRotateModel ? (lastSuccessModelIndex.current % MODELS.length) : MODELS.findIndex(m => m.id === selectedModel);
    if (modelIndex === -1) modelIndex = 0;
    
    let groqModelIndex = autoRotateGroqModel ? (lastSuccessGroqModelIndex.current % GROQ_MODELS.length) : GROQ_MODELS.findIndex(m => m.id === selectedGroqModel);
    if (groqModelIndex === -1) groqModelIndex = 0;

    let success = false;
    let lastErrorMessage = "Semua API Key gagal atau kuota habis";
    let lastDiagnostic: ErrorDiagnostic | undefined;
    const imageStartTime = Date.now();

    if (aiEngine === 'gemini') {
      let modelsTried = 0;
      const totalModels = autoRotateModel ? MODELS.length : 1;

      while (!success && modelsTried < totalModels) {
        const currentModelId = MODELS[modelIndex].id;
        const currentModelName = MODELS[modelIndex].name;
        let keysTried = 0;
        const totalKeys = apiKeys.length;

        while (!success && keysTried < totalKeys) {
          const actualKeyIndex = currentKeyIndex % totalKeys;
          const currentKey = apiKeys[actualKeyIndex];
          const maskedKey = maskApiKey(currentKey, actualKeyIndex);
          
          setActiveApiKey(currentKey);
          setActiveModelDisplay(currentModelName);
          setActiveKeyDisplay(maskedKey);
          setCurrentStatusDetail(`Menganalisis visual dengan ${currentModelName} [${maskedKey}]`);

          setImages(prev => prev.map(i => 
            i.id === id ? { ...i, status: 'processing', activeModel: currentModelName, activeKey: maskedKey } : i
          ));

          const ai = new GoogleGenAI({ apiKey: currentKey });

          try {
            // Read file as base64
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = () => reject(new Error(reader.error?.message || "Gagal membaca file gambar"));
              reader.readAsDataURL(img.file);
            });
            
            let mimeType = img.file.type || "image/jpeg";
            const isTransparent = img.file.type === 'image/png' || img.file.type === 'image/svg+xml';
            
            const promptText = buildMicrostockPrompt({
              isTransparent,
              titleLength,
              keywordCount,
              styleHint,
              excludedTitleWords,
              titlePreset
            });
            
            const response = await ai.models.generateContent({
              model: currentModelId,
              contents: {
                parts: [
                  { inlineData: { mimeType: mimeType, data: base64Data } },
                  { text: promptText },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                    adobeCategory: { type: Type.STRING },
                    pngTreeMainKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeSecondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeMainCopy: { type: Type.STRING },
                    editorialRecommendation: { type: Type.STRING },
                    editorialReasoning: { type: Type.STRING },
                    isAiSuspected: { type: Type.BOOLEAN },
                    aiDetectionReasoning: { type: Type.STRING }
                  },
                  required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy", "editorialRecommendation", "editorialReasoning", "isAiSuspected", "aiDetectionReasoning"]
                }
              }
            });

            if (!response.text) {
              throw new Error("Empty response from Gemini API");
            }

            const result = JSON.parse(response.text);
            const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);

            const updatedMetadata = {
              title: sanitized.title,
              description: sanitized.description,
              keywords: sanitized.keywords,
              categories: sanitized.categories,
              adobeCategory: sanitized.adobeCategory,
              editorialRecommendation: sanitized.editorialRecommendation as any,
              editorialReasoning: sanitized.editorialReasoning,
              isAiSuspected: sanitized.isAiSuspected,
              aiDetectionReasoning: sanitized.aiDetectionReasoning,
              prompt: promptText,
              model: currentModelId,
              usedModel: MODELS[modelIndex].name,
              usedApiKey: currentKey.slice(-4),
              pngTree: sanitized.pngTree
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(i => i.id === id ? { 
              ...i, 
              status: 'completed', 
              metadata: updatedMetadata, 
              processingTime: duration,
              activeModel: currentModelName,
              activeKey: maskedKey,
              error: undefined,
              errorDiagnostic: undefined
            } : i));
            success = true;

            // SAVE successful pair
            lastSuccessKeyIndex.current = actualKeyIndex;
            lastSuccessModelIndex.current = modelIndex;

            addToast(`Berhasil regenerate: ${img.file.name}`, "success");
            playChime();
          } catch (error: any) {
            console.error(`Error with key ${actualKeyIndex} on model ${currentModelId}:`, error);
            const diag = categorizeApiError(error, { modelName: currentModelName, keyMasked: maskedKey });
            lastDiagnostic = diag;
            lastErrorMessage = diag.description || getErrorMessage(error);
            setErrorApiKeys(prev => [...new Set([...prev, currentKey])]);
            
            currentKeyIndex++;
            keysTried++;
          }
        }

        if (!success) {
          // Rotate to next model
          modelIndex = (modelIndex + 1) % MODELS.length;
          currentKeyIndex = 0;
          modelsTried++;
          if (modelsTried < totalModels) {
            addToast(`Pencarian resource... mencoba model ${MODELS[modelIndex].name}`, "info");
          }
        }
      }
    } else {
      // Groq Single Regeneration Engine Logic with Model & Key Rotation
      let modelsTried = 0;
      const totalModels = autoRotateGroqModel ? GROQ_MODELS.length : 1;

      while (!success && modelsTried < totalModels) {
        const currentModelId = GROQ_MODELS[groqModelIndex].id;
        const currentModelName = GROQ_MODELS[groqModelIndex].name;
        let keysTried = 0;
        const totalKeys = groqKeys.length;

        while (!success && keysTried < totalKeys) {
          const actualKeyIndex = currentKeyIndex % totalKeys;
          const activeKey = groqKeys[actualKeyIndex];
          const maskedKey = maskApiKey(activeKey, actualKeyIndex);

          setActiveApiKey(activeKey);
          setActiveModelDisplay(currentModelName);
          setActiveKeyDisplay(maskedKey);
          setCurrentStatusDetail(`Menganalisis visual dengan Groq ${currentModelName} [${maskedKey}]`);

          setImages(prev => prev.map(i => 
            i.id === id ? { ...i, status: 'processing', activeModel: currentModelName, activeKey: maskedKey } : i
          ));

          try {
            // Read file as base64
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = () => reject(new Error(reader.error?.message || "Gagal membaca file gambar"));
              reader.readAsDataURL(img.file);
            });
            
            let mimeType = img.file.type || "image/jpeg";
            const isTransparent = img.file.type === 'image/png' || img.file.type === 'image/svg+xml';
            
            const promptText = buildMicrostockPrompt({
              isTransparent,
              titleLength,
              keywordCount,
              styleHint,
              excludedTitleWords,
              titlePreset
            });

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${activeKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: currentModelId,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: promptText + "\nRemember: return a raw JSON object conforming EXACTLY to the requested schema. No markdown wrapping unless necessary."
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:${mimeType};base64,${base64Data}`
                        }
                      }
                    ]
                  }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2
              })
            });

            if (!response.ok) {
              throw new Error(await response.json().catch(() => ({})).then(b => b.error?.message || `HTTP ${response.status}`));
            }

            const responseData = await response.json();
            let resultText = responseData.choices?.[0]?.message?.content?.trim() || '{}';
            
            if (resultText.startsWith('```')) {
              resultText = resultText.replace(/^```(?:json)?\n?|```$/g, '').trim();
            }

            const result = JSON.parse(resultText);
            const sanitized = sanitizeMicrostockMetadata(result, keywordCount, excludedTitleWords);

            const updatedMetadata = {
              title: sanitized.title,
              description: sanitized.description,
              keywords: sanitized.keywords,
              categories: sanitized.categories,
              adobeCategory: sanitized.adobeCategory,
              editorialRecommendation: sanitized.editorialRecommendation as any,
              editorialReasoning: sanitized.editorialReasoning,
              isAiSuspected: sanitized.isAiSuspected,
              aiDetectionReasoning: sanitized.aiDetectionReasoning,
              prompt: promptText,
              model: currentModelId,
              usedModel: "Groq " + (
                currentModelId.includes("llama-4-scout") ? "Llama 4 Scout" :
                currentModelId.includes("llama-4-maverick") ? "Llama 4 Maverick" :
                currentModelId.includes("90b") ? "90B" : "11B"
              ),
              usedApiKey: activeKey.slice(-4),
              pngTree: sanitized.pngTree
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(i => i.id === id ? { 
              ...i, 
              status: 'completed', 
              metadata: updatedMetadata, 
              processingTime: duration,
              activeModel: currentModelName,
              activeKey: maskedKey,
              error: undefined,
              errorDiagnostic: undefined
            } : i));
            success = true;
            lastSuccessKeyIndex.current = actualKeyIndex;
            lastSuccessGroqModelIndex.current = groqModelIndex;
            addToast(`Berhasil regenerate: ${img.file.name}`, "success");
            playChime();
          } catch (error: any) {
            console.error(`Error with keyIndex ${actualKeyIndex} on model ${currentModelId}:`, error);
            const diag = categorizeApiError(error, { modelName: currentModelName, keyMasked: maskedKey });
            lastDiagnostic = diag;
            lastErrorMessage = diag.description || (error.message || error);
            currentKeyIndex++;
            keysTried++;
          }
        }

        if (!success) {
          groqModelIndex = (groqModelIndex + 1) % GROQ_MODELS.length;
          currentKeyIndex = 0;
          modelsTried++;
          if (modelsTried < totalModels) {
            addToast(`Pencarian resource... mencoba model ${GROQ_MODELS[groqModelIndex].name}`, "info");
          }
        }
      }
    }

    if (!success) {
      setImages(prev => prev.map(i => 
        i.id === id ? { 
          ...i, 
          status: 'error', 
          error: lastErrorMessage,
          errorDiagnostic: lastDiagnostic
        } : i
      ));
      addToast(`Gagal regenerate: ${img.file.name}`, "error");
    }
    setIsGenerating(false);
    setActiveModelDisplay('');
    setActiveKeyDisplay('');
    setCurrentStatusDetail('');
    setLastRotationWarning(null);
    setLastGenerationDuration(Date.now() - batchStartTime);
    setStartTime(null);
    setCurrentTime(null);
    setActiveApiKey(null);
  };

  const downloadCSV = (targetImages?: ImageData[]) => {
    const { count } = exportFreepikCSV({
      images: targetImages || images,
      exportExtension,
      isGenerativeAI,
      aiModel
    });
    if (count > 0) {
      addToast(count === 1 ? "CSV Freepik/Magnific Berhasil" : "CSV Bulk Freepik/Magnific Berhasil", "success");
    }
  };

  const downloadAdobeStockCSV = (targetImages?: ImageData[]) => {
    const { count } = exportAdobeStockCSV({
      images: targetImages || images,
      exportExtension
    });
    if (count > 0) {
      addToast(count === 1 ? "Adobe Stock CSV Berhasil" : "Adobe Stock Bulk Berhasil", "success");
    }
  };

  const downloadShutterstockCSV = (targetImages?: ImageData[]) => {
    const { count } = exportShutterstockCSV({
      images: targetImages || images,
      exportExtension
    });
    if (count > 0) {
      addToast(count === 1 ? "Shutterstock CSV Berhasil" : "Shutterstock Bulk Berhasil", "success");
    }
  };

  const downloadWithMetadata = async (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) {
      addToast("Tidak ada gambar yang siap diunduh", "error");
      return;
    }

    const zip = new JSZip();
    let processedCount = 0;
    const total = imagesToExport.length;

    addToast(`Menyiapkan ${total} gambar dengan metadata...`, "info");

    for (const img of imagesToExport) {
      try {
        if (!img.file.type.includes('jpeg') && !img.file.type.includes('jpg')) {
          // Non-JPEG handling: just add as is, piexif only supports JPEG
          const fileData = await img.file.arrayBuffer();
          zip.file(img.file.name, fileData);
          processedCount++;
          continue;
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(img.file);
        });

        // 1. Prepare Metadata
        const title = img.metadata?.title || "";
        const description = img.metadata?.description || "";
        const keywords = (img.metadata?.keywords || []).join(", ");

        // 2. Load Exif
        const exifObj = piexif.load(dataUrl);

        // 3. Set Tags in 0th IFD
        // 270: ImageDescription
        // 315: Artist
        // 33432: Copyright
        exifObj["0th"][piexif.ImageIFD.ImageDescription] = description;
        exifObj["0th"][piexif.ImageIFD.DocumentName] = title;

        // 4. Set XPKeywords (40094) - UCS2 encoded for Windows
        const encoder = new TextEncoder();
        const keywordsBuffer = encoder.encode(keywords);
        const ucs2Keywords = Array.from(keywords).flatMap(char => [char.charCodeAt(0), 0]);
        exifObj["0th"][40094] = ucs2Keywords;

        // 5. UserComment (37510) in Exif IFD
        // Needs ASCII prefix: [65, 83, 67, 73, 73, 0, 0, 0, ...]
        const userCommentPrefix = [65, 83, 67, 73, 73, 0, 0, 0];
        const userCommentContent = Array.from(keywords).map(c => c.charCodeAt(0));
        exifObj["Exif"][piexif.ExifIFD.UserComment] = [...userCommentPrefix, ...userCommentContent];

        // 6. Dump Exif and Insert to Image
        const exifStr = piexif.dump(exifObj);
        const newImageStr = piexif.insert(exifStr, dataUrl);

        // 7. Convert base64 to Blob
        const byteString = atob(newImageStr.split(',')[1]);
        const mimeString = newImageStr.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        
        zip.file(img.file.name, blob);
        processedCount++;
      } catch (err) {
        console.error(`Error embedding metadata to ${img.file.name}:`, err);
        // Fallback: add original if error
        const fileData = await img.file.arrayBuffer();
        zip.file(img.file.name, fileData);
        processedCount++;
      }
    }

    if (total === 1) {
      // Single download
      const content = await zip.file(imagesToExport[0].file.name)?.async("blob");
      if (content) {
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = imagesToExport[0].file.name;
        link.click();
        URL.revokeObjectURL(url);
        addToast("Gambar dengan metadata diunduh", "success");
      }
    } else {
      // Bulk ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dreamstime_images_${new Date().getTime()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      addToast(`Berhasil mengunduh ${total} gambar dengan metadata`, "success");
    }
  };

  const handleAddKey = () => {
    const rawInput = newKey.trim();
    if (!rawInput) return;
    
    // Split by newlines, commas, or whitespace
    const potentialKeys = rawInput.split(/[\n,\s]+/).map(k => k.trim()).filter(k => k !== '');
    
    if (potentialKeys.length === 0) return;

    const validKeys: string[] = [];
    const invalidKeys: string[] = [];
    const duplicateKeys: string[] = [];

    potentialKeys.forEach(key => {
      // Basic validation: Gemini API keys start with AIza or AQ.
      if (!key.startsWith("AIza") && !key.startsWith("AQ.")) {
        invalidKeys.push(key);
      } else if (apiKeys.includes(key)) {
        duplicateKeys.push(key);
      } else {
        validKeys.push(key);
      }
    });

    if (validKeys.length > 0) {
      const updated = [...apiKeys, ...validKeys];
      setApiKeys(updated);
      localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
      setNewKey('');
      
      if (validKeys.length === 1 && potentialKeys.length === 1) {
        addToast("API Key ditambahkan", "success");
      } else {
        addToast(`${validKeys.length} API Key berhasil ditambahkan`, "success");
      }
    }

    if (invalidKeys.length > 0) {
      if (potentialKeys.length === 1) {
        addToast("Format API Key tidak valid. Harus dimulai dengan 'AIza' atau 'AQ.'.", "error");
      } else {
        addToast(`${invalidKeys.length} key dilewati karena format tidak valid`, "error");
      }
    }

    if (duplicateKeys.length > 0 && validKeys.length === 0) {
      addToast("Key sudah ada dalam daftar", "info");
    }
  };

  const removeKey = (index: number) => {
    const keyToRemove = apiKeys[index];
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    setErrorApiKeys(prev => prev.filter(k => k !== keyToRemove));
    addToast("API Key dihapus", "info");
  };

  const handleAddGroqKey = () => {
    const raw = newGroqKey.trim();
    if (!raw) return;
    const cleanKeys = raw.split(/[\n,\s]+/).map(k => k.trim()).filter(Boolean);
    if (cleanKeys.length === 0) return;
    
    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicate: string[] = [];

    cleanKeys.forEach(key => {
      // Basic validation: Groq API keys usually start with gsk_
      if (!key.startsWith("gsk_")) {
        invalid.push(key);
      } else if (groqKeys.includes(key)) {
        duplicate.push(key);
      } else {
        valid.push(key);
      }
    });

    if (valid.length > 0) {
      const updated = [...groqKeys, ...valid];
      setGroqKeys(updated);
      setNewGroqKey('');
      addToast(`${valid.length} Groq API Key berhasil disuntikkan.`, 'success');
    }

    if (invalid.length > 0) {
      addToast(`${invalid.length} key dilewati karena format tidak valid (harus gsk_).`, 'error');
    }

    if (duplicate.length > 0 && valid.length === 0) {
      addToast('Key sudah terdaftar!', 'info');
    }
  };

  const handleRemoveGroqKey = (index: number) => {
    const updated = groqKeys.filter((_, i) => i !== index);
    setGroqKeys(updated);
    addToast('Groq API Key telah dihapus!', 'info');
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-700 font-sans selection:bg-indigo-100 overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/40 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex h-screen relative z-10 overflow-hidden">
        {/* Main Content */}
        <main 
          {...getRootProps()}
          className="flex-1 flex flex-col relative overflow-hidden bg-white/30"
        >
          <input {...getInputProps()} />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Drag & Drop Overlay */}
            <AnimatePresence>
            {isDragActive && !isUploading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-[2px] flex items-center justify-center p-8"
              >
                <div className="w-full h-full border-4 border-dashed border-indigo-500 rounded-[3rem] bg-white/80 flex flex-col items-center justify-center text-indigo-600 shadow-2xl">
                  <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mb-6 animate-bounce">
                    <Upload className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-bold">Lepaskan untuk Upload</h3>
                  <p className="text-indigo-400 mt-2">Gambar akan otomatis ditambahkan ke daftar</p>
                </div>
              </motion.div>
            )}
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] bg-indigo-600/20 backdrop-blur-[4px] flex items-center justify-center p-8 md:p-12"
              >
                <div className="bg-white/95 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm w-full text-center border border-indigo-100">
                  <div className="relative mb-4">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    <Upload className="w-5 h-5 text-indigo-300 absolute inset-0 m-auto" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">MENYIAPKAN GAMBAR...</h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">Mengecilkan ukuran gambar agar web tidak berat dan proses AI lebih cepat.</p>
                  <div className="mt-6 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <TopHeader 
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            setShowKeyModal={setShowKeyModal}
            setShowInfoPage={setShowInfoPage}
            open={open}
            apiKeys={apiKeys}
            favoriteModelId={favoriteModelId}
            setFavoriteModelId={setFavoriteModelId}
            showModelDropdown={showModelDropdown}
            setShowModelDropdown={setShowModelDropdown}
            modelDropdownRef={modelDropdownRef}
            audioVolume={audioVolume}
            setAudioVolume={handleVolumeChange}
            isAudioMuted={isAudioMuted}
            toggleAudioMute={handleToggleMute}
          />

          {/* Progress Bar */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 backdrop-blur-md border-b transition-colors shadow-sm",
                  isPaused ? "bg-amber-50/95 border-amber-200 text-amber-900" : "bg-white/95 border-slate-200"
                )}
              >
                <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPaused ? (
                        <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full text-xs">
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          Proses Dijeda
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Memproses Gambar...
                        </span>
                      )}
                      
                      <span className="font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                        {Math.round(progress)}%
                      </span>

                      {/* Active Model Indicator */}
                      {(activeModelDisplay || selectedModel) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-md">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          {activeModelDisplay || selectedModel}
                        </span>
                      )}

                      {/* Active Key Indicator */}
                      {activeKeyDisplay && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          <Key className="w-3 h-3 text-amber-500" />
                          {activeKeyDisplay}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPaused ? (
                        <button
                          type="button"
                          onClick={resumeGeneration}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          id="topbar-resume-btn"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Lanjutkan</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseGeneration}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          id="topbar-pause-btn"
                        >
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Jeda</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={stopGeneration}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
                        id="topbar-stop-btn"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop</span>
                      </button>
                    </div>
                  </div>

                  {/* Rotation warning banner */}
                  {lastRotationWarning && (
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{lastRotationWarning.message}</span>
                    </div>
                  )}

                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className={cn("h-full", isPaused ? "bg-amber-500" : "bg-indigo-500")}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-24 md:pb-8">
            {/* Page Navigation Tabs */}
            <div className="flex justify-center mb-6 max-w-2xl mx-auto">
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200/80 w-full shadow-inner">
                <button 
                  onClick={() => setCurrentPage('generator')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300",
                    currentPage === 'generator' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 border border-slate-200/30" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                  )}
                  id="tab-generator"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">AI Generator</span>
                </button>

                <button 
                  onClick={() => setCurrentPage('shutterstock_extension')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300",
                    currentPage === 'shutterstock_extension' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 border border-slate-200/30" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                  )}
                  id="tab-shutterstock-extension"
                >
                  <Chrome className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">Ekstensi Shutterstock</span>
                </button>

                <button 
                  onClick={() => setCurrentPage('freepik_calculator')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300",
                    currentPage === 'freepik_calculator' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 border border-slate-200/30" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                  )}
                  id="tab-freepik-calculator"
                >
                  <Ruler className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">Kalkulator Freepik</span>
                </button>
              </div>
            </div>

            {currentPage === 'generator' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 lg:gap-8 max-w-[1600px] mx-auto">
                <div className={cn(
                  "transition-all duration-300",
                  activePlatform ? "z-[60] relative" : "z-10 relative"
                )}>
                  <AssetGrid 
                    images={images}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                    setImages={setImages}
                    isDragActive={isDragActive}
                    viewMode={viewMode}
                    open={open}
                    showSettingsPanel={showSettingsPanel}
                    setShowSettingsPanel={setShowSettingsPanel}
                    titleLength={titleLength}
                    setTitleLength={setTitleLength}
                    keywordCount={keywordCount}
                    setKeywordCount={setKeywordCount}
                    titlePreset={titlePreset}
                    setTitlePreset={setTitlePreset}
                    styleHint={styleHint}
                    setStyleHint={setStyleHint}
                    excludedTitleWords={excludedTitleWords}
                    setExcludedTitleWords={setExcludedTitleWords}
                    generateMetadata={generateMetadata}
                    isGenerating={isGenerating}
                    isPaused={isPaused}
                    pauseGeneration={pauseGeneration}
                    resumeGeneration={resumeGeneration}
                    stopGeneration={stopGeneration}
                    startTime={sessionStartTimeRef.current}
                    currentTime={currentTime}
                    elapsedBeforePause={elapsedBeforePause}
                    lastGenerationDuration={lastGenerationDuration}
                    aiEngine={aiEngine}
                    setAiEngine={setAiEngine}
                    groqKeys={groqKeys}
                    selectedGroqModel={selectedGroqModel}
                    setSelectedGroqModel={setSelectedGroqModel}
                    apiKeys={apiKeys}
                    setShowKeyModal={setShowKeyModal}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    autoRotateModel={autoRotateModel}
                    toggleAutoRotateModel={toggleAutoRotateModel}
                    autoRotateGroqModel={autoRotateGroqModel}
                    toggleAutoRotateGroqModel={toggleAutoRotateGroqModel}
                    autoRetryFailed={autoRetryFailed}
                    toggleAutoRetryFailed={toggleAutoRetryFailed}
                    onManualAutoRetry={handleManualAutoRetry}
                    activeModelDisplay={activeModelDisplay}
                    activeKeyDisplay={activeKeyDisplay}
                    currentStatusDetail={currentStatusDetail}
                    lastRotationWarning={lastRotationWarning}
                  />
                </div>

                <div className="space-y-6">
                  <div ref={downloadHubRef} className={cn(
                    "transition-all duration-300",
                    activePlatform ? "z-[999] relative" : "z-20 relative"
                  )}>
                    <BatchDownloadHub 
                      images={images}
                      isGenerating={isGenerating}
                      isPaused={isPaused}
                      exportExtension={exportExtension}
                      setExportExtension={setExportExtension}
                      isGenerativeAI={isGenerativeAI}
                      setIsGenerativeAI={setIsGenerativeAI}
                      aiModel={aiModel}
                      setAiModel={setAiModel}
                      downloadCSV={downloadCSV}
                      downloadAdobeStockCSV={downloadAdobeStockCSV}
                      downloadShutterstockCSV={downloadShutterstockCSV}
                      downloadWithMetadata={downloadWithMetadata}
                      activePlatform={activePlatform}
                      setActivePlatform={setActivePlatform}
                      viewMode={viewMode}
                    />
                  </div>

                  <div className={cn(
                    "transition-all duration-300",
                    activeDownloadMenu ? "z-[99] relative" : "z-10 relative"
                  )}>
                    <MetadataPanel 
                      selectedImage={selectedImage}
                      setSelectedId={setSelectedId}
                      viewMode={viewMode}
                      setViewMode={setViewMode}
                      isEditing={isEditing}
                      setIsEditing={setIsEditing}
                      startEditing={startEditing}
                      editData={editData}
                      setEditData={setEditData}
                      copyToClipboard={copyToClipboard}
                      copiedField={copiedField}
                      saveEdit={saveEdit}
                      generateMetadata={generateMetadata}
                      isGenerating={isGenerating}
                      selectedModel={aiModel}
                      regenerateSingleMetadata={regenerateSingleMetadata}
                      activeDownloadMenu={activeDownloadMenu}
                      setActiveDownloadMenu={setActiveDownloadMenu}
                      exportExtension={exportExtension}
                      setExportExtension={setExportExtension}
                      downloadCSV={downloadCSV}
                      isGenerativeAI={isGenerativeAI}
                      setIsGenerativeAI={setIsGenerativeAI}
                      aiModel={aiModel}
                      setAiModel={setAiModel}
                      downloadAdobeStockCSV={downloadAdobeStockCSV}
                      downloadShutterstockCSV={downloadShutterstockCSV}
                      downloadWithMetadata={downloadWithMetadata}
                      images={images}
                      addToast={addToast}
                      onOptimizeMetadata={handleOptimizeMetadata}
                      activeModelDisplay={activeModelDisplay}
                      activeKeyDisplay={activeKeyDisplay}
                      currentStatusDetail={currentStatusDetail}
                      lastRotationWarning={lastRotationWarning}
                    />
                  </div>
                </div>
              </div>
            ) : currentPage === 'shutterstock_extension' ? (
              <ShutterstockExtensionImporter
                images={images}
                addToast={addToast}
              />
            ) : (
              <FreepikDimensionCalculator
                addToast={addToast}
              />
            )}
          </div>
        </div>
      </main>
    </div>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        aiEngine={aiEngine}
        apiKeys={apiKeys}
        activeApiKey={activeApiKey}
        errorApiKeys={errorApiKeys}
        newKey={newKey}
        setNewKey={setNewKey}
        onAddKey={handleAddKey}
        onRemoveKey={removeKey}
        groqKeys={groqKeys}
        newGroqKey={newGroqKey}
        setNewGroqKey={setNewGroqKey}
        onAddGroqKey={handleAddGroqKey}
        onRemoveGroqKey={handleRemoveGroqKey}
      />

      {/* Info Page Modal */}
      <InfoModal
        isOpen={showInfoPage}
        onClose={() => setShowInfoPage(false)}
      />

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-4">{confirmModal.title}</h2>
            <p className="text-slate-600 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-[110] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "px-4 py-2.5 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 pointer-events-auto",
                toast.type === 'success' ? "bg-white/90 border-green-100 text-green-700" :
                toast.type === 'error' ? "bg-white/90 border-red-100 text-red-700" :
                "bg-white/90 border-indigo-100 text-indigo-700"
              )}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-500" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  </>
  );
}
