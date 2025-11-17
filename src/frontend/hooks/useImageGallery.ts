import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ImageMetadata } from '@shared/types';

interface UseImageGalleryParams {
  model?: string | null;
  search?: string;
  sort?: 'newest' | 'oldest' | 'model';
  page?: number;
  limit?: number;
}

interface ImageGalleryResponse {
  images: ImageMetadata[];
  total: number;
  page: number;
  hasMore: boolean;
}

export const useImageGallery = (params: UseImageGalleryParams = {}) => {
  const queryClient = useQueryClient();

  const query = useQuery<ImageGalleryResponse>({
    queryKey: ['images', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      
      if (params.model) {
        queryParams.append('model', params.model);
      }
      if (params.search) {
        queryParams.append('search', params.search);
      }
      if (params.sort) {
        queryParams.append('sort', params.sort);
      }
      if (params.page !== undefined) {
        queryParams.append('page', params.page.toString());
      }
      if (params.limit !== undefined) {
        queryParams.append('limit', params.limit.toString());
      }

      const response = await axios.get(`/api/images?${queryParams.toString()}`);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
    // Refetch when cache is invalidated
    refetchOnMount: 'always',
  });

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ['images'] });
  };

  const refetch = () => {
    return query.refetch();
  };

  return {
    images: query.data?.images || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    hasMore: query.data?.hasMore || false,
    loading: query.isLoading,
    error: query.error,
    invalidateCache,
    refetch,
  };
};
