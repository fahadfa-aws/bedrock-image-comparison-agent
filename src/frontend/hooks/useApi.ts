import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ModelInfo, OptimizedPrompt, ImageGenerationResult } from '@shared/types';

// API base URL
const API_BASE = '/api';

// Custom hooks for API interactions
export const useModels = () => {
  return useQuery<{ models: ModelInfo[] }>({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/models`);
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useOptimizePrompt = () => {
  return useMutation({
    mutationFn: async (data: { originalPrompt: string; selectedModels: string[] }) => {
      const response = await axios.post(`${API_BASE}/optimize-prompt`, data);
      return response.data;
    },
  });
};

export const useGenerateImages = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (optimizedPrompts: OptimizedPrompt[]) => {
      const response = await axios.post(`${API_BASE}/generate-images`, { optimizedPrompts });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate gallery cache after successful image generation
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['imageStats'] });
    },
  });
};

export const useSaveModelSelection = () => {
  return useMutation({
    mutationFn: async (selectedModels: string[]) => {
      const response = await axios.post(`${API_BASE}/config/models`, { selectedModels });
      return response.data;
    },
  });
};

// Hook to manually invalidate gallery cache
export const useInvalidateGalleryCache = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['images'] });
    queryClient.invalidateQueries({ queryKey: ['imageStats'] });
  };
};

// Export gallery hooks
export { useImageGallery } from './useImageGallery';
export { useImageStats } from './useImageStats';
export { useImageActions } from './useImageActions';
