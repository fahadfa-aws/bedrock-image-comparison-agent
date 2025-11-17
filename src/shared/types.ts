// Shared types between backend and frontend

export interface ModelInfo {
  modelId: string;
  modelName: string;
  provider: 'Amazon' | 'Stability AI';
  region: 'us-east-1' | 'us-west-2';
  pricing: {
    perImage: number;
    currency: string;
  };
}

export interface OptimizedPrompt {
  modelId: string;
  modelName: string;
  provider: string;
  region: string;
  optimizedPrompt: string;
  parameters: ModelParameters;
  reasoning?: string;
}

export interface ModelParameters {
  // Common parameters
  width?: number;
  height?: number;
  quality?: 'standard' | 'premium';
  seed?: number;
  
  // Amazon Nova Canvas & Titan parameters
  cfgScale?: number;
  negativeText?: string; // Nova and Titan use this naming
  style?: string; // Nova Canvas styles
  numberOfImages?: number;
  
  // Stability AI parameters
  aspect_ratio?: string; // Stability uses aspect ratio instead of dimensions
  negative_prompt?: string; // Stability uses underscore naming
  output_format?: 'jpeg' | 'png' | 'webp';
  
  // Legacy/deprecated (kept for backward compatibility)
  negativePrompt?: string;
  steps?: number;
}

export interface ImageGenerationResult {
  modelId: string;
  modelName: string;
  provider: string;
  region: string;
  success: boolean;
  imageBase64?: string;
  imageUrl?: string; // S3 signed URL
  s3Key?: string; // S3 object key
  s3Bucket?: string; // S3 bucket name
  imageFormat?: 'png' | 'jpeg';
  generationTime: number;
  resolution?: {
    width: number;
    height: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  timestamp: Date;
}

export interface ApiError {
  error: string;
  message: string;
  resolution?: string;
  retryable?: boolean;
  modelId?: string;
}

export interface ModelDocumentation {
  modelId: string;
  modelName: string;
  provider: string;
  promptFormat: string;
  supportedParameters: ParameterSpec[];
  bestPractices: string[];
  examples: PromptExample[];
  lastUpdated: Date;
}

export interface ParameterSpec {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  validValues?: any[];
}

export interface PromptExample {
  description: string;
  prompt: string;
  parameters?: Record<string, any>;
}

// Gallery-related types

export interface ImageParameters {
  width: number;
  height: number;
  quality?: 'standard' | 'premium';
  seed?: number;
  cfgScale?: number;
  steps?: number;
  negativePrompt?: string;
  style?: string;
}

export interface ImageMetadata {
  id: string;
  imageUrl: string;
  modelId: string;
  modelName: string;
  region: string;
  originalPrompt: string;
  optimizedPrompt: string;
  parameters: ImageParameters;
  generatedAt: Date;
  resolution: {
    width: number;
    height: number;
  };
  fileSize: number;
  format: string;
  generationTime: number;
}

export interface StorageStats {
  totalImages: number;
  totalSize: number;
  sizeByModel: Record<string, number>;
  oldestImage: Date | null;
  newestImage: Date | null;
}
