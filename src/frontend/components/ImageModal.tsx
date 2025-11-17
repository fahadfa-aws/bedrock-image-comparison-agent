import React, { useEffect } from 'react';
import { ImageMetadata } from '../../shared/types';

interface ImageModalProps {
  image: ImageMetadata;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  onClose,
  onDownload,
  onDelete,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(true);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle image load error (e.g., expired S3 signed URL)
  const handleImageError = () => {
    console.error('Failed to load image in modal:', image.id);
    setImageError(true);
    setImageLoading(false);
  };

  // Handle successful image load
  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Format date for display
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Format generation time
  const formatGenerationTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Handle copy prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(image.optimizedPrompt);
      // Note: Toast notification should be triggered by parent component
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  // Handle delete with confirmation
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      onDelete();
    }
  };

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="image-modal-overlay"
      onClick={handleBackdropClick}
    >
      {/* Modal Content */}
      <div className="image-modal-content">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="image-modal-close"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Modal Body - Responsive Layout */}
        <div className="image-modal-body">
          {/* Left Side - Image */}
          <div className="image-modal-image-section">
            {/* Loading State */}
            {imageLoading && !imageError && (
              <div className="image-modal-loading">
                <div className="spinner large"></div>
              </div>
            )}

            {/* Error State */}
            {imageError && (
              <div className="image-modal-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
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
                <p>Failed to load image</p>
                <p>The image URL may have expired. Try refreshing the gallery.</p>
              </div>
            )}

            {/* Image */}
            <img
              src={image.imageUrl}
              alt={image.optimizedPrompt}
              className="image-modal-image"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: imageError ? 'none' : 'block' }}
            />
          </div>

          {/* Right Side - Metadata */}
          <div className="image-modal-details">
            {/* Model Badge */}
            <div className="image-modal-section">
              <span
                className={`image-modal-badge ${
                  image.modelId.includes('amazon')
                    ? 'amazon'
                    : image.modelId.includes('stability')
                    ? 'stability'
                    : 'default'
                }`}
              >
                {image.modelName}
              </span>
              <p className="image-modal-model-id">{image.modelId}</p>
            </div>

            {/* Original Prompt */}
            <div className="image-modal-section">
              <h3>Original Prompt</h3>
              <p className="image-modal-prompt">
                {image.originalPrompt}
              </p>
            </div>

            {/* Optimized Prompt */}
            <div className="image-modal-section">
              <h3>Optimized Prompt</h3>
              <p className="image-modal-prompt">
                {image.optimizedPrompt}
              </p>
            </div>

            {/* Generation Parameters */}
            <div className="image-modal-section">
              <h3>Generation Parameters</h3>
              <div className="image-modal-params-grid">
                <div className="image-modal-param">
                  <span className="image-modal-param-label">Dimensions</span>
                  <p className="image-modal-param-value">
                    {image.parameters.width} × {image.parameters.height}
                  </p>
                </div>
                {image.parameters.quality && (
                  <div className="image-modal-param">
                    <span className="image-modal-param-label">Quality</span>
                    <p className="image-modal-param-value">
                      {image.parameters.quality}
                    </p>
                  </div>
                )}
                {image.parameters.seed !== undefined && (
                  <div className="image-modal-param">
                    <span className="image-modal-param-label">Seed</span>
                    <p className="image-modal-param-value">{image.parameters.seed}</p>
                  </div>
                )}
                {image.parameters.cfgScale !== undefined && (
                  <div className="image-modal-param">
                    <span className="image-modal-param-label">CFG Scale</span>
                    <p className="image-modal-param-value">{image.parameters.cfgScale}</p>
                  </div>
                )}
                {image.parameters.steps !== undefined && (
                  <div className="image-modal-param">
                    <span className="image-modal-param-label">Steps</span>
                    <p className="image-modal-param-value">{image.parameters.steps}</p>
                  </div>
                )}
                {image.parameters.style && (
                  <div className="image-modal-param">
                    <span className="image-modal-param-label">Style</span>
                    <p className="image-modal-param-value">{image.parameters.style}</p>
                  </div>
                )}
                {image.parameters.negativePrompt && (
                  <div className="image-modal-param image-modal-param-full">
                    <span className="image-modal-param-label">Negative Prompt</span>
                    <p className="image-modal-param-value">{image.parameters.negativePrompt}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="image-modal-section">
              <h3>Metadata</h3>
              <div className="image-modal-metadata">
                <div className="image-modal-metadata-row">
                  <span className="image-modal-metadata-label">Generated</span>
                  <span className="image-modal-metadata-value">{formatDate(image.generatedAt)}</span>
                </div>
                <div className="image-modal-metadata-row">
                  <span className="image-modal-metadata-label">Generation Time</span>
                  <span className="image-modal-metadata-value">
                    {formatGenerationTime(image.generationTime)}
                  </span>
                </div>
                <div className="image-modal-metadata-row">
                  <span className="image-modal-metadata-label">File Size</span>
                  <span className="image-modal-metadata-value">{formatFileSize(image.fileSize)}</span>
                </div>
                <div className="image-modal-metadata-row">
                  <span className="image-modal-metadata-label">Format</span>
                  <span className="image-modal-metadata-value">{image.format}</span>
                </div>
                <div className="image-modal-metadata-row">
                  <span className="image-modal-metadata-label">Region</span>
                  <span className="image-modal-metadata-value">{image.region}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="image-modal-actions">
              <button
                onClick={onDownload}
                className="image-modal-btn image-modal-btn-download"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download
              </button>
              <button
                onClick={handleCopyPrompt}
                className="image-modal-btn image-modal-btn-copy"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                Copy Prompt
              </button>
              <button
                onClick={handleDelete}
                className="image-modal-btn image-modal-btn-delete"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
