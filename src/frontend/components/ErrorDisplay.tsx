import React from 'react';
import { ApiError } from '@shared/types';

interface ErrorDisplayProps {
  error: ApiError | Error | null;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  severity?: 'error' | 'warning' | 'info';
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  title,
  onRetry, 
  onDismiss,
  showDetails = false,
  severity = 'error'
}) => {
  if (!error) return null;

  // Handle both ApiError and standard Error types
  const apiError = error as ApiError;
  const errorMessage = apiError.message || (error as Error).message || 'An unexpected error occurred';
  const errorCode = apiError.error || 'UNKNOWN_ERROR';
  const apiResolution = apiError.resolution;
  const isRetryable = apiError.retryable || false;
  const errorStack = typeof error === 'object' && 'stack' in error ? error.stack : undefined;

  // Use provided title or generate from error code
  const displayTitle = title || errorCode.replace(/_/g, ' ');

  // Get resolution suggestion
  const getResolutionSuggestion = (message: string): string | null => {
    // If API provided resolution, use it
    if (apiResolution) return apiResolution;

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('authentication') || lowerMessage.includes('credentials')) {
      return 'Check your AWS credentials in the environment configuration. Ensure your IAM user has the necessary Bedrock permissions.';
    }

    if (lowerMessage.includes('throttling') || lowerMessage.includes('rate limit')) {
      return 'You have exceeded the API rate limit. Please wait a few moments before trying again.';
    }

    if (lowerMessage.includes('content policy') || lowerMessage.includes('violation')) {
      return 'Your prompt may have violated content policies. Try rephrasing your prompt to avoid sensitive or inappropriate content.';
    }

    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid parameter')) {
      return 'One or more parameters are invalid. Check that your image parameters match the model\'s capabilities.';
    }

    if (lowerMessage.includes('timeout')) {
      return 'The request timed out. Image generation can take several minutes. Try again or simplify your prompt.';
    }

    if (lowerMessage.includes('mcp') || lowerMessage.includes('connection')) {
      return 'Unable to connect to the AWS Knowledge MCP server. Ensure the MCP server is running and accessible.';
    }

    if (lowerMessage.includes('model') && lowerMessage.includes('not found')) {
      return 'The selected model is not available. Try refreshing the model list or selecting a different model.';
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'Network error occurred. Check your internet connection and try again.';
    }

    if (lowerMessage.includes('s3') || lowerMessage.includes('storage')) {
      return 'Storage error occurred. Check your S3 bucket configuration and permissions.';
    }

    return null;
  };

  const checkIfRetryable = (message: string): boolean => {
    // If API specified retryable, use that
    if (isRetryable) return true;

    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('throttling') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('connection')
    );
  };

  const suggestion = getResolutionSuggestion(errorMessage);
  const canRetry = onRetry && checkIfRetryable(errorMessage);

  const getSeverityIcon = (): string => {
    switch (severity) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const getSeverityClass = (): string => {
    return `error-display-${severity}`;
  };

  return (
    <div className={`error-display ${getSeverityClass()}`}>
      <div className="error-header">
        <span className="error-icon">{getSeverityIcon()}</span>
        <h3 className="error-title">{displayTitle}</h3>
        {onDismiss && (
          <button className="dismiss-button" onClick={onDismiss} aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>

      <div className="error-content">
        <div className="error-message">
          {errorMessage}
        </div>

        {suggestion && (
          <div className="error-suggestion">
            <h4>Suggested Resolution:</h4>
            <p>{suggestion}</p>
          </div>
        )}

        {showDetails && errorStack && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre className="error-stack">{errorStack}</pre>
          </details>
        )}
      </div>

      <div className="error-actions">
        {canRetry && (
          <button className="retry-button" onClick={onRetry}>
            🔄 Retry
          </button>
        )}
        {onDismiss && (
          <button className="dismiss-button-secondary" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
