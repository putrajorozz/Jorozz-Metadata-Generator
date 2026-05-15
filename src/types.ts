export interface PngTreeMetadata {
  title: string;
  mainKeywords: string[];
  secondaryKeywords: string[];
  mainCopy: string;
}

export interface ImageData {
  id: string;
  file: File;
  preview: string;
  hash?: string;
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
    pngTree?: PngTreeMetadata;
  };
  error?: string;
  processingTime?: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
