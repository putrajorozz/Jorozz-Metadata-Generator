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
  Edit3
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';

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
  };
  error?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const MODELS = [
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
  const [minTitleWords, setMinTitleWords] = useState(10);
  const [keywordCount, setKeywordCount] = useState(50);
  const [exportExtension, setExportExtension] = useState<'.eps' | '.jpg' | '.png'>('.eps');
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
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ title: string; description: string; keywords: string } | null>(null);

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

  const saveEdit = () => {
    if (editData && selectedId) {
      const keywordsArray = editData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
      setImages(prev => prev.map(img => 
        img.id === selectedId 
          ? { 
              ...img, 
              metadata: img.metadata ? {
                ...img.metadata,
                title: editData.title,
                description: editData.description,
                keywords: keywordsArray
              } : null
            } 
          : img
      ));
      setIsEditing(false);
      setEditData(null);
      addToast("Metadata berhasil diperbarui", "success");
    }
  };

  useEffect(() => {
    setIsEditing(false);
    setEditData(null);
  }, [selectedId]);

  // Auto-start generation when new images are added
  useEffect(() => {
    if (autoProcess && images.length > 0 && !isGenerating) {
      const hasPending = images.some(img => img.status === 'pending');
      if (hasPending) {
        generateMetadata();
      }
    }
  }, [images.length, isGenerating, autoProcess]);

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
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages: ImageData[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
      isAiGenerated: false,
    }));
    setImages(prev => [...prev, ...newImages]);
    if (!selectedId && newImages.length > 0) {
      setSelectedId(newImages[0].id);
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

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedId === id) {
        setSelectedId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const selectedImage = useMemo(() => 
    images.find(img => img.id === selectedId), 
  [images, selectedId]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const generateMetadata = async () => {
    if (images.length === 0 || isGenerating) return;

    const activeKeys = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY || ""];
    if (activeKeys.length === 1 && !activeKeys[0]) {
      addToast("Silakan masukkan API Key Gemini terlebih dahulu", "error");
      setShowKeyModal(true);
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const pendingImages = images.filter(img => img.status !== 'completed');
    let completedCount = 0;
    let currentKeyIndex = 0;

    for (const img of pendingImages) {
      setImages(prev => prev.map(i => 
        i.id === img.id ? { ...i, status: 'processing' } : i
      ));

      let success = false;
      let retryCount = 0;
      const maxRetries = activeKeys.length;

      while (!success && retryCount < maxRetries) {
        const currentKey = activeKeys[currentKeyIndex];
        const ai = new GoogleGenAI({ apiKey: currentKey });

        try {
          const base64Data = await fileToBase64(img.file);
          let mimeType = img.file.type;
          
          const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, etc.). 
                  Generate the following in JSON format:
                  - title: A catchy, descriptive title focusing on the main subject (minimum ${minTitleWords} words, maximum ${Math.max(20, minTitleWords + 5)} words).
                  - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                  - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                  - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                  - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                  
                  All metadata must be in English.`;
          
          const response = await ai.models.generateContent({
            model: selectedModel,
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

          setImages(prev => prev.map(i => 
            i.id === img.id ? { 
              ...i, 
              status: 'completed', 
              metadata: {
                title: result.title,
                description: result.description,
                keywords: result.keywords.slice(0, 50),
                categories: result.categories.slice(0, 2),
                adobeCategory: result.adobeCategory,
                prompt: promptText,
                model: selectedModel
              } 
            } : i
          ));
          success = true;
          addToast(`Berhasil generate: ${img.file.name}`, "success");
          
          // Cycle to next key for next image even on success
          currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
        } catch (error) {
          console.error(`Error with key ${currentKeyIndex}:`, error);
          currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
          retryCount++;
          
          if (retryCount < maxRetries) {
            addToast(`API Key error, mencoba key berikutnya...`, "info");
          } else {
            setImages(prev => prev.map(i => 
              i.id === img.id ? { ...i, status: 'error', error: "Semua API Key gagal atau kuota habis" } : i
            ));
            addToast(`Gagal generate: ${img.file.name}`, "error");
          }
        }
      }

      completedCount++;
      setProgress((completedCount / pendingImages.length) * 100);
    }

    setIsGenerating(false);
    if (images.every(img => img.status === 'completed')) {
      addToast("Semua gambar berhasil diproses!", "success");
    }
  };

  const regenerateSingleMetadata = async (id: string) => {
    const img = images.find(i => i.id === id);
    if (!img || isGenerating) return;

    const activeKeys = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY || ""];
    if (activeKeys.length === 1 && !activeKeys[0]) {
      addToast("Silakan masukkan API Key Gemini terlebih dahulu", "error");
      setShowKeyModal(true);
      return;
    }

    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));
    
    let currentKeyIndex = 0;
    let success = false;
    let retryCount = 0;
    const maxRetries = activeKeys.length;

    while (!success && retryCount < maxRetries) {
      const currentKey = activeKeys[currentKeyIndex];
      const ai = new GoogleGenAI({ apiKey: currentKey });

      try {
        const base64Data = await fileToBase64(img.file);
        let mimeType = img.file.type;
        
        const promptText = `Analyze this image for microstock metadata (Shutterstock, Adobe Stock, etc.). 
                Generate the following in JSON format:
                - title: A catchy, descriptive title focusing on the main subject (minimum ${minTitleWords} words, maximum ${Math.max(20, minTitleWords + 5)} words).
                - description: A detailed, SEO-friendly description including context, mood, and key elements (10-20 words).
                - keywords: Exactly ${keywordCount} relevant keywords as an array of strings. Include specific details, broad categories, and conceptual terms. No duplicates.
                - categories: Select exactly 2 most relevant categories from this list: [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage].
                - adobeCategory: Select exactly 1 most relevant category from this list: [Animals, Buildings And Architecture, Business, Drinks, The Environment, States of Mind, Food, Graphic Resources, Hobbies and Leisure, Industry, Landscapes, Lifestyle, People, Plants and Flowers, Culture and Religion, Science, Social Issues, Sports, Technology, Transport, Travel].
                
                All metadata must be in English.`;
        
        const response = await ai.models.generateContent({
          model: selectedModel,
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

        const result = JSON.parse(response.text || "{}");

        setImages(prev => prev.map(i => 
          i.id === id ? { 
            ...i, 
            status: 'completed', 
            metadata: {
              title: result.title,
              description: result.description,
              keywords: result.keywords.slice(0, 50),
              categories: result.categories.slice(0, 2),
              adobeCategory: result.adobeCategory,
              prompt: promptText,
              model: selectedModel
            } 
          } : i
        ));
        success = true;
        addToast(`Berhasil regenerate: ${img.file.name}`, "success");
      } catch (error) {
        console.error(`Error with key ${currentKeyIndex}:`, error);
        currentKeyIndex = (currentKeyIndex + 1) % activeKeys.length;
        retryCount++;
        if (retryCount < maxRetries) {
          addToast(`API Key error, mencoba key berikutnya...`, "info");
        } else {
          setImages(prev => prev.map(i => 
            i.id === id ? { ...i, status: 'error', error: "Semua API Key gagal atau kuota habis" } : i
          ));
          addToast(`Gagal regenerate: ${img.file.name}`, "error");
        }
      }
    }
  };

  const downloadCSV = (targetImages?: ImageData[]) => {
    const imagesToExport = targetImages || images.filter(img => img.status === 'completed' && img.metadata);
    if (imagesToExport.length === 0) return;

    const headers = ["File name", "Title", "Keywords", "Prompt", "Model", "AI Generated"];
    const rows = imagesToExport.map(img => [
      img.file.name,
      `"${img.metadata!.title.replace(/"/g, '""')}"`,
      `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`,
      `"${img.metadata!.prompt.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${img.metadata!.model}"`,
      img.isAiGenerated ? "Yes" : "No"
    ]);

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

    const headers = ["Filename", "Title", "Keywords", "Category", "Releases"];
    const rows = imagesToExport.map(img => {
      // Change extension based on user selection
      const fileNameWithExt = img.file.name.replace(/\.[^/.]+$/, "") + exportExtension;
      
      return [
        fileNameWithExt,
        `"${img.metadata!.title.replace(/"/g, '""')}"`,
        `"${img.metadata!.keywords.join(', ').replace(/"/g, '""')}"`,
        `"${img.metadata!.adobeCategory || "Graphic Resources"}"`,
        ""   // Releases
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
    const updated = [...apiKeys, newKey.trim()];
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    setNewKey('');
    addToast("API Key ditambahkan", "success");
  };

  const removeKey = (index: number) => {
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    localStorage.setItem('gemini_api_keys', JSON.stringify(updated));
    addToast("API Key dihapus", "info");
  };

  return (
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
            {isDragActive && (
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
                {selectedImage ? selectedImage.file.name : "Metadata Generator"}
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
                            "w-full px-4 py-3 text-left transition-colors flex flex-col gap-0.5",
                            selectedModel === m.id
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="text-[11px] font-bold">{m.name}</span>
                          <span className="text-[9px] text-slate-400 leading-tight">{m.description}</span>
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
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Persistent Upload Area at top (when images exist) */}
              {images.length > 0 && (
                <div className="space-y-4">
                  <div 
                    onClick={open}
                    className={cn(
                      "p-6 border-2 border-dashed rounded-3xl transition-all cursor-pointer group flex flex-col items-center justify-center text-center",
                      isDragActive 
                        ? "border-indigo-400 bg-indigo-50/50" 
                        : "border-slate-200 bg-white/20 hover:bg-white/40 hover:border-slate-300"
                    )}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Tambah Gambar Lagi</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Seret gambar ke sini atau klik untuk upload</p>
                    <p className="text-[9px] text-indigo-400 mt-1 font-medium">Upload hanya support file JPG, PNG atau SVG. Tetapi file di Microstock Wajib Format .EPS agar metadata berjalan.</p>
                  </div>

                  {/* Grid Image Gallery with Pagination */}
                  <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Daftar Gambar ({images.length})</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 hidden sm:block">Pilih gambar untuk melihat detail</p>
                    </div>

                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {images.map((img) => (
                        <div
                          key={img.id}
                          className={cn(
                            "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer",
                            selectedId === img.id 
                              ? "border-indigo-500 ring-4 ring-indigo-50 shadow-lg scale-105 z-10" 
                              : "border-transparent hover:border-slate-300 bg-white/50"
                          )}
                          onClick={() => setSelectedId(img.id)}
                        >
                          {img.file.type.startsWith('image/') ? (
                            <img 
                              src={img.preview} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-2 text-slate-400">
                              <FileText className="w-8 h-8 mb-1" />
                              <span className="text-[8px] font-bold uppercase truncate w-full text-center">
                                {img.file.name.split('.').pop()}
                              </span>
                            </div>
                          )}
                          
                          {/* Status Indicators */}
                          {img.status === 'completed' && (
                            <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm z-20">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                          {img.status === 'processing' && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                            </div>
                          )}
                          {img.status === 'error' && (
                            <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm z-20">
                              <AlertCircle className="w-2.5 h-2.5" />
                            </div>
                          )}

                          {/* Hover Actions */}
                          <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-30">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateSingleMetadata(img.id);
                              }}
                              disabled={isGenerating || img.status === 'processing'}
                              className="p-1.5 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                              title="Generate Metadata"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(img.id);
                              }}
                              className="p-1.5 bg-white text-red-500 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                              title="Hapus Gambar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Settings above Generate All */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Minimal Kata Judul</label>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{minTitleWords} kata</span>
                          </div>
                          <input 
                            type="range" 
                            min="5" 
                            max="20" 
                            value={minTitleWords} 
                            onChange={(e) => setMinTitleWords(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Jumlah Kata Kunci</label>
                            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">{keywordCount} keywords</span>
                          </div>
                          <input 
                            type="range" 
                            min="10" 
                            max="50" 
                            value={keywordCount} 
                            onChange={(e) => setKeywordCount(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-6 flex items-center justify-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              className="sr-only" 
                              checked={autoProcess}
                              onChange={(e) => setAutoProcess(e.target.checked)}
                            />
                            <div className={cn(
                              "w-10 h-5 rounded-full transition-colors",
                              autoProcess ? "bg-indigo-500" : "bg-slate-200"
                            )} />
                            <div className={cn(
                              "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                              autoProcess ? "translate-x-5" : "translate-x-0"
                            )} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Auto Process</span>
                        </label>
                      </div>

                      <p className="text-[9px] text-slate-400 mt-4 italic text-center">
                        * Pengaturan ini akan diterapkan pada proses generate berikutnya.
                      </p>
                    </div>

                    {/* Generate All Button below list */}
                    <div className="mt-6 flex flex-col items-center gap-4">
                      <button
                        onClick={generateMetadata}
                        disabled={isGenerating || !images.some(img => img.status === 'pending' || img.status === 'error')}
                        className={cn(
                          "px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all shadow-xl",
                          isGenerating 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95"
                        )}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                        Generate Semua Metadata ({images.filter(img => img.status !== 'completed').length})
                      </button>

                      {/* Download All CSV Options below Generate All */}
                      {images.some(img => img.status === 'completed') && (
                        <div className="flex flex-wrap items-center justify-center gap-2" ref={dropdownRef}>
                          <AnimatePresence>
                            {activeDownloadMenu && !activeDownloadMenu.targetImages && (
                              <div className="relative">
                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden p-2"
                                >
                                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Ekstensi</span>
                                    <button onClick={() => setActiveDownloadMenu(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {(['.eps', '.jpg', '.png'] as const).map((ext) => (
                                      <button
                                        key={ext}
                                        onClick={() => setExportExtension(ext)}
                                        className={cn(
                                          "w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between",
                                          exportExtension === ext
                                            ? "bg-indigo-50 text-indigo-600"
                                            : "text-slate-600 hover:bg-slate-50"
                                        )}
                                      >
                                        {ext}
                                        {exportExtension === ext && <Check className="w-3.5 h-3.5" />}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (activeDownloadMenu.type === 'adobe') downloadAdobeStockCSV();
                                      else downloadShutterstockCSV();
                                      setActiveDownloadMenu(null);
                                    }}
                                    className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download CSV
                                  </button>
                                </motion.div>
                                <div className="flex flex-wrap items-center justify-center gap-2 opacity-50 pointer-events-none">
                                  <button className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Freepik
                                  </button>
                                  <button className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Adobe Stock
                                  </button>
                                  <button className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Shutterstock
                                  </button>
                                </div>
                              </div>
                            )}
                          </AnimatePresence>
                          
                          {(!activeDownloadMenu || activeDownloadMenu.targetImages) && (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <button
                                onClick={() => downloadCSV()}
                                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                title="Download Freepik CSV"
                              >
                                <Download className="w-4 h-4" />
                                Freepik
                              </button>
                              <button
                                onClick={() => setActiveDownloadMenu({ type: 'adobe' })}
                                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                title="Download Adobe Stock CSV"
                              >
                                <Download className="w-4 h-4" />
                                Adobe Stock
                              </button>
                              <button
                                onClick={() => setActiveDownloadMenu({ type: 'shutterstock' })}
                                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                title="Download Shutterstock CSV"
                              >
                                <Download className="w-4 h-4" />
                                Shutterstock
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedImage ? (
                <div className="space-y-6">
                  {/* Selected Image Header with Small Preview */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm flex-shrink-0 flex items-center justify-center">
                          {selectedImage.file.type.startsWith('image/') ? (
                            <img 
                              src={selectedImage.preview} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <FileText className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 truncate">{selectedImage.file.name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                              selectedImage.status === 'completed' ? "bg-green-100 text-green-600" :
                              selectedImage.status === 'error' ? "bg-red-100 text-red-600" :
                              "bg-indigo-100 text-indigo-600"
                            )}>
                              {selectedImage.status}
                            </span>
                            
                            {/* AI Generated Toggle */}
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
                                  selectedImage.isAiGenerated ? "bg-indigo-500" : "bg-slate-200"
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
                      <div className="flex items-center gap-2 justify-end">
                        {selectedImage.status !== 'processing' && (
                          <>
                            <button
                              onClick={() => regenerateSingleMetadata(selectedImage.id)}
                              disabled={isGenerating}
                              className={cn(
                                "p-2.5 border rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm",
                                selectedImage.status === 'completed' 
                                  ? "bg-white hover:bg-indigo-50 border-slate-200 text-indigo-600"
                                  : "bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white"
                              )}
                              title={selectedImage.status === 'completed' ? "Regenerate metadata" : "Generate metadata"}
                            >
                              <Sparkles className="w-4 h-4" />
                              {selectedImage.status === 'completed' ? "Regenerate" : "Generate"}
                            </button>
                            {selectedImage.status === 'completed' && (
                              <div className="flex items-center gap-1 relative" ref={singleDropdownRef}>
                                <AnimatePresence>
                                  {activeDownloadMenu && activeDownloadMenu.targetImages?.[0]?.id === selectedImage.id && (
                                    <div className="relative">
                                      <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden p-2"
                                      >
                                        <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-100">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Ekstensi</span>
                                          <button onClick={() => setActiveDownloadMenu(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="space-y-1">
                                          {(['.eps', '.jpg', '.png'] as const).map((ext) => (
                                            <button
                                              key={ext}
                                              onClick={() => setExportExtension(ext)}
                                              className={cn(
                                                "w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between",
                                                exportExtension === ext
                                                  ? "bg-indigo-50 text-indigo-600"
                                                  : "text-slate-600 hover:bg-slate-50"
                                              )}
                                            >
                                              {ext}
                                              {exportExtension === ext && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => {
                                            if (activeDownloadMenu.type === 'adobe') downloadAdobeStockCSV(activeDownloadMenu.targetImages);
                                            else downloadShutterstockCSV(activeDownloadMenu.targetImages);
                                            setActiveDownloadMenu(null);
                                          }}
                                          className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                        >
                                          <Download className="w-4 h-4" />
                                          Download CSV
                                        </button>
                                      </motion.div>
                                      <div className="flex items-center gap-2 opacity-50 pointer-events-none">
                                        <button className="p-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm">
                                          Freepik
                                        </button>
                                        <button className="p-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm">
                                          Adobe Stock
                                        </button>
                                        <button className="p-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold shadow-sm">
                                          Shutterstock
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </AnimatePresence>
                                
                                {(!activeDownloadMenu || activeDownloadMenu.targetImages?.[0]?.id !== selectedImage.id) && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => downloadCSV([selectedImage])}
                                      className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95"
                                      title="Download Freepik CSV"
                                    >
                                      <Download className="w-4 h-4" />
                                      Freepik
                                    </button>
                                    <button
                                      onClick={() => setActiveDownloadMenu({ type: 'adobe', targetImages: [selectedImage] })}
                                      className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95"
                                      title="Download Adobe Stock CSV"
                                    >
                                      <Download className="w-4 h-4" />
                                      Adobe Stock
                                    </button>
                                    <button
                                      onClick={() => setActiveDownloadMenu({ type: 'shutterstock', targetImages: [selectedImage] })}
                                      className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95"
                                      title="Download Shutterstock CSV"
                                    >
                                      <Download className="w-4 h-4" />
                                      Shutterstock
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                  {/* Metadata Section */}
                  <div className="space-y-6">
                    {selectedImage.status === 'completed' && selectedImage.metadata ? (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="flex justify-end">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                              >
                                Batal
                              </button>
                              <button 
                                onClick={saveEdit}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                              >
                                Simpan Perubahan
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={startEditing}
                              className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                            >
                              <Edit3 className="w-4 h-4" />
                              Edit Metadata
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-bold">Judul</label>
                            {!isEditing && (
                              <button 
                                onClick={() => copyToClipboard(selectedImage.metadata!.title, 'title')}
                                className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors text-indigo-500"
                                title="Copy Title"
                              >
                                {copiedField === 'title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={editData?.title || ''}
                              onChange={(e) => setEditData(prev => prev ? { ...prev, title: e.target.value } : null)}
                              className="w-full p-4 rounded-2xl bg-white border border-indigo-500 text-slate-800 font-medium shadow-sm focus:outline-none ring-2 ring-indigo-500/10"
                            />
                          ) : (
                            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 font-medium shadow-sm">
                              {selectedImage.metadata.title}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-bold">Deskripsi</label>
                            {!isEditing && (
                              <button 
                                onClick={() => copyToClipboard(selectedImage.metadata!.description, 'desc')}
                                className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors text-indigo-500"
                                title="Copy Description"
                              >
                                {copiedField === 'desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea 
                              rows={3}
                              value={editData?.description || ''}
                              onChange={(e) => setEditData(prev => prev ? { ...prev, description: e.target.value } : null)}
                              className="w-full p-4 rounded-2xl bg-white border border-indigo-500 text-slate-600 text-sm leading-relaxed shadow-sm focus:outline-none ring-2 ring-indigo-500/10 resize-none"
                            />
                          ) : (
                            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm leading-relaxed shadow-sm">
                              {selectedImage.metadata.description}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] uppercase tracking-[0.2em] text-indigo-600 font-bold">Kata Kunci</label>
                              <span className="text-[10px] text-slate-400">
                                {isEditing ? (editData?.keywords.split(',').filter(k => k.trim() !== '').length || 0) : selectedImage.metadata.keywords.length} keywords
                              </span>
                            </div>
                            {!isEditing && (
                              <button 
                                onClick={() => copyToClipboard(selectedImage.metadata!.keywords.join(', '), 'keywords')}
                                className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors text-indigo-500"
                                title="Copy Keywords"
                              >
                                {copiedField === 'keywords' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea 
                              rows={4}
                              value={editData?.keywords || ''}
                              onChange={(e) => setEditData(prev => prev ? { ...prev, keywords: e.target.value } : null)}
                              placeholder="Pisahkan dengan koma..."
                              className="w-full p-4 rounded-2xl bg-white border border-indigo-500 text-slate-600 text-sm leading-relaxed shadow-sm focus:outline-none ring-2 ring-indigo-500/10 resize-none"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {selectedImage.metadata.keywords.map((tag, i) => (
                                <span 
                                  key={i}
                                  className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-medium shadow-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ) : selectedImage.status === 'processing' ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                          <Sparkles className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">Menganalisis Gambar...</h3>
                          <p className="text-slate-500 text-sm">Gemini AI sedang membaca konten gambar Anda.</p>
                        </div>
                      </div>
                    ) : selectedImage.status === 'error' ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200">
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                          <X className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">Terjadi Kesalahan</h3>
                          <p className="text-slate-500 text-sm">{selectedImage.error}</p>
                        </div>
                        <button 
                          onClick={generateMetadata}
                          className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-100"
                        >
                          Coba Lagi
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white/40 backdrop-blur-md rounded-3xl border border-slate-200">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">Siap Generate</h3>
                          <p className="text-slate-500 text-sm">Klik tombol generate untuk membuat metadata otomatis.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div 
                  onClick={open}
                  className={cn(
                    "min-h-[400px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-[2.5rem] transition-all cursor-pointer group",
                    isDragActive 
                      ? "border-indigo-400 bg-indigo-50/50" 
                      : "border-slate-200 bg-white/40 hover:bg-white/60 hover:border-slate-300"
                  )}
                >
                  <div className="w-24 h-24 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                    <Upload className="w-10 h-10 text-indigo-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Mulai Generate Metadata</h3>
                  <p className="text-slate-500 max-w-sm mb-4">
                    Seret dan lepas gambar Anda di sini, atau klik untuk memilih file dari komputer Anda.
                  </p>
                  <div className="bg-indigo-50 p-4 rounded-2xl mb-8 border border-indigo-100 max-w-sm">
                    <p className="text-[11px] text-indigo-600 font-medium leading-relaxed">
                      Catatan: Upload hanya support file JPG, PNG atau SVG. Tetapi file yang di Microstock Wajib Format .EPS agar metadata berjalan.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-green-500" /> Support Bulk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-green-500" /> AI Analysis
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-green-500" /> SEO Ready
                    </span>
                  </div>
                </div>
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
                    apiKeys.map((key, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs font-mono text-slate-500 truncate max-w-[200px]">
                          {key.substring(0, 8)}••••••••{key.substring(key.length - 4)}
                        </span>
                        <button 
                          onClick={() => removeKey(i)}
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
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
  );
}
