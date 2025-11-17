import React from 'react';

interface ModelProgress {
  modelId: string;
  modelName: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  progress?: number;
  estimatedTimeRemaining?: number;
  message?: string;
  elapsedTime?: number;
}

interface LoadingIndicatorProps {
  message?: string;
  modelProgress?: ModelProgress[];
  overallMessage?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  message = 'Loading...',
  modelProgress,
  overallMessage
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getStatusIcon = (status: ModelProgress['status']): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'generating':
        return '🔄';
      case 'complete':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '⏳';
    }
  };

  const getStatusClass = (status: ModelProgress['status']): string => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'generating':
        return 'status-generating';
      case 'complete':
        return 'status-complete';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  };

  // If model progress is provided, show detailed progress view
  if (modelProgress && modelProgress.length > 0) {
    const completedCount = modelProgress.filter(m => m.status === 'complete').length;
    const totalCount = modelProgress.length;
    const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <div className="loading-indicator">
        <div className="loading-header">
          <h3>Generating Images</h3>
          {overallMessage && <p className="overall-message">{overallMessage}</p>}
          <div className="overall-progress">
            <div className="progress-text">
              {completedCount} of {totalCount} complete
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="model-progress-list">
          {modelProgress.map((model) => (
            <div key={model.modelId} className={`model-progress-item ${getStatusClass(model.status)}`}>
              <div className="progress-item-header">
                <div className="model-info">
                  <span className="status-icon">{getStatusIcon(model.status)}</span>
                  <span className="model-name">{model.modelName}</span>
                </div>
                <div className="progress-stats">
                  {model.elapsedTime !== undefined && (
                    <span className="elapsed-time">
                      {formatTime(model.elapsedTime / 1000)}
                    </span>
                  )}
                </div>
              </div>

              {model.status === 'generating' && (
                <div className="progress-details">
                  {model.progress !== undefined && (
                    <div className="progress-bar-container small">
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${model.progress}%` }}
                      />
                    </div>
                  )}
                  
                  <div className="progress-info">
                    {model.message && (
                      <span className="status-message">{model.message}</span>
                    )}
                    {model.estimatedTimeRemaining !== undefined && (
                      <span className="time-remaining">
                        ~{formatTime(model.estimatedTimeRemaining)} remaining
                      </span>
                    )}
                  </div>
                </div>
              )}

              {model.status === 'error' && model.message && (
                <div className="error-details">
                  <span className="error-message">{model.message}</span>
                </div>
              )}

              {model.status === 'complete' && (
                <div className="complete-details">
                  <span className="complete-message">
                    ✓ Generated successfully
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="loading-animation">
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  // Simple loading view (default)
  return (
    <div className="simple-loading">
      <div className="spinner-container">
        <div className="spinner large"></div>
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingIndicator;
