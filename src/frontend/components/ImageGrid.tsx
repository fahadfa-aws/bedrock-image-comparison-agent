import React, { useEffect, useRef } from 'react';
import { ImageMetadata } from '../../shared/types';
import ImageCard from './ImageCard';
import LoadingIndicator from './LoadingIndicator';

interface ImageGridProps {
  images: ImageMetadata[];
  onImageClick: (image: ImageMetadata) => void;
  onImageDelete: (imageId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onImageClick,
  onImageDelete,
  onLoadMore,
  hasMore,
  isLoading,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Implement Intersection Observer for lazy loading
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Trigger onLoadMore when sentinel is visible
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px', // Trigger 100px before reaching the sentinel
        threshold: 0.1,
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  // Handle empty state when no images
  if (images.length === 0 && !isLoading) {
    return (
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
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3>No images yet</h3>
        <p>
          Generate some images to see them appear here. Switch to the Generate tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Responsive Grid Layout */}
      <div className="image-grid">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onClick={() => onImageClick(image)}
            onDelete={() => onImageDelete(image.id)}
          />
        ))}
      </div>

      {/* Sentinel element for Intersection Observer */}
      {hasMore && (
        <div 
          ref={sentinelRef} 
          style={{ 
            height: '5rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          {isLoading && <LoadingIndicator message="Loading more images..." />}
        </div>
      )}

      {/* Loading indicator for initial load */}
      {isLoading && images.length === 0 && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '4rem 0' 
        }}>
          <LoadingIndicator message="Loading images..." />
        </div>
      )}
    </div>
  );
};

export default ImageGrid;
