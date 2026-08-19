export interface PngTreeMetadata {
  title: string;
  mainKeywords: string[];
  secondaryKeywords: string[];
  mainCopy: string;
}

export interface ErrorDiagnostic {
  type: 'rate_limit' | 'model_not_found' | 'invalid_key' | 'quota_exhausted' | 'network' | 'unknown';
  badge: string;
  title: string;
  description: string;
  rawMessage: string;
  modelName?: string;
  keyMasked?: string;
}

export interface ImageData {
  id: string;
  file: File;
  preview: string;
  hash?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  isAiGenerated: boolean;
  activeModel?: string;
  activeKey?: string;
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
  errorDiagnostic?: ErrorDiagnostic;
  processingTime?: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
