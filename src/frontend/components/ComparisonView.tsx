import { useState, useEffect } from 'react';
import { ImageGenerationResult, OptimizedPrompt } from '@shared/types';

interface ComparisonViewProps {
  originalPrompt: string;
  results: ImageGenerationResult[];
  optimizedPrompts: OptimizedPrompt[];
  onImageClick: (result: ImageGenerationResult) => void;
  onDownload: (result: ImageGenerationResult) => void;
  onCopyPrompt: (prompt: string) => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalPrompt,
  results,
  optimizedPrompts,
  onImageClick,
  onDownload,
  onCopyPrompt,
}) => {
  const [modalImage, setModalImage] = useState<ImageGenerationResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getOptimizedPromptForModel = (modelId: string): string => {
    const optimized = optimizedPrompts.find(p => p.modelId === modelId);
    return optimized?.optimizedPrompt || '';
  };

  const handleImageClick = (result: ImageGenerationResult) => {
    setModalImage(result);
    onImageClick(result);
  };

  const handleDownload = (result: ImageGenerationResult) => {
    if (result.imageBase64) {
      const link = document.createElement('a');
      link.href = `data:image/${result.imageFormat || 'png'};base64,${result.imageBase64}`;
      link.download = `${result.modelName.replace(/\s+/g, '-')}-${Date.now()}.${result.imageFormat || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    onDownload(result);
  };

  const handleCopyPrompt = (modelId: string, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(modelId);
    setTimeout(() => setCopiedId(null), 2000);
    onCopyPrompt(prompt);
  };

  const closeModal = () => {
    setModalImage(null);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalImage) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [modalImage]);

  return (
    <div className="comparison-content">
      {/* Results Summary */}
      <div className="results-summary">
        <span className="results-count">
          {results.length} image{results.length !== 1 ? 's' : ''} generated successfully
        </span>
      </div>

      {/* Image Grid */}
      <div className="image-grid">
        {results.map((result) => {
          const optimizedPrompt = getOptimizedPromptForModel(result.modelId);
          const isCopied = copiedId === result.modelId;

          if (!result.success) {
            // Handle error object or string
            const errorMessage = typeof result.error === 'string' 
              ? result.error 
              : result.error?.message || 'An error occurred during image generation';
            
            return (
              <div key={result.modelId} className="comparison-card">
                <div className="error-state">
                  <div className="error-icon">⚠️</div>
                  <h4>Generation Failed</h4>
                  <p className="model-name">{result.modelName}</p>
                  <p className="error-message">{errorMessage}</p>
                  <p className="generation-time-error">
                    Attempted in {(result.generationTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={result.modelId} className="comparison-card">
              {/* Card Header */}
              <div className="card-header">
                <div className="model-info">
                  <h3 className="model-name">{result.modelName}</h3>
                  <span className="model-id">{result.modelId}</span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="region-badge">{result.region}</span>
                  </div>
                </div>
                <div className="generation-time">
                  ⏱️ {(result.generationTime / 1000).toFixed(1)}s
                </div>
              </div>

              {/* Image Container */}
              <div 
                className="image-container"
                onClick={() => handleImageClick(result)}
                style={{ cursor: 'pointer' }}
              >
                {result.imageBase64 && (
                  <img
                    src={`data:image/${result.imageFormat || 'png'};base64,${result.imageBase64}`}
                    alt={result.modelName}
                    className="comparison-image"
                  />
                )}
              </div>

              {/* Image Metadata */}
              <div className="image-metadata">
                <h4>Image Details</h4>
                <div className="metadata-grid">
                  {result.resolution && (
                    <>
                      <div className="metadata-item">
                        <span className="label">Width</span>
                        <span className="value">{result.resolution.width}px</span>
                      </div>
                      <div className="metadata-item">
                        <span className="label">Height</span>
                        <span className="value">{result.resolution.height}px</span>
                      </div>
                    </>
                  )}
                  <div className="metadata-item">
                    <span className="label">Format</span>
                    <span className="value">{result.imageFormat?.toUpperCase() || 'PNG'}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="label">Region</span>
                    <span className="value">{result.region}</span>
                  </div>
                </div>
              </div>

              {/* Optimized Prompt Display */}
              {optimizedPrompt && (
                <div className="optimized-prompt-display">
                  <h4>Optimized Prompt</h4>
                  <div className="prompt-text">{optimizedPrompt}</div>
                  <button
                    onClick={() => handleCopyPrompt(result.modelId, optimizedPrompt)}
                    className="copy-prompt-button"
                  >
                    {isCopied ? '✓ Copied!' : '📋 Copy Prompt'}
                  </button>
                </div>
              )}

              {/* Card Actions */}
              <div className="card-actions">
                <button
                  onClick={() => handleDownload(result)}
                  className="download-button"
                >
                  ⬇️ Download Image
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Modal */}
      {modalImage && modalImage.success && modalImage.imageBase64 && (
        <div 
          className="image-modal-overlay"
          onClick={closeModal}
        >
          <div className="image-modal-container">
            <button
              onClick={closeModal}
              className="image-modal-close"
              aria-label="Close modal"
            >
              ✕
            </button>
            <img
              src={`data:image/${modalImage.imageFormat || 'png'};base64,${modalImage.imageBase64}`}
              alt={modalImage.modelName}
              className="image-modal-img"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="image-modal-label">
              <p className="font-semibold text-[#212529]">{modalImage.modelName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;
