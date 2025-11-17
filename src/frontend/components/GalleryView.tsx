import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ImageMetadata, StorageStats } from '../../shared/types';
import { useToast } from '../contexts/ToastContext';
import GalleryHeader from './GalleryHeader';
import ImageGrid from './ImageGrid';
import ImageModal from './ImageModal';
import LoadingIndicator from './LoadingIndicator';
import ErrorDisplay from './ErrorDisplay';

interface GalleryViewProps {
  shouldRefresh?: boolean;
  onRefreshComplete?: () => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ shouldRefresh = false, onRefreshComplete }) => {
  // State management (Subtask 10.1)
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageMetadata[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'model'>('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageMetadata | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [urlExpirationTime, setUrlExpirationTime] = useState<number>(0);

  const { showSuccess, showError, showInfo } = useToast();

  // S3 signed URLs expire after 1 hour (3600 seconds)
  // We'll refresh URLs when they're 5 minutes from expiring
  const URL_EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds
  const URL_LIFETIME = 60 * 60 * 1000; // 1 hour in milliseconds

  // Fetch images with retry logic (Subtask 10.2)
  // Updated to handle S3 signed URLs with expiration tracking
  const fetchImages = useCallback(async (retryCount = 0): Promise<void> => {
    const maxRetries = 2;
    
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      const response = await fetch(`/api/images?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch images: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert date strings to Date objects
      // S3 signed URLs are already included in the response from the backend
      const imagesWithDates = data.images.map((img: any) => ({
        ...img,
        generatedAt: new Date(img.generatedAt),
      }));

      if (page === 1) {
        setImages(imagesWithDates);
      } else {
        setImages((prev) => [...prev, ...imagesWithDates]);
      }

      setHasMore(data.hasMore);
      
      // Track when URLs were fetched for expiration management
      const now = Date.now();
      setLastFetchTime(now);
      setUrlExpirationTime(now + URL_LIFETIME);
      
      console.debug('Images fetched with S3 signed URLs', {
        count: imagesWithDates.length,
        urlExpiresAt: new Date(now + URL_LIFETIME).toISOString()
      });
    } catch (err) {
      console.error('Error fetching images:', err);
      
      // Retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = 1000 * (retryCount + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchImages(retryCount + 1);
      }
      
      setError(err as Error);
      showError('Failed to load images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, showError, URL_LIFETIME]);

  // Fetch storage stats with retry logic (Subtask 10.3)
  const fetchStorageStats = useCallback(async (retryCount = 0): Promise<void> => {
    const maxRetries = 2;
    
    try {
      const response = await fetch('/api/images/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch storage stats: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert date strings to Date objects
      const statsWithDates = {
        ...data,
        oldestImage: data.oldestImage ? new Date(data.oldestImage) : null,
        newestImage: data.newestImage ? new Date(data.newestImage) : null,
      };

      setStorageStats(statsWithDates);
    } catch (err) {
      console.error('Error fetching storage stats:', err);
      
      // Retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = 1000 * (retryCount + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchStorageStats(retryCount + 1);
      }
      
      // Don't show error for stats - it's not critical
      console.error('Failed to fetch storage stats after retries');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchImages();
    fetchStorageStats();
  }, []);

  // Fetch more images when page changes
  useEffect(() => {
    if (page > 1) {
      fetchImages();
    }
  }, [page]);

  // Filtering and sorting logic (Subtask 10.4)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const applyFiltersAndSort = () => {
      setIsFiltering(true);

      let result = [...images];

      // Apply model filter
      if (selectedModel) {
        result = result.filter((img) => img.modelId === selectedModel);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(
          (img) =>
            img.originalPrompt.toLowerCase().includes(query) ||
            img.optimizedPrompt.toLowerCase().includes(query)
        );
      }

      // Apply sort order
      switch (sortOrder) {
        case 'newest':
          result.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
          break;
        case 'oldest':
          result.sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime());
          break;
        case 'model':
          result.sort((a, b) => a.modelId.localeCompare(b.modelId));
          break;
      }

      setFilteredImages(result);
      setIsFiltering(false);
    };

    // Debounce filter operations with 100ms delay
    timeoutId = setTimeout(applyFiltersAndSort, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [images, selectedModel, searchQuery, sortOrder]);

  // Check if S3 signed URLs need refreshing
  const needsUrlRefresh = useCallback((): boolean => {
    if (urlExpirationTime === 0) return false;
    
    const now = Date.now();
    const timeUntilExpiration = urlExpirationTime - now;
    
    // Refresh if URLs will expire within the buffer time
    return timeUntilExpiration <= URL_EXPIRATION_BUFFER;
  }, [urlExpirationTime, URL_EXPIRATION_BUFFER]);

  // Refresh signed URLs when they're close to expiring
  const refreshSignedUrls = useCallback(async () => {
    if (!needsUrlRefresh() || images.length === 0) return;

    console.info('Refreshing S3 signed URLs', {
      imageCount: images.length,
      timeUntilExpiration: urlExpirationTime - Date.now()
    });

    try {
      // Re-fetch images to get fresh signed URLs
      // This will update the images state with new URLs
      await fetchImages();
      
      console.debug('S3 signed URLs refreshed successfully');
    } catch (err) {
      console.error('Error refreshing signed URLs:', err);
      // Don't show error to user - this is a background operation
      // Images will still be accessible until they fully expire
    }
  }, [needsUrlRefresh, images.length, urlExpirationTime, fetchImages]);

  // Periodic check for URL expiration (every minute)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (needsUrlRefresh()) {
        refreshSignedUrls();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(intervalId);
  }, [needsUrlRefresh, refreshSignedUrls]);

  // Visibility change listener (Subtask 10.5)
  // Updated to also check for URL expiration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastFetch = Date.now() - lastFetchTime;
        
        // Refresh if more than 5 seconds since last fetch OR if URLs need refreshing
        if (timeSinceLastFetch > 5000 || needsUrlRefresh()) {
          setPage(1);
          fetchImages();
          fetchStorageStats();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastFetchTime, needsUrlRefresh, fetchImages, fetchStorageStats]);

  // Handle external refresh request (Subtask 11.3)
  useEffect(() => {
    if (shouldRefresh) {
      setPage(1);
      fetchImages();
      fetchStorageStats();
      
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    }
  }, [shouldRefresh, fetchImages, fetchStorageStats, onRefreshComplete]);

  // Image actions (Subtask 10.6)
  const handleImageClick = useCallback((image: ImageMetadata) => {
    setSelectedImage(image);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!selectedImage) return;

    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = selectedImage.imageUrl;
      link.download = `${selectedImage.modelId}-${selectedImage.id}.${selectedImage.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('Image downloaded successfully');
    } catch (err) {
      console.error('Error downloading image:', err);
      showError('Failed to download image');
    }
  }, [selectedImage, showSuccess, showError]);

  const handleDelete = useCallback(async (imageId?: string) => {
    const idToDelete = imageId || selectedImage?.id;
    if (!idToDelete) return;

    try {
      showInfo('Deleting image...');

      const response = await fetch(`/api/images/${idToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.statusText}`);
      }

      // Close modal if it's open
      if (selectedImage?.id === idToDelete) {
        setSelectedImage(null);
      }

      // Refresh images and stats
      setPage(1);
      await fetchImages();
      await fetchStorageStats();

      showSuccess('Image deleted successfully');
    } catch (err) {
      console.error('Error deleting image:', err);
      showError('Failed to delete image. Please try again.');
    }
  }, [selectedImage, showInfo, showSuccess, showError, fetchImages, fetchStorageStats]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [isLoading, hasMore]);

  const handleRetry = useCallback(() => {
    setPage(1);
    fetchImages();
    fetchStorageStats();
  }, [fetchImages, fetchStorageStats]);

  // Get unique model IDs for filter dropdown
  const uniqueModels = useMemo(() => {
    const modelSet = new Set(images.map((img) => img.modelId));
    return Array.from(modelSet).sort();
  }, [images]);

  // Render child components (Subtask 10.7)
  
  // Show loading indicator during initial fetch
  if (isLoading && images.length === 0 && !error) {
    return (
      <div className="gallery-view">
        <LoadingIndicator message="Loading gallery..." />
      </div>
    );
  }

  // Show error display on fetch failure with retry button
  if (error && images.length === 0) {
    return (
      <div className="gallery-view">
        <ErrorDisplay error={error} onRetry={handleRetry} />
      </div>
    );
  }

  // Show empty state when no images exist
  if (images.length === 0 && !isLoading) {
    return (
      <div className="gallery-view">
        <div className="gallery-empty-state">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="empty-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ width: '4rem', height: '4rem', color: '#dee2e6' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h2>No images yet</h2>
          <p>
            Your gallery is empty. Generate some images to see them appear here.
          </p>
        </div>
      </div>
    );
  }

  // Show filtered empty state when no results match filters
  const showFilteredEmptyState = filteredImages.length === 0 && images.length > 0 && !isLoading;

  return (
    <div className="gallery-view">
      {/* Render GalleryHeader with filter controls and stats */}
      <GalleryHeader
        models={uniqueModels}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        totalImages={filteredImages.length}
        storageStats={storageStats}
      />

      {/* Show filtering indicator */}
      {isFiltering && (
        <div className="gallery-filtering-indicator">
          <div className="filtering-spinner"></div>
          <span>Filtering...</span>
        </div>
      )}

      {/* Show filtered empty state */}
      {showFilteredEmptyState && (
        <div className="image-grid-empty">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="empty-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ width: '4rem', height: '4rem', color: '#dee2e6' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3>No matching images</h3>
          <p>
            No images match your current filters. Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Render ImageGrid with filtered images */}
      {!showFilteredEmptyState && (
        <ImageGrid
          images={filteredImages}
          onImageClick={handleImageClick}
          onImageDelete={handleDelete}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}

      {/* Render ImageModal when image is selected */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={handleCloseModal}
          onDownload={handleDownload}
          onDelete={() => handleDelete()}
        />
      )}
    </div>
  );
};

export default GalleryView;
