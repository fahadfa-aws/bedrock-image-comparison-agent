import React, { useState } from 'react';
import { ImageMetadata } from '../../shared/types';

interface ImageCardProps {
  image: ImageMetadata;
  onClick: () => void;
  onDelete: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onClick, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Format date for display
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle image load error (e.g., expired S3 signed URL)
  const handleImageError = () => {
    console.error('Failed to load image:', image.id);
    setImageError(true);
    setImageLoading(false);
  };

  // Handle successful image load
  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // Truncate prompt to first 100 characters
  const truncatePrompt = (prompt: string, maxLength: number = 100): string => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + '...';
  };

  // Get model badge color based on provider
  const getModelBadgeColor = (modelId: string): string => {
    if (modelId.includes('amazon')) {
      return 'bg-orange-500';
    } else if (modelId.includes('stability')) {
      return 'bg-purple-500';
    }
    return 'bg-blue-500';
  };

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to card click
    onDelete();
  };

  return (
    <div className="image-card">
      {/* Image Thumbnail */}
      <div className="image-card-thumbnail" onClick={onClick}>
        {/* Loading State */}
        {imageLoading && !imageError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f9fa'
          }}>
            <div className="spinner large"></div>
          </div>
        )}

        {/* Error State */}
        {imageError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f9fa',
            color: '#6c757d'
          }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '3rem', height: '3rem', marginBottom: '0.5rem' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span style={{ fontSize: '0.875rem' }}>Failed to load image</span>
          </div>
        )}

        {/* Image */}
        <img
          src={image.imageUrl}
          alt={image.optimizedPrompt}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="image-card-image"
          style={{ display: imageError ? 'none' : 'block' }}
        />
        
        {/* Overlay with zoom icon */}
        {!imageError && (
          <div className="image-card-overlay">
            <div className="zoom-icon">🔍</div>
          </div>
        )}

        {/* Delete Button */}
        {!imageError && (
          <button
            onClick={handleDeleteClick}
            className="image-card-delete"
            aria-label="Delete image"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Card Content */}
      <div className="image-card-content">
        <div className="image-card-header">
          <div 
            className="model-badge-card" 
            data-model={image.modelId}
          >
            {image.modelName}
          </div>
          <div className="model-id-card">{image.modelId}</div>
        </div>
        
        {/* Prompt Preview */}
        <div className="image-card-prompt">
          {image.optimizedPrompt}
        </div>

        {/* Metadata */}
        <div className="image-card-metadata">
          <div className="metadata-row">
            <span className="metadata-icon">📅</span>
            <span className="metadata-text">{formatDate(image.generatedAt)}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-icon">📐</span>
            <span className="metadata-text">{image.resolution.width}×{image.resolution.height}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
