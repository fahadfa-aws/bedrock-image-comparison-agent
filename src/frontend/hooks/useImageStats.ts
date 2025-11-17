import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { StorageStats } from '@shared/types';

export const useImageStats = () => {
  const queryClient = useQueryClient();
  
  const query = useQuery<StorageStats>({
    queryKey: ['imageStats'],
    queryFn: async () => {
      const response = await axios.get('/api/images/stats');
      return response.data;
    },
    staleTime: 60000, // 1 minute
    // Refetch when cache is invalidated
    refetchOnMount: 'always',
  });

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ['imageStats'] });
  };

  const refetch = () => {
    return query.refetch();
  };

  return {
    stats: query.data || null,
    loading: query.isLoading,
    error: query.error,
    invalidateCache,
    refetch,
  };
};
