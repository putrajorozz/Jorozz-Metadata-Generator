import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Loader2,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Copy,
  Check,
  Key,
  Plus,
  AlertCircle,
  Info,
  Menu,
  Settings,
  Edit3,
  History,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Database,
  Eye,
  EyeOff,
  Star
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';

const CHANGELOG_DATA = [
  {
    id: "v1.2.0",
    date: "7 April 2026",
    title: "Update UI & Export Options",
    changes: [
      { type: "new", text: "Halaman Informasi & Changelog dengan riwayat versi (buka/tutup)." },
      { type: "new", text: "Pilihan cakupan ekspor (Download Semua Gambar vs Gambar Terpilih Saja)." },
      { type: "improvement", text: "UI pemilihan ekstensi file (.eps, .jpg, .png) diubah menjadi tombol inline agar lebih mudah diklik." }
    ]
  },
  {
    id: "v1.1.0",
    date: "6 April 2026",
    title: "Metadata Editor & Multi API Key",
    changes: [
      { type: "improvement", text: "Pengaturan batas minimal kata untuk Judul (5-20 kata)." },
      { type: "new", text: "Edit metadata (Judul, Deskripsi, Kata Kunci) secara manual sebelum diunduh." },
      { type: "new", text: "Rotasi Multi API Key untuk mencegah limit (Rate Limit)." }
    ]
  }
];

interface ImageData {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  isAiGenerated: boolean;
  metadata?: {
    title: string;
    description: string;
    keywords: string[];
    categories: string[];
    adobeCategory: string;
    prompt: string;
    model: string;
    usedModel: string;
    usedApiKey: string;
  };
  error?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const MODELS = [
  { id: "gemini-pro-latest", name: "Gemini Pro Latest", description: "Model Pro terbaru, kemampuan penalaran kuat" },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest", description: "Model Flash terbaru, efisien & cepat" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Model terbaru, sangat cepat & akurat" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Versi ringan Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Model Gemini 2.0 Flash handal" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Versi ringan Gemini 2.0 Flash" },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Free Tier)", description: "Paling hemat kuota & cepat" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Free Tier)", description: "Keseimbangan kualitas & kecepatan" },
];

export default function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    try {
      const newImages: ImageData[] = [];
      for (const file of acceptedFiles) {
        // Use resized Blob URL instead of DataURL (Base64) to save memory
        const blobUrl = await processImage(file);
        newImages.push({
          id: Math.random().toString(36).substring(7),
          file,
          preview: blobUrl,
          status: 'pending' as const,
          isAiGenerated: false,
        });
      }
      setImages(prev => [...prev, ...newImages]);
      if (newImages.length > 0) {
        setSelectedId(newImages[0].id);
      }
    } catch (err) {
      console.error("Error creating previews", err);
    } finally {
      setIsUploading(false);
    }
  }, [selectedId]);

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
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error("Canvas to Blob failed"));
          }
        }, 'image/jpeg', 0.6);
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
            
            const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, etc.). 
                    Generate the following in JSON format:
                    - title: A catchy, descriptive title focusing on the main subject (approximately ${titleLength} characters long).
                    - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                    - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                    - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                    - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                    
                    All metadata must be in English.`;
            
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
                    }
                  },
                  required: ["title", "description", "keywords", "categories", "adobeCategory"]
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
              usedApiKey: currentKey.slice(-4)
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
          
          const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, etc.). 
                  Generate the following in JSON format:
                  - title: A catchy, descriptive title focusing on the main subject (approximately ${titleLength} characters long).
                  - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                  - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                  - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                  - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                  
                  All metadata must be in English.`;
          
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
                  }
                },
                required: ["title", "description", "keywords", "categories", "adobeCategory"]
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
            usedApiKey: currentKey.slice(-4)
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
        {/* Main Content */}
        <main 
          {...getRootProps()}
          className="flex-1 flex flex-col relative overflow-hidden bg-white/30"
        >
          <input {...getInputProps()} />
          
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

          {/* Main Header (Responsive) */}
          <header className="p-4 border-b border-slate-200 bg-white/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <h1 className="text-sm md:text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                <span className="hidden xs:inline">Jorozz Generator</span>
              </h1>
              <div className="h-4 w-px bg-slate-200 hidden xs:block" />
              <h2 className="text-xs md:text-sm font-medium text-slate-500 truncate max-w-[120px] sm:max-w-[200px]">
                Metadata Generator
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all"
                  title="Pilih Model Gemini"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="max-w-[100px] truncate">
                    {MODELS.find(m => m.id === selectedModel)?.name.split(' (')[0]}
                  </span>
                  <ChevronRight className={cn("w-3 h-3 transition-transform", showModelDropdown && "rotate-90")} />
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
              >
                <Key className="w-4 h-4" />
                {apiKeys.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full border border-white" />
                )}
              </button>
              <button 
                onClick={() => setShowInfoPage(true)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                title="Informasi Website"
              >
                <Info className="w-4 h-4" />
              </button>
              <button 
                onClick={open}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Upload Gambar</span>
                <span className="xs:hidden">Upload</span>
              </button>
            </div>
          </header>

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

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 max-w-[1600px] mx-auto">
              
              {/* Left Column: Input and List */}
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
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isGenerating ? "Sedang..." : "Generate"}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: AI Generation and Detailed View */}
              <div className="space-y-6">
                {/* Metadata Export Hub Batch Center */}
                {images.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative group z-20"
                  >
                    <div className={cn(
                      "relative bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 transition-all duration-300 overflow-hidden",
                      isBatchHubCollapsed ? "p-3" : "p-4"
                    )}>
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={toggleBatchHub}
                            className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          >
                            <motion.div
                              animate={{ rotate: isBatchHubCollapsed ? 0 : 180 }}
                              transition={{ duration: 0.3 }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </button>
                          
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none mb-0.5">Metadata Export Hub</span>
                            <h3 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">Batch Center</h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-1.5">
                            {images.slice(0, 3).map((img) => (
                              <img 
                                key={img.id} 
                                src={img.preview} 
                                alt="" 
                                className="w-5 h-5 rounded-lg border border-white object-cover shadow-sm bg-slate-100"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                          <div className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100/30">
                            <span className="text-[9px] font-bold text-indigo-600">{images.length} File</span>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Content */}
                      <AnimatePresence>
                        {!isBatchHubCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {(['Freepik', 'Adobe', 'Shutterstock'] as const).map((platform) => {
                                const isReady = images.length > 0 && images.every(img => img.status === 'completed');
                                
                                return (
                                  <div key={platform} className="flex flex-col gap-1.5">
                                    <button 
                                      disabled={!isReady}
                                      onClick={() => isReady && setExportPlatform(exportPlatform === platform ? null : platform)}
                                      className={cn(
                                        "relative group/btn h-9 overflow-hidden rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 active:scale-95",
                                        !isReady 
                                          ? "bg-slate-50 border-slate-100 text-slate-200 cursor-not-allowed"
                                          : exportPlatform === platform
                                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-100/50"
                                            : "bg-white border-slate-100 text-slate-700 hover:border-indigo-200 hover:bg-slate-50"
                                      )}
                                    >
                                      {isReady && <Download className={cn("w-3 h-3 transition-colors", exportPlatform === platform ? "text-white" : "text-slate-400")} />}
                                      <span className="text-[10px] font-black tracking-tight">{platform.toUpperCase()}</span>
                                    </button>

                                    <AnimatePresence>
                                      {isReady && exportPlatform === platform && (
                                        <motion.div 
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="flex gap-1 overflow-hidden"
                                        >
                                          {(['.eps', '.jpg', '.png'] as const).map((ext) => (
                                            <button
                                              key={ext}
                                              onClick={() => {
                                                setExportExtension(ext);
                                                if (platform === 'Freepik') downloadCSV();
                                                else if (platform === 'Adobe') downloadAdobeStockCSV();
                                                else downloadShutterstockCSV();
                                                addToast(`Batch Export: ${platform} (${ext})`, "success");
                                              }}
                                              className="flex-1 py-1.5 rounded-lg text-[8px] font-black bg-slate-50 text-slate-500 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"
                                            >
                                              {ext.toUpperCase().replace('.', '')}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {!images.every(img => img.status === 'completed') && (
                              <div className="mt-3 p-2 rounded-xl bg-amber-50 border border-amber-100/50 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shadow-xs">
                                  <Database className="w-3 h-3 text-amber-500 animate-pulse" />
                                </div>
                                <span className="text-[9px] font-bold text-amber-700 leading-none">Menunggu Sinkronisasi Aset...</span>
                              </div>
                            )}

                            <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between opacity-30">
                              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">v2.5 Hub Engine</span>
                              <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                
                {/* Result/Detail Area */}
                {selectedImage ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 p-4 shadow-sm overflow-hidden"
                  >
                    {/* Metadata Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                          {selectedImage.file.type.startsWith('image/') ? (
                            <img src={selectedImage.preview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                              <FileText className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-bold text-slate-800 line-clamp-1">{selectedImage.file.name}</h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                              selectedImage.status === 'completed' ? "bg-green-100 text-green-600" :
                              selectedImage.status === 'error' ? "bg-red-100 text-red-600" :
                              "bg-indigo-100 text-indigo-600"
                            )}>
                              {selectedId === 'completed' ? 'Selesai' : selectedImage.status}
                            </span>
                            
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <div className="relative">
                                <input 
                                  type="checkbox" 
                                  className="sr-only" 
                                  checked={selectedImage.isAiGenerated}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setImages(prev => prev.map(img => 
                                      img.id === selectedImage.id ? { ...img, isAiGenerated: checked } : img
                                    ));
                                  }}
                                />
                                <div className={cn(
                                  "w-7 h-4 rounded-full transition-colors",
                                  selectedImage.isAiGenerated ? "bg-indigo-500" : "bg-slate-300"
                                )} />
                                <div className={cn(
                                  "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm",
                                  selectedImage.isAiGenerated ? "translate-x-3" : "translate-x-0"
                                )} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">AI Generated</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {selectedImage.status !== 'processing' && (
                          <button
                            onClick={() => regenerateSingleMetadata(selectedImage.id)}
                            disabled={isGenerating}
                            className="p-2 border rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm bg-white hover:bg-indigo-50 border-slate-200 text-indigo-600"
                            title="Regenerate"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                        {!isEditing && selectedImage.status === 'completed' && (
                          <button onClick={startEditing} className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors shadow-sm">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="space-y-6">
                      {selectedImage.status === 'completed' && (
                        <div className="space-y-6">
                          {/* Metadata Download Menu */}
                          <div className="flex flex-col gap-2" ref={singleDropdownRef}>
                            <AnimatePresence mode="wait">
                              {activeDownloadMenu && activeDownloadMenu.targetImages?.[0]?.id === selectedImage.id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="w-full p-4 bg-white rounded-2xl border border-slate-100 flex flex-col gap-4 shadow-xl shadow-indigo-100/20"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-700">Format File ({activeDownloadMenu.type === 'adobe' ? 'Adobe Store' : 'Shutterstock'})</span>
                                    <button onClick={() => setActiveDownloadMenu(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                      <X className="w-4 h-4" />
                                    </button>
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
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
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
                                  >
                                    <Download className="w-4 h-4" /> Freepik
                                  </button>
                                  <button
                                    onClick={() => setActiveDownloadMenu({ type: 'adobe', targetImages: [selectedImage] })}
                                    className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Download className="w-4 h-4" /> Adobe Stock
                                  </button>
                                  <button
                                    onClick={() => setActiveDownloadMenu({ type: 'shutterstock', targetImages: [selectedImage] })}
                                    className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
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
                            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
                              <p className="text-[10px] text-indigo-800">
                                Metadata berhasil digenerate menggunakan model <strong>{selectedImage.metadata!.usedModel}</strong> dengan API Key <strong>{selectedImage.metadata!.usedApiKey.substring(0, 4)}••••••••{selectedImage.metadata!.usedApiKey.substring(selectedImage.metadata!.usedApiKey.length - 4)}</strong>
                              </p>
                            </div>
                            
                            {/* Title Field */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Judul</label>
                                {!isEditing && (
                                  <button onClick={() => copyToClipboard(selectedImage.metadata!.title, 'title')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              {isEditing ? (
                                <input 
                                  value={editData?.title || ''}
                                  onChange={(e) => setEditData(p => p ? {...p, title: e.target.value} : null)}
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
                                  <button onClick={() => copyToClipboard(selectedImage.metadata!.description, 'desc')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                    {copiedField === 'desc' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              {isEditing ? (
                                <textarea 
                                  rows={3}
                                  value={editData?.description || ''}
                                  onChange={(e) => setEditData(p => p ? {...p, description: e.target.value} : null)}
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
                                  <button onClick={() => copyToClipboard(selectedImage.metadata!.keywords.join(', '), 'keys')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                                    {copiedField === 'keys' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              {isEditing ? (
                                <textarea 
                                  rows={4}
                                  value={editData?.keywords || ''}
                                  onChange={(e) => setEditData(p => p ? {...p, keywords: e.target.value} : null)}
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

                            {isEditing && (
                              <div className="flex gap-2 pt-4">
                                <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">Batal</button>
                                <button onClick={saveEdit} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">Simpan</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedImage.status === 'processing' && (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                          <h3 className="font-bold text-slate-800">Menganalisis Gambar...</h3>
                          <p className="text-xs text-slate-500 mt-1">Menggunakan {selectedModel}</p>
                        </div>
                      )}

                      {selectedImage.status === 'error' && (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                          <h3 className="font-bold text-slate-800">Terjadi Kesalahan</h3>
                          <p className="text-xs text-red-500 mt-1 max-w-xs">{selectedImage.error}</p>
                          <button onClick={generateMetadata} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Coba Lagi</button>
                        </div>
                      )}

                      {selectedImage.status === 'pending' && (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                          <Sparkles className="w-10 h-10 text-indigo-300 mb-4" />
                          <h3 className="font-bold text-slate-800">Siap Generate</h3>
                          <p className="text-xs text-slate-500 mt-1">Klik tombol generate di bawah daftar gambar untuk memulai analisis AI</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center text-slate-400">
                    <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm">Pilih gambar untuk melihat atau mengedit metadata hasil generate.</p>
                  </div>
                )}

              </div>
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

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0" />
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    Gunakan beberapa API Key untuk menghindari limit kuota. Sistem akan otomatis mengganti key jika terjadi error saat proses generate.
                  </p>
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
