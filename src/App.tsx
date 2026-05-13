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
  MoreVertical
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';

// Import new components
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { AssetGrid } from './components/AssetGrid';
import { MetadataPanel } from './components/MetadataPanel';
import { PngTreeVault } from './components/PngTreeVault';

// Import constants and types
import { MODELS, CHANGELOG_DATA } from './constants';
import { ImageData, PngTreeMetadata, Toast } from './types';

export default function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [pngTreeAssets, setPngTreeAssets] = useState<ImageData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPngTreeId, setSelectedPngTreeId] = useState<string | null>(null);
  const [pngTreeTitleLength, setPngTreeTitleLength] = useState<number>(100);
  const [pngTreeKeywordCount, setPngTreeKeywordCount] = useState<number>(20);
  const [viewMode, setViewMode] = useState<'standard' | 'pngtree'>('standard');
  const [activePage, setActivePage] = useState<'dashboard' | 'pngtree'>('dashboard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [keywordCount, setKeywordCount] = useState(50);
  const [titleLength, setTitleLength] = useState(100);
  const [exportExtension, setExportExtension] = useState<'.eps' | '.jpg' | '.png'>('.eps');
  const [exportPlatform, setExportPlatform] = useState<'Freepik' | 'Adobe' | 'Shutterstock' | null>(null);
  const [favoriteModelId, setFavoriteModelId] = useState<string | null>(() => localStorage.getItem('favorite_model_id') || null);
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [activeDownloadMenu, setActiveDownloadMenu] = useState<{
    type: 'adobe' | 'shutterstock';
    targetImages?: ImageData[];
  } | null>(null);
  const [autoProcess, setAutoProcess] = useState(true);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [showSingleDownloadDropdown, setShowSingleDownloadDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const singleDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('gemini_api_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeApiKey, setActiveApiKey] = useState<string | null>(null);
  const [errorApiKeys, setErrorApiKeys] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<number>>(new Set());
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
  const [showSettings, setShowSettings] = useState(false);
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
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ title: string; description: string; keywords: string } | null>(null);
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

  const [isBatchHubCollapsed, setIsBatchHubCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('isBatchHubCollapsed');
    return saved === 'true';
  });

  const toggleBatchHub = () => {
    const newState = !isBatchHubCollapsed;
    setIsBatchHubCollapsed(newState);
    localStorage.setItem('isBatchHubCollapsed', String(newState));
  };

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
        keywords: selectedImage.metadata.keywords.join(', ')
      });
      setIsEditing(true);
    }
  };

  const saveEdit = async () => {
    if (editData && selectedId) {
      const keywordsArray = editData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
      
      const updatedImage = images.find(img => img.id === selectedId);
      if (updatedImage && updatedImage.metadata) {
        const newImage = {
          ...updatedImage,
          metadata: {
            ...updatedImage.metadata,
            title: editData.title,
            description: editData.description,
            keywords: keywordsArray
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
        if (!activeDownloadMenu?.targetImages) setActiveDownloadMenu(null);
      }
      if (singleDropdownRef.current && !singleDropdownRef.current.contains(event.target as Node)) {
        setShowSingleDownloadDropdown(false);
        if (activeDownloadMenu?.targetImages) setActiveDownloadMenu(null);
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

  const onPngTreeDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    let duplicateCount = 0;
    try {
      const newAssets: ImageData[] = [];
      
      // Get current hashes
      const existingHashes = new Set(pngTreeAssets.map(img => img.hash).filter(Boolean));

      for (const file of acceptedFiles) {
        const hash = await getFileHash(file);
        
        if (existingHashes.has(hash)) {
          duplicateCount++;
          continue;
        }

        const blobUrl = await processImage(file);
        newAssets.push({
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

      if (newAssets.length > 0) {
        setPngTreeAssets(prev => [...prev, ...newAssets]);
        setSelectedPngTreeId(newAssets[0].id);
      }
    } catch (err) {
      console.error("Error creating PNGTree previews", err);
      addToast("Gagal memproses beberapa gambar PNGTree", "error");
    } finally {
      setIsUploading(false);
    }
  }, [pngTreeAssets]);

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

  const { 
    getRootProps: getPngTreeRootProps, 
    getInputProps: getPngTreeInputProps, 
    isDragActive: isPngTreeDragActive, 
    open: openPngTree 
  } = useDropzone({
    onDrop: onPngTreeDrop,
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

  const selectedPngTreeAsset = useMemo(() => 
    pngTreeAssets.find(a => a.id === selectedPngTreeId),
    [pngTreeAssets, selectedPngTreeId]
  );

  const generatePngTreeMetadata = async () => {
    if (pngTreeAssets.length === 0 || isGenerating) return;

    if (apiKeys.length === 0) {
      addToast("Silakan masukkan API Key Anda terlebih dahulu", "error");
      setShowKeyModal(true);
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const pendingAssets = pngTreeAssets.filter(img => img.status !== 'completed');
    let completedCount = 0;
    let currentKeyIndex = 0;

    for (const img of pendingAssets) {
      setSelectedPngTreeId(img.id);
      setPngTreeAssets(prev => prev.map(i => 
        i.id === img.id ? { ...i, status: 'processing' } : i
      ));

      let success = false;
      let modelIndex = favoriteModelId 
        ? MODELS.findIndex(m => m.id === favoriteModelId) 
        : MODELS.findIndex(m => m.id === selectedModel);
      if (modelIndex === -1) modelIndex = 0;
      
      let modelsTried = 0;
      const totalModels = MODELS.length;

      while (!success && modelsTried < totalModels) {
        const currentModelId = MODELS[modelIndex].id;
        let retryCount = 0;
        const maxRetries = apiKeys.length;

        while (!success && retryCount < maxRetries) {
          const currentKey = apiKeys[currentKeyIndex];
          setActiveApiKey(currentKey);
          const ai = new GoogleGenAI({ apiKey: currentKey });

          try {
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = () => reject(new Error("Gagal membaca file"));
              reader.readAsDataURL(img.file);
            });

            const promptText = `Analyze this image for PNGTree metadata. 
                    Generate the following in JSON format:
                    - title: A descriptive title (${pngTreeTitleLength - 20}-${pngTreeTitleLength} characters). For isolated objects with transparency, specify the object name and "isolated" in title.
                    - pngTreeMainKeywords: Exactly 3 most relevant keywords.
                    - pngTreeSecondaryKeywords: Exactly ${pngTreeKeywordCount} relevant keywords (elements, style, colors). Include "transparent", "png", "isolated" if applicable.
                    - pngTreeMainCopy: Primary text content in the image OR Indonesian language description if it is a local theme. 
                    
                    Everything except mainCopy must be in English.`;
            
            const response = await ai.models.generateContent({
              model: currentModelId,
              contents: {
                parts: [
                  { inlineData: { mimeType: img.file.type || "image/jpeg", data: base64Data } },
                  { text: promptText },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    pngTreeMainKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeSecondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pngTreeMainCopy: { type: Type.STRING }
                  },
                  required: ["title", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy"]
                }
              }
            });

            const result = JSON.parse(response.text || "{}");
            
            const updatedMetadata = {
              title: result.title,
              description: result.title,
              keywords: [...result.pngTreeMainKeywords, ...result.pngTreeSecondaryKeywords].slice(0, 50),
              categories: ["Backgrounds/Textures", "Travel"],
              adobeCategory: "Graphic Resources",
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

            setPngTreeAssets(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', metadata: updatedMetadata } : i));
            success = true;
            setActiveApiKey(null);
            addToast(`PNGTree: ${img.file.name} Berhasil`, "success");
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
          } catch (error) {
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            retryCount++;
          }
        }
        if (!success) {
          modelIndex = (modelIndex + 1) % MODELS.length;
          modelsTried++;
        }
      }
      if (!success) {
        setPngTreeAssets(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: "Gagal memproses" } : i));
      }
      completedCount++;
      setProgress((completedCount / pendingAssets.length) * 100);
    }
    setIsGenerating(false);
    setActiveApiKey(null);
  };

  const generateMetadata = async () => {
    if (images.length === 0 || isGenerating) return;

    if (apiKeys.length === 0) {
      addToast("Silakan masukkan API Key Anda terlebih dahulu untuk memulai", "error");
      setShowKeyModal(true);
      return;
    }

    const activeKeys = apiKeys;

    setIsGenerating(true);
    setProgress(0);
    setErrorApiKeys([]);

    const pendingImages = images.filter(img => img.status !== 'completed');
    let completedCount = 0;
    let currentKeyIndex = 0;

    for (const img of pendingImages) {
      setSelectedId(img.id);
      setImages(prev => prev.map(i => 
        i.id === img.id ? { ...i, status: 'processing' } : i
      ));

      let success = false;
      let modelIndex = favoriteModelId 
        ? MODELS.findIndex(m => m.id === favoriteModelId) 
        : MODELS.findIndex(m => m.id === selectedModel);
      if (modelIndex === -1) modelIndex = 0;
      
      let modelsTried = 0;
      const totalModels = MODELS.length;

      let lastErrorMessage = "Semua API Key dan Model gagal atau kuota habis";

      while (!success && modelsTried < totalModels) {
        const currentModelId = MODELS[modelIndex].id;
        let retryCount = 0;
        const maxRetries = activeKeys.length;

        while (!success && retryCount < maxRetries) {
          const currentKey = activeKeys[currentKeyIndex];
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
            
            const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, PNGTree, etc.). 
                    Generate the following in JSON format:
                    - title: A catchy, descriptive title focusing on the main subject (approximately ${titleLength} characters long).
                    - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                    - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                    - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                    - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                    
                    Specifically for PNGTree:
                    - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                    - pngTreeSecondaryKeywords: Exactly 30-50 keywords related to the work (style, color, elements, etc.).
                    - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                    
                    All metadata must be in English unless specified for pngTreeMainCopy.`;
            
            const response = await ai.models.generateContent({
              model: currentModelId,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    text: promptText,
                  },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    keywords: { 
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    categories: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Exactly 2 categories from the provided list"
                    },
                    adobeCategory: {
                      type: Type.STRING,
                      description: "Exactly 1 category from the Adobe Stock list"
                    },
                    pngTreeMainKeywords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    pngTreeSecondaryKeywords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    pngTreeMainCopy: { type: Type.STRING }
                  },
                  required: ["title", "description", "keywords", "categories", "adobeCategory", "pngTreeMainKeywords", "pngTreeSecondaryKeywords", "pngTreeMainCopy"]
                }
              }
            });

            const result = JSON.parse(response.text || "{}");
            
            const updatedMetadata = {
              title: result.title,
              description: result.description,
              keywords: result.keywords.slice(0, 50),
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

            const updatedImage = { 
              ...img, 
              status: 'completed' as const, 
              metadata: updatedMetadata 
            };

            setImages(prev => prev.map(i => i.id === img.id ? updatedImage : i));
            success = true;
            setActiveApiKey(null);
            addToast(`Berhasil generate: ${img.file.name}`, "success");
            
            // Cycle to next key for next image even on success
            currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
          } catch (error) {
            console.error(`Error with key ${currentKeyIndex} on model ${currentModelId}:`, error);
            lastErrorMessage = getErrorMessage(error);
            const failedKey = activeKeys[currentKeyIndex];
            setErrorApiKeys(prev => [...new Set([...prev, failedKey])]);
            
            if (lastErrorMessage.includes("API_KEY_INVALID") || lastErrorMessage.includes("403") || lastErrorMessage.includes("401")) {
              addToast(`API Key tidak valid: ${failedKey.substring(0, 8)}...`, "error");
            } else {
              addToast(`Memeriksa model/key lain...`, "info");
            }

            currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
            retryCount++;
          }
        }

        if (!success) {
          // Rotate to next model
          modelIndex = (modelIndex + 1) % MODELS.length;
          modelsTried++;
          if (modelsTried < totalModels) {
            addToast(`Model ${currentModelId} limit, mencoba model ${MODELS[modelIndex].name}...`, "info");
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
    setActiveApiKey(null);
    if (images.every(img => img.status === 'completed')) {
      addToast("Semua gambar berhasil diproses!", "success");
    }
  };

  const regenerateSingleMetadata = async (id: string) => {
    const img = images.find(i => i.id === id);
    if (!img || isGenerating) return;

    if (apiKeys.length === 0) {
      addToast("Silakan masukkan API Key Anda terlebih dahulu untuk memulai", "error");
      setShowKeyModal(true);
      return;
    }

    const activeKeys = apiKeys;

    setSelectedId(id);
    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));
    setErrorApiKeys([]);
    
    let currentKeyIndex = 0;
    let success = false;
    
    let modelIndex = favoriteModelId 
      ? MODELS.findIndex(m => m.id === favoriteModelId) 
      : MODELS.findIndex(m => m.id === selectedModel);
    if (modelIndex === -1) modelIndex = 0;
    
    let modelsTried = 0;
    const totalModels = MODELS.length;

    while (!success && modelsTried < totalModels) {
      const currentModelId = MODELS[modelIndex].id;
      let retryCount = 0;
      const maxRetries = activeKeys.length;

      while (!success && retryCount < maxRetries) {
        const currentKey = activeKeys[currentKeyIndex];
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
          
          const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, PNGTree, etc.). 
                  Generate the following in JSON format:
                  - title: A catchy, descriptive title focusing on the main subject (approximately ${titleLength} characters long).
                  - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                  - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                  - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                  - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                  
                  Specifically for PNGTree:
                  - pngTreeMainKeywords: Exactly 3 keywords that are most relevant to the work.
                  - pngTreeSecondaryKeywords: Exactly 30-50 keywords related to the work (style, color, elements, etc.).
                  - pngTreeMainCopy: The primary text information contained in the work, or non-English words related to the image (Indonesian, etc.).
                  
                  All metadata must be in English unless specified for pngTreeMainCopy.`;
          
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
                  keywords: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  categories: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Exactly 2 categories from the provided list"
                  },
                  adobeCategory: {
                    type: Type.STRING,
                    description: "Exactly 1 category from the Adobe Stock list"
                  },
                  pngTreeMainKeywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  pngTreeSecondaryKeywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
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
            keywords: result.keywords.slice(0, 50),
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

          const updatedImage = { 
            ...img, 
            status: 'completed' as const, 
            metadata: updatedMetadata 
          };

          setImages(prev => prev.map(i => i.id === id ? updatedImage : i));
          success = true;
          setActiveApiKey(null);
          addToast(`Berhasil regenerate: ${img.file.name}`, "success");
        } catch (error) {
          console.error(`Error with key ${currentKeyIndex} on model ${currentModelId}:`, error);
          const failedKey = activeKeys[currentKeyIndex];
          setErrorApiKeys(prev => [...new Set([...prev, failedKey])]);
          
          const errorMessage = getErrorMessage(error);
          if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("403") || errorMessage.includes("401")) {
            addToast(`API Key tidak valid: ${failedKey.substring(0, 8)}...`, "error");
          } else {
            addToast(`API Key error, mencoba key berikutnya...`, "info");
          }
          
          currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
          retryCount++;
        }
      }

      if (!success) {
        // Rotate to next model
        modelIndex = (modelIndex + 1) % MODELS.length;
        modelsTried++;
        if (modelsTried < totalModels) {
          addToast(`Model ${currentModelId} limit, mencoba model ${MODELS[modelIndex].name}...`, "info");
        }
      }
    }

    if (!success) {
      setImages(prev => prev.map(i => 
        i.id === id ? { ...i, status: 'error', error: "Semua API Key dan Model gagal atau kuota habis" } : i
      ));
      addToast(`Gagal regenerate: ${img.file.name}`, "error");
    }
    setActiveApiKey(null);
  };

  const downloadCSV = (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) return;

    const hasAiGenerated = imagesToExport.some(img => img.isAiGenerated);

    const headers = ["File name", "Title", "Keywords"];
    if (hasAiGenerated) {
      headers.push("Prompt", "Model", "AI Generated");
    }

    const rows = imagesToExport.map(img => {
      const row = [
        img.file.name,
        `"${img.metadata!.title.replace(/"/g, '""')}"`,
        `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`
      ];
      
      if (hasAiGenerated) {
        if (img.isAiGenerated) {
          row.push(
            `"${img.metadata!.prompt.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${img.metadata!.model}"`,
            "Yes"
          );
        } else {
          row.push('""', '""', '"No"');
        }
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
      
      return [
        fileNameWithExt,
        `"${img.metadata!.description.replace(/"/g, '""')}"`,
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

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    
    // Basic validation: Gemini API keys usually start with AIza
    if (!newKey.trim().startsWith("AIza")) {
      addToast("Format API Key tidak valid. Pastikan Anda memasukkan API Key Gemini yang benar (dimulai dengan 'AIza').", "error");
      return;
    }

    const updated = [...apiKeys, newKey.trim()];
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    setNewKey('');
    addToast("API Key ditambahkan", "success");
  };

  const removeKey = (index: number) => {
    const keyToRemove = apiKeys[index];
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    setErrorApiKeys(prev => prev.filter(k => k !== keyToRemove));
    addToast("API Key dihapus", "info");
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-700 font-sans selection:bg-indigo-100 overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/40 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex h-screen relative z-10 overflow-hidden">
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          setShowSettings={setShowSettings} 
          open={open} 
          openPngTree={openPngTree} 
        />

        {/* Main Content */}
        <main 
          {...getRootProps()}
          className="flex-1 flex flex-col relative overflow-hidden bg-white/30"
        >
          <input {...getInputProps()} />
          
          <AnimatePresence mode="wait">
            {activePage === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
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
                className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-[4px] flex items-center justify-center p-8"
              >
                <div className="bg-white/90 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <h3 className="text-xl font-bold text-slate-800">Menyiapkan Gambar...</h3>
                  <p className="text-sm text-slate-500 mt-2">Mengecilkan ukuran gambar agar web tidak berat.</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 lg:gap-8 max-w-[1600px] mx-auto">
              
                <AssetGrid 
                  images={images}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  setImages={setImages}
                  isDragActive={isDragActive}
                  open={open}
                  showSettingsPanel={showSettingsPanel}
                  setShowSettingsPanel={setShowSettingsPanel}
                  titleLength={titleLength}
                  setTitleLength={setTitleLength}
                  keywordCount={keywordCount}
                  setKeywordCount={setKeywordCount}
                  generateMetadata={generateMetadata}
                  isGenerating={isGenerating}
                />

                <MetadataPanel 
                  selectedImage={selectedImage}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  editData={editData}
                  setEditData={setEditData}
                  copyToClipboard={copyToClipboard}
                  copiedField={copiedField}
                  saveEdit={saveEdit}
                  generateMetadata={generateMetadata}
                  isGenerating={isGenerating}
                  selectedModel={selectedModel}
                  regenerateSingleMetadata={regenerateSingleMetadata}
                  activeDownloadMenu={activeDownloadMenu}
                  setActiveDownloadMenu={setActiveDownloadMenu}
                  exportExtension={exportExtension}
                  setExportExtension={setExportExtension}
                  downloadCSV={downloadCSV}
                  downloadAdobeStockCSV={downloadAdobeStockCSV}
                  downloadShutterstockCSV={downloadShutterstockCSV}
                  images={images}
                  toggleBatchHub={toggleBatchHub}
                  isBatchHubCollapsed={isBatchHubCollapsed}
                  setExportPlatform={setExportPlatform}
                  exportPlatform={exportPlatform}
                  addToast={addToast}
                />
            </div>
          </div>
        </motion.div>
      ) : (
        <PngTreeVault 
          pngTreeAssets={pngTreeAssets}
          selectedPngTreeId={selectedPngTreeId}
          setSelectedPngTreeId={setSelectedPngTreeId}
          setPngTreeAssets={setPngTreeAssets}
          isGenerating={isGenerating}
          generatePngTreeMetadata={generatePngTreeMetadata}
          isPngTreeDragActive={isPngTreeDragActive}
          isUploading={isUploading}
          openPngTree={openPngTree}
          getPngTreeRootProps={getPngTreeRootProps}
          getPngTreeInputProps={getPngTreeInputProps}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={setShowModelDropdown}
          setShowKeyModal={setShowKeyModal}
          setShowInfoPage={setShowInfoPage}
          setConfirmModal={setConfirmModal}
          addToast={addToast}
          modelDropdownRef={modelDropdownRef}
          copyToClipboard={copyToClipboard}
          copiedField={copiedField}
          activeDownloadMenu={activeDownloadMenu}
          setActiveDownloadMenu={setActiveDownloadMenu}
          exportExtension={exportExtension}
          setExportExtension={setExportExtension}
          downloadCSV={downloadCSV}
          downloadAdobeStockCSV={downloadAdobeStockCSV}
          downloadShutterstockCSV={downloadShutterstockCSV}
          titleLength={pngTreeTitleLength}
          setTitleLength={setPngTreeTitleLength}
          keywordCount={pngTreeKeywordCount}
          setKeywordCount={setPngTreeKeywordCount}
        />
      )}
    </AnimatePresence>
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
                <div className="flex gap-2">
                  <input 
                    type="password"
                    placeholder="Masukkan Gemini API Key..."
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button 
                    onClick={handleAddKey}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {apiKeys.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-8">Belum ada API Key yang disimpan.</p>
                  ) : (
                    apiKeys.map((key, i) => {
                      const isActive = activeApiKey === key;
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
                                setCopiedKeys(prev => new Set(prev).add(i));
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2 items-center pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
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
