import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useImageActions = () => {
  const queryClient = useQueryClient();

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await axios.delete(`/api/images/${imageId}`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate both images and stats queries after successful delete
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['imageStats'] });
    },
  });

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error('Failed to download image');
    }
  };

  return {
    deleteImage: deleteImageMutation.mutate,
    deleteImageAsync: deleteImageMutation.mutateAsync,
    isDeleting: deleteImageMutation.isPending,
    deleteError: deleteImageMutation.error,
    downloadImage,
  };
};
