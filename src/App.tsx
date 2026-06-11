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
  MoreVertical
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import * as piexif from "piexifjs";
import JSZip from "jszip";
import { cn } from './lib/utils';

// Import new components
import { TopHeader } from './components/TopHeader';
import { AssetGrid } from './components/AssetGrid';
import { MetadataPanel } from './components/MetadataPanel';
import { BatchDownloadHub } from './components/BatchDownloadHub';
import { EpsMetadataInjector } from './components/EpsMetadataInjector';
import { TeePublicGenerator } from './components/TeePublicGenerator';

// Import constants and types
import { MODELS, CHANGELOG_DATA, GROQ_MODELS } from './constants';
import { ImageData, PngTreeMetadata, Toast } from './types';

export default function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'pngtree'>('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
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

  // Persistent state for successful generation pair
  const lastSuccessKeyIndex = useRef<number>(0);
  const lastSuccessModelIndex = useRef<number>(0);
  const lastSuccessGroqModelIndex = useRef<number>(0);

  const [autoRotateModel, setAutoRotateModel] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_rotate_model');
    return saved !== 'false';
  });

  const toggleAutoRotateModel = () => {
    setAutoRotateModel(prev => {
      const next = !prev;
      localStorage.setItem('auto_rotate_model', JSON.stringify(next));
      addToast(next ? "Auto-Rotate Gemini Model: AKTIF" : "Auto-Rotate Gemini Model: NONAKTIF", next ? "success" : "info");
      return next;
    });
  };

  const [autoRotateGroqModel, setAutoRotateGroqModel] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_rotate_groq_model');
    return saved !== 'false';
  });

  const toggleAutoRotateGroqModel = () => {
    setAutoRotateGroqModel(prev => {
      const next = !prev;
      localStorage.setItem('auto_rotate_groq_model', JSON.stringify(next));
      addToast(next ? "Auto-Rotate Groq Model: AKTIF" : "Auto-Rotate Groq Model: NONAKTIF", next ? "success" : "info");
      return next;
    });
  };

  useEffect(() => {
    chimeAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    successAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    completeAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3'); // Different sound for batch finish
    
    // Volume settings
    if (chimeAudio.current) chimeAudio.current.volume = 0.4;
    if (successAudio.current) successAudio.current.volume = 0.5;
    if (completeAudio.current) completeAudio.current.volume = 0.9; // Higher volume for finish
  }, []);

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
  const [currentPage, setCurrentPage] = useState<'generator' | 'injector' | 'teepublic'>('generator');

  useEffect(() => {
    let interval: any;
    if (isGenerating && startTime) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 10);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isGenerating, startTime]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ 
    title: string; 
    description: string; 
    keywords: string;
    ptMainKeywords?: string;
    ptSecondaryKeywords?: string;
    ptMainCopy?: string;
  } | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([CHANGELOG_DATA[0].id]);
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

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const startEditing = () => {
    if (selectedImage?.metadata) {
      setEditData({
        title: selectedImage.metadata.title,
        description: selectedImage.metadata.description,
        keywords: selectedImage.metadata.keywords.join(', '),
        ptMainKeywords: selectedImage.metadata.pngTree?.mainKeywords.join(', ') || '',
        ptSecondaryKeywords: selectedImage.metadata.pngTree?.secondaryKeywords.join(', ') || '',
        ptMainCopy: selectedImage.metadata.pngTree?.mainCopy || ''
      });
      setIsEditing(true);
    }
  };

  const saveEdit = async () => {
    if (editData && selectedId) {
      const keywordsArray = editData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
      
      const updatedImage = images.find(img => img.id === selectedId);
      if (updatedImage && updatedImage.metadata) {
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

    setIsGenerating(true);
    setProgress(0);
    setErrorApiKeys([]);
    const batchStartTime = Date.now();
    setStartTime(batchStartTime);
    setCurrentTime(batchStartTime);
    setLastGenerationDuration(null);

    const pendingImages = images.filter(img => img.status !== 'completed');
    let completedCount = 0;

    // Use current successful indices as starting point
    let currentKeyIndex = lastSuccessKeyIndex.current % (aiEngine === 'gemini' ? apiKeys.length : groqKeys.length);
    let modelIndex = autoRotateModel ? (lastSuccessModelIndex.current % MODELS.length) : MODELS.findIndex(m => m.id === selectedModel);
    if (modelIndex === -1) modelIndex = 0;
    
    let groqModelIndex = autoRotateGroqModel ? (lastSuccessGroqModelIndex.current % GROQ_MODELS.length) : GROQ_MODELS.findIndex(m => m.id === selectedGroqModel);
    if (groqModelIndex === -1) groqModelIndex = 0;

    for (const img of pendingImages) {
      const imageStartTime = Date.now();
      setSelectedId(img.id);
      setImages(prev => prev.map(i => 
        i.id === img.id ? { ...i, status: 'processing' } : i
      ));

      let success = false;
      let lastErrorMessage = "Semua API Key dan Model gagal atau kuota habis";

      if (aiEngine === 'gemini') {
        let modelsTried = 0;
        const totalModels = autoRotateModel ? MODELS.length : 1;

        // Outer loop: Models
        while (!success && modelsTried < totalModels) {
          const currentModelId = MODELS[modelIndex].id;
          let keysTried = 0;
          const totalKeys = apiKeys.length;

          // Inner loop: Keys
          while (!success && keysTried < totalKeys) {
            // Normalize key index
            const actualKeyIndex = currentKeyIndex % totalKeys;
            const currentKey = apiKeys[actualKeyIndex];
            
            setActiveApiKey(currentKey);
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
              
              const promptText = `Analyze this image for ALL microstock metadata platforms (Shutterstock, Adobe Stock, PNGTree, Freepik, etc.). 
                      IMPORTANT: The metadata must be human-like, punchy, and NOT robotic. This is CRITICAL for SEO and sales. 
                      ${isTransparent ? "IMPORTANT: This image has a TRANSPARENT background (no background). DO NOT mention 'white background', 'isolated on white', or any solid background color in the title, description, or keywords. Use 'transparent background' or 'isolated' if needed. " : ""}
                      
                      Generate the following in JSON format:
                      - title: MANDATORY HUMAN STYLE. A concise yet descriptive, natural title. Start with the main SUBJECT/OBJECT first. 
                        * RULES: 
                          1. NO filler words at the start (DO NOT start with "A", "An", "The").
                          2. NO robotic phrases like "featuring", "of an", "against a", "depicting", "isolated on", "a close up of".
                          3. Flow: [Object/Main Subject] + [Style/Context].
                          4. Length: target approximately ${titleLength} characters. If the target length is long (e.g., >80 chars), naturally expand the title by appending descriptive visual details, themes, color combinations, or artistic medium context details at the end of the title so it organically meets the target length without compromising naturalness.
                      - description: A natural, human-written description (10-20 words). 
                        * RULES: 
                          1. NO robotic starting phrases like "This is a photo of", "An image of".
                          2. Start directly with the subject or action.
                          3. Be descriptive but natural.
                      - keywords: Exactly ${keywordCount} SPECIFIC human-like keywords. 
                        * Priority: Specific visual elements, artistic style (vector, 3d, oil painting, minimalist), mood, and usage context. 
                        * NO generic robotic fillers. NO duplicates.
                      - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                      - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                      
                      Specifically for PNGTree:
                      - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                      - pngTreeSecondaryKeywords: Exactly 20 unique keywords related to the work (style, color, elements, etc.). IGNORE the general keyword count and always provide exactly 20 for this field.
                      - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                      
                      IMPORTANT CONSTRAINTS:
                      - DO NOT use the words "oriental", "png", or "download" in any field (title, description, keywords).
                      - All metadata must be in English unless specified for pngTreeMainCopy.`;
              
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
                      pngTreeMainCopy: { type: Type.STRING }
                    },
                    required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy"]
                  }
                }
              });

              if (!response.text) {
                throw new Error("Empty response from Gemini API");
              }

              const result = JSON.parse(response.text);
              
              const updatedMetadata = {
                title: result.title,
                description: result.description,
                keywords: result.keywords.slice(0, keywordCount),
                categories: result.categories.slice(0, 2),
                adobeCategory: result.adobeCategory,
                prompt: promptText,
                model: currentModelId,
                usedModel: MODELS[modelIndex].name,
                usedApiKey: currentKey.slice(-4),
                pngTree: {
                  title: result.title,
                  mainKeywords: result.pngTreeMainKeywords,
                  secondaryKeywords: result.pngTreeSecondaryKeywords,
                  mainCopy: result.pngTreeMainCopy
                }
              };

              const duration = Date.now() - imageStartTime;
              setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', metadata: updatedMetadata, processingTime: duration } : i));
              success = true;
              
              // SAVE successful pair
              lastSuccessKeyIndex.current = actualKeyIndex;
              lastSuccessModelIndex.current = modelIndex;
              
              addToast(`Berhasil generate: ${img.file.name}`, "success");
              playChime();
            } catch (error) {
              console.error(`Error with key ${actualKeyIndex} on model ${currentModelId}:`, error);
              lastErrorMessage = getErrorMessage(error);
              setErrorApiKeys(prev => [...new Set([...prev, currentKey])]);
              
              // Try next key for the SAME model
              currentKeyIndex++;
              keysTried++;
            }
          }

          if (!success) {
            // All keys failed for this model, rotate to next model
            modelIndex = (modelIndex + 1) % MODELS.length;
            // IMPORTANT: reset key index to 0 so we try all keys for the NEW model
            currentKeyIndex = 0; 
            modelsTried++;
            
            if (modelsTried < totalModels) {
              addToast(`Pencarian resource... mencoba model ${MODELS[modelIndex].name}`, "info");
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
              
              const promptText = `Analyze this image for ALL microstock metadata platforms (Shutterstock, Adobe Stock, PNGTree, Freepik, etc.). 
                      IMPORTANT: The metadata must be human-like, punchy, and NOT robotic. This is CRITICAL for SEO and sales. 
                      ${isTransparent ? "IMPORTANT: This image has a TRANSPARENT background (no background). DO NOT mention 'white background', 'isolated on white', or any solid background color in the title, description, or keywords. Use 'transparent background' or 'isolated' if needed. " : ""}
                      
                      Generate the following in JSON format:
                      - title: MANDATORY HUMAN STYLE. A concise yet descriptive, natural title. Start with the main SUBJECT/OBJECT first. 
                        * RULES: 
                          1. NO filler words at the start (DO NOT start with "A", "An", "The").
                          2. NO robotic phrases like "featuring", "of an", "against a", "depicting", "isolated on", "a close up of".
                          3. Flow: [Object/Main Subject] + [Style/Context].
                          4. Length: target approximately ${titleLength} characters. If the target length is long (e.g., >80 chars), naturally expand the title by appending descriptive visual details, themes, color combinations, or artistic medium context details at the end of the title so it organically meets the target length without compromising naturalness.
                      - description: A natural, human-written description (10-20 words). 
                        * RULES: 
                          1. NO robotic starting phrases like "This is a photo of", "An image of".
                          2. Start directly with the subject or action.
                          3. Be descriptive but natural.
                      - keywords: Exactly ${keywordCount} SPECIFIC human-like keywords. 
                        * Priority: Specific visual elements, artistic style (vector, 3d, oil painting, minimalist), mood, and usage context. 
                        * NO generic robotic fillers. NO duplicates.
                      - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                      - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                      
                      Specifically for PNGTree:
                      - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                      - pngTreeSecondaryKeywords: Exactly 20 unique keywords related to the work (style, color, elements, etc.). IGNORE the general keyword count and always provide exactly 20 for this field.
                      - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                      
                      IMPORTANT CONSTRAINTS:
                      - DO NOT use the words "oriental", "png", or "download" in any field (title, description, keywords).
                      - All metadata must be in English unless specified for pngTreeMainCopy.`;

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

              const updatedMetadata = {
                title: result.title || "",
                description: result.description || "",
                keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, keywordCount) : [],
                categories: Array.isArray(result.categories) ? result.categories.slice(0, 2) : [],
                adobeCategory: result.adobeCategory || "",
                prompt: promptText,
                model: currentModelId,
                usedModel: "Groq " + (
                  currentModelId.includes("llama-4-scout") ? "Llama 4 Scout" :
                  currentModelId.includes("llama-4-maverick") ? "Llama 4 Maverick" :
                  currentModelId.includes("90b") ? "90B" : "11B"
                ),
                usedApiKey: activeKey.slice(-4),
                pngTree: {
                  title: result.title || "",
                  mainKeywords: Array.isArray(result.pngTreeMainKeywords) ? result.pngTreeMainKeywords : [],
                  secondaryKeywords: Array.isArray(result.pngTreeSecondaryKeywords) ? result.pngTreeSecondaryKeywords : [],
                  mainCopy: result.pngTreeMainCopy || ""
                }
              };

              const duration = Date.now() - imageStartTime;
              setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', metadata: updatedMetadata, processingTime: duration } : i));
              success = true;
              lastSuccessKeyIndex.current = actualKeyIndex;
              lastSuccessGroqModelIndex.current = groqModelIndex;
              addToast(`Berhasil generate: ${img.file.name}`, "success");
              playChime();
            } catch (error: any) {
              console.error(`Error with keyIndex ${actualKeyIndex} on model ${currentModelId}:`, error);
              lastErrorMessage = error.message || error;
              currentKeyIndex++;
              keysTried++;
            }
          }

          if (!success) {
            // All keys failed for this model, rotate to next Groq model
            groqModelIndex = (groqModelIndex + 1) % GROQ_MODELS.length;
            // IMPORTANT: reset key index to 0 so we try all keys for the NEW model
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
          i.id === img.id ? { ...i, status: 'error', error: lastErrorMessage } : i
        ));
        addToast(`Gagal generate: ${img.file.name}`, "error");
      }

      completedCount++;
      setProgress((completedCount / pendingImages.length) * 100);
    }

    setIsGenerating(false);
    setLastGenerationDuration(Date.now() - batchStartTime);
    setStartTime(null);
    setCurrentTime(null);
    setActiveApiKey(null);
    
    // Check if we just finished the batch
    addToast("Semua gambar berhasil diproses!", "success");
    playComplete(); 
    
    // Auto scroll with robust calculation and 800ms delay to ensure layout is settled
    setTimeout(() => {
      if (downloadHubRef.current) {
        const elementRect = downloadHubRef.current.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        // Offset for the fixed header (roughly 80-100px)
        const scrollToY = absoluteElementTop - 120;
        
        window.scrollTo({
          top: scrollToY,
          behavior: 'smooth'
        });
      }
    }, 800);
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
    const imageStartTime = Date.now();

    if (aiEngine === 'gemini') {
      let modelsTried = 0;
      const totalModels = autoRotateModel ? MODELS.length : 1;

      while (!success && modelsTried < totalModels) {
        const currentModelId = MODELS[modelIndex].id;
        let keysTried = 0;
        const totalKeys = apiKeys.length;

        while (!success && keysTried < totalKeys) {
          const actualKeyIndex = currentKeyIndex % totalKeys;
          const currentKey = apiKeys[actualKeyIndex];
          
          setActiveApiKey(currentKey);
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
            
            const promptText = `Analyze this image for ALL microstock metadata platforms (Shutterstock, Adobe Stock, PNGTree, Freepik, etc.). 
                    IMPORTANT: The metadata must be human-like, punchy, and NOT robotic. This is CRITICAL for SEO and sales. 
                    ${isTransparent ? "IMPORTANT: This image has a TRANSPARENT background (no background). DO NOT mention 'white background', 'isolated on white', or any solid background color in the title, description, or keywords. Use 'transparent background' or 'isolated' if needed. " : ""}
                    
                    Generate the following in JSON format:
                    - title: MANDATORY HUMAN STYLE. A concise yet descriptive, natural title. Start with the main SUBJECT/OBJECT first. 
                      * RULES: 
                        1. NO filler words at the start (DO NOT start with "A", "An", "The").
                        2. NO robotic phrases like "featuring", "of an", "against a", "depicting", "isolated on", "a close up of".
                        3. Flow: [Object/Main Subject] + [Style/Context].
                        4. Length: target approximately ${titleLength} characters. If the target length is long (e.g., >80 chars), naturally expand the title by appending descriptive visual details, themes, color combinations, or artistic medium context details at the end of the title so it organically meets the target length without compromising naturalness.
                    - description: A natural, human-written description (10-20 words). 
                      * RULES: 
                        1. NO robotic starting phrases like "This is a photo of", "An image of".
                        2. Start directly with the subject or action.
                        3. Be descriptive but natural.
                    - keywords: Exactly ${keywordCount} SPECIFIC human-like keywords. 
                      * Priority: Specific visual elements, artistic style (vector, 3d, oil painting, minimalist), mood, and usage context. 
                      * NO generic robotic fillers. NO duplicates.
                    - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                    - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                    
                    Specifically for PNGTree:
                    - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                    - pngTreeSecondaryKeywords: Exactly 20 unique keywords related to the work (style, color, elements, etc.). IGNORE the general keyword count and always provide exactly 20 for this field.
                    - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                    
                    IMPORTANT CONSTRAINTS:
                    - DO NOT use the words "oriental", "png", or "download" in any field (title, description, keywords).
                    - All metadata must be in English unless specified for pngTreeMainCopy.`;
            
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
                    pngTreeMainCopy: { type: Type.STRING }
                  },
                  required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy"]
                }
              }
            });

            if (!response.text) {
              throw new Error("Empty response from Gemini API");
            }

            const result = JSON.parse(response.text);

            const updatedMetadata = {
              title: result.title,
              description: result.description,
              keywords: result.keywords.slice(0, keywordCount),
              categories: result.categories.slice(0, 2),
              adobeCategory: result.adobeCategory,
              prompt: promptText,
              model: currentModelId,
              usedModel: MODELS[modelIndex].name,
              usedApiKey: currentKey.slice(-4),
              pngTree: {
                title: result.title,
                mainKeywords: result.pngTreeMainKeywords,
                secondaryKeywords: result.pngTreeSecondaryKeywords,
                mainCopy: result.pngTreeMainCopy
              }
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'completed', metadata: updatedMetadata, processingTime: duration } : i));
            success = true;

            // SAVE successful pair
            lastSuccessKeyIndex.current = actualKeyIndex;
            lastSuccessModelIndex.current = modelIndex;

            addToast(`Berhasil regenerate: ${img.file.name}`, "success");
            playChime();
          } catch (error: any) {
            console.error(`Error with key ${actualKeyIndex} on model ${currentModelId}:`, error);
            setErrorApiKeys(prev => [...new Set([...prev, currentKey])]);
            lastErrorMessage = error.message || error;
            
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
            
            const promptText = `Analyze this image for ALL microstock metadata platforms (Shutterstock, Adobe Stock, PNGTree, Freepik, etc.). 
                    IMPORTANT: The metadata must be human-like, punchy, and NOT robotic. This is CRITICAL for SEO and sales. 
                    ${isTransparent ? "IMPORTANT: This image has a TRANSPARENT background (no background). DO NOT mention 'white background', 'isolated on white', or any solid background color in the title, description, or keywords. Use 'transparent background' or 'isolated' if needed. " : ""}
                    
                    Generate the following in JSON format:
                    - title: MANDATORY HUMAN STYLE. A concise yet descriptive, natural title. Start with the main SUBJECT/OBJECT first. 
                      * RULES: 
                        1. NO filler words at the start (DO NOT start with "A", "An", "The").
                        2. NO robotic phrases like "featuring", "of an", "against a", "depicting", "isolated on", "a close up of".
                        3. Flow: [Object/Main Subject] + [Style/Context].
                        4. Length: target approximately ${titleLength} characters. If the target length is long (e.g., >80 chars), naturally expand the title by appending descriptive visual details, themes, color combinations, or artistic medium context details at the end of the title so it organically meets the target length without compromising naturalness.
                    - description: A natural, human-written description (10-20 words). 
                      * RULES: 
                        1. NO robotic starting phrases like "This is a photo of", "An image of".
                        2. Start directly with the subject or action.
                        3. Be descriptive but natural.
                    - keywords: Exactly ${keywordCount} SPECIFIC human-like keywords. 
                      * Priority: Specific visual elements, artistic style (vector, 3d, oil painting, minimalist), mood, and usage context. 
                      * NO generic robotic fillers. NO duplicates.
                    - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                    - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                    
                    Specifically for PNGTree:
                    - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                    - pngTreeSecondaryKeywords: Exactly 20 unique keywords related to the work (style, color, elements, etc.). IGNORE the general keyword count and always provide exactly 20 for this field.
                    - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                    
                    IMPORTANT CONSTRAINTS:
                    - DO NOT use the words "oriental", "png", or "download" in any field (title, description, keywords).
                    - All metadata must be in English unless specified for pngTreeMainCopy.`;

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

            const updatedMetadata = {
              title: result.title || "",
              description: result.description || "",
              keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, keywordCount) : [],
              categories: Array.isArray(result.categories) ? result.categories.slice(0, 2) : [],
              adobeCategory: result.adobeCategory || "",
              prompt: promptText,
              model: currentModelId,
              usedModel: "Groq " + (
                currentModelId.includes("llama-4-scout") ? "Llama 4 Scout" :
                currentModelId.includes("llama-4-maverick") ? "Llama 4 Maverick" :
                currentModelId.includes("90b") ? "90B" : "11B"
              ),
              usedApiKey: activeKey.slice(-4),
              pngTree: {
                title: result.title || "",
                mainKeywords: Array.isArray(result.pngTreeMainKeywords) ? result.pngTreeMainKeywords : [],
                secondaryKeywords: Array.isArray(result.pngTreeSecondaryKeywords) ? result.pngTreeSecondaryKeywords : [],
                mainCopy: result.pngTreeMainCopy || ""
              }
            };

            const duration = Date.now() - imageStartTime;
            setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'completed', metadata: updatedMetadata, processingTime: duration } : i));
            success = true;
            lastSuccessKeyIndex.current = actualKeyIndex;
            lastSuccessGroqModelIndex.current = groqModelIndex;
            addToast(`Berhasil regenerate: ${img.file.name}`, "success");
            playChime();
          } catch (error: any) {
            console.error(`Error with keyIndex ${actualKeyIndex} on model ${currentModelId}:`, error);
            lastErrorMessage = error.message || error;
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
        i.id === id ? { ...i, status: 'error', error: lastErrorMessage } : i
      ));
      addToast(`Gagal regenerate: ${img.file.name}`, "error");
    }
    setIsGenerating(false);
    setLastGenerationDuration(Date.now() - batchStartTime);
    setStartTime(null);
    setCurrentTime(null);
    setActiveApiKey(null);
  };

  const downloadCSV = (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) return;

    const headers = ["File name", "Title", "Keywords"];
    if (isGenerativeAI) {
      headers.push("Prompt", "Model");
    }

    const rows = imagesToExport.map(img => {
      // Freepik specific: title max 100 chars
      let title = img.metadata!.title;
      if (title.length > 100) {
        title = title.substring(0, 100);
      }

      // Freepik specific: if AI generative is on, max 49 keywords
      let keywordsArray = [...img.metadata!.keywords];
      if (isGenerativeAI) {
        keywordsArray = keywordsArray.slice(0, 49);
      }

      const row = [
        `"${img.file.name.replace(/"/g, '""')}"`,
        `"${title.replace(/"/g, '""')}"`,
        `"${keywordsArray.join(',').replace(/"/g, '""')}"`
      ];
      
      if (isGenerativeAI) {
        // User wants exactly: filename;title;keywords;"";"Model Name"
        row.push('""', `"${aiModel.replace(/"/g, '""')}"`);
      }
      
      return row;
    });

    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = imagesToExport.length === 1 
      ? `freepik_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `freepik_bulk_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(imagesToExport.length === 1 ? "CSV Gambar Berhasil" : "CSV Bulk Berhasil", "success");
  };

  const downloadAdobeStockCSV = (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) return;

    const headers = ["Filename", "Title", "Keywords"];
    const rows = imagesToExport.map(img => {
      // Change extension based on user selection
      const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, "") + exportExtension;
      
      return [
        fileNameWithExt,
        `"${img.metadata!.title.replace(/"/g, '""')}"`,
        `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = imagesToExport.length === 1 
      ? `adobestock_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `adobestock_bulk_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(imagesToExport.length === 1 ? "Adobe Stock CSV Berhasil" : "Adobe Stock Bulk Berhasil", "success");
  };

  const downloadShutterstockCSV = (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) return;

    const headers = ["Filename", "Description", "Keywords", "Categories", "Editorial", "Mature content", "Illustration"];
    const rows = imagesToExport.map(img => {
      // Change extension based on user selection
      const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, "") + exportExtension;
      
      // Illustration is "Yes" only for .eps
      const isIllustration = exportExtension === '.eps' ? "Yes" : "No";
      
      // Use Title as Description if Title exists, as it follow the stricter "human" rules
      const description = img.metadata!.title || img.metadata!.description;
      
      return [
        fileNameWithExt,
        `"${description.replace(/"/g, '""')}"`,
        `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`,
        `"${(img.metadata!.categories || ["Miscellaneous"]).join(',').replace(/"/g, '""')}"`,
        "No", // Editorial
        "No", // Mature content
        isIllustration // Illustration
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = imagesToExport.length === 1 
      ? `shutterstock_${imagesToExport[0].file.name.split('.')[0]}.csv`
      : `shutterstock_bulk_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(imagesToExport.length === 1 ? "Shutterstock CSV Berhasil" : "Shutterstock Bulk Berhasil", "success");
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
      // Basic validation: Gemini API keys usually start with AIza
      if (!key.startsWith("AIza")) {
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
        addToast("Format API Key tidak valid. Harus dimulai dengan 'AIza'.", "error");
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
          />

          {/* Progress Bar */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 left-0 right-0 z-20 p-4 bg-white/80 backdrop-blur-md border-b border-slate-200"
              >
                <div className="max-w-3xl mx-auto">
                  <div className="flex justify-between text-xs mb-2 text-indigo-600 font-medium">
                    <span>Processing Images...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-24 md:pb-8">
            {/* Page Tabs */}
            <div className="flex justify-center mb-6 max-w-md mx-auto">
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-200/50 w-full shadow-inner">
                <button 
                  onClick={() => setCurrentPage('generator')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300",
                    currentPage === 'generator' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 font-black border border-slate-200/20" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  )}
                  id="tab-generator"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Generator
                </button>
                <button 
                  onClick={() => setCurrentPage('injector')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300",
                    currentPage === 'injector' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 font-black border border-slate-200/20" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  )}
                  id="tab-injector"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Suntik EPS
                </button>
                <button 
                  onClick={() => setCurrentPage('teepublic')}
                  className={cn(
                    "flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300",
                    currentPage === 'teepublic' 
                      ? "bg-white text-indigo-600 shadow-md shadow-indigo-100/30 font-black border border-slate-200/20" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  )}
                  id="tab-teepublic"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  TeePublic
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
                    generateMetadata={generateMetadata}
                    isGenerating={isGenerating}
                    startTime={startTime}
                    currentTime={currentTime}
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
                    />
                  </div>
                </div>
              </div>
            ) : currentPage === 'injector' ? (
              <EpsMetadataInjector />
            ) : (
              <TeePublicGenerator 
                apiKeys={apiKeys}
                setShowKeyModal={setShowKeyModal}
                selectedModel={selectedModel}
              />
            )}
          </div>
        </div>
      </main>
    </div>

    {/* API Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKeyModal(false)}
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
                <button onClick={() => setShowKeyModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
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
                      "flex-1 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      activeKeyTab === 'gemini'
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Gemini Keys ({apiKeys.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveKeyTab('groq')}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      activeKeyTab === 'groq'
                        ? "bg-white text-pink-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Groq Keys ({groqKeys.length})
                  </button>
                </div>

                {activeKeyTab === 'gemini' ? (
                  <>
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
                            onClick={handleAddKey}
                            className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all hover:shadow-lg active:scale-95"
                            title="Tambah Key"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 px-1">
                        <Info className="w-3 h-3 inline mr-1" />
                        Bisa memasukkan banyak key / log sekaligus dipisah baris baru (dimulai AIza).
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
                            <div key={i} className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              isActive ? "bg-indigo-50 border-indigo-200 shadow-sm" : 
                              hasError ? "bg-red-50 border-red-200" :
                              "bg-slate-50 border-slate-100"
                            )}>
                              <div className="flex items-center gap-3 min-w-0">
                                {isActive ? (
                                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                                ) : hasError ? (
                                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                ) : (
                                  <Key className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className={cn(
                                  "text-xs font-mono truncate max-w-[180px]",
                                  isActive ? "text-indigo-700 font-bold" : 
                                  hasError ? "text-red-700" :
                                  "text-slate-500"
                                )}>
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
                                  onClick={() => removeKey(i)}
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
                            onClick={handleAddGroqKey}
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
                        groqKeys.map((key, i) => {
                          return (
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
                                  onClick={() => handleRemoveGroqKey(i)}
                                  className="p-1.5 hover:bg-red-100 text-red-300 rounded-lg transition-colors shrink-0"
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
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Info Page Modal */}
      <AnimatePresence>
        {showInfoPage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoPage(false)}
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
                  onClick={() => setShowInfoPage(false)}
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
                        Unduh metadata dalam format CSV yang sudah disesuaikan dengan standar Freepik, Adobe Stock, dan Shutterstock. Anda bisa memilih ekstensi file (.eps, .jpg, .png) dan memilih untuk mengunduh semua gambar atau hanya gambar yang dipilih.
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
                              <p className="text-xs font-bold text-slate-700">{log.date} <span className="font-normal text-slate-500 ml-2">({log.title})</span></p>
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
                                        <span className={cn("font-medium", change.type === 'new' ? "text-emerald-600" : change.type === 'fix' ? "text-rose-600" : "text-blue-600")}>
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
