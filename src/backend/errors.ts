/**
 * Custom error classes for the Bedrock Image Comparison Agent
 * Provides structured error handling with user-friendly messages
 */

export class AuthenticationError extends Error {
  code = 'AUTH_ERROR';
  statusCode = 401;
  userMessage = 'Invalid AWS credentials. Please check your access key and secret key.';
  resolution = 'Verify IAM credentials in environment variables and ensure they are active.';

  constructor(message?: string) {
    super(message || 'Authentication failed');
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  code = 'PERMISSION_ERROR';
  statusCode = 403;
  userMessage = 'Insufficient permissions to access Bedrock models.';
  resolution = 'Ensure IAM user has bedrock:InvokeModel permission for both us-east-1 and us-west-2.';

  constructor(message?: string) {
    super(message || 'Permission denied');
    this.name = 'PermissionError';
  }
}

export class ModelInvocationError extends Error {
  code = 'MODEL_INVOCATION_ERROR';
  statusCode = 500;
  retryable: boolean;

  constructor(
    public modelId: string,
    public originalError: any,
    retryable: boolean = false
  ) {
    super(`Failed to invoke model ${modelId}`);
    this.name = 'ModelInvocationError';
    this.retryable = retryable;
  }

  getUserMessage(): string {
    const errorCode = this.originalError?.name || this.originalError?.code || '';
    const errorMessage = this.originalError?.message || '';

    if (errorCode === 'ThrottlingException' || errorCode === 'TooManyRequestsException') {
      return `Rate limit exceeded for ${this.modelId}. Please wait before retrying.`;
    }
    if (errorCode === 'ValidationException') {
      return `Invalid parameters for ${this.modelId}. Check prompt and parameters.`;
    }
    if (errorCode === 'ContentPolicyViolation' || errorMessage.includes('Content policy')) {
      return `Content policy violation: ${errorMessage}`;
    }
    if (errorCode === 'ServiceUnavailableException') {
      return `Service temporarily unavailable for ${this.modelId}. Please try again.`;
    }
    return `Failed to generate image with ${this.modelId}. Please try again.`;
  }

  isRetryable(): boolean {
    const errorCode = this.originalError?.name || this.originalError?.code || '';
    return ['ThrottlingException', 'TooManyRequestsException', 'ServiceUnavailableException', 'InternalServerError'].includes(errorCode);
  }
}

export class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends Error {
  code = 'TIMEOUT_ERROR';
  statusCode = 504;

  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class KnowledgeAssistantError extends Error {
  code = 'KNOWLEDGE_ASSISTANT_ERROR';
  statusCode = 503;
  hasCachedFallback: boolean;

  constructor(public modelId: string, hasCachedFallback: boolean = false) {
    super(`Failed to retrieve documentation for ${modelId}`);
    this.name = 'KnowledgeAssistantError';
    this.hasCachedFallback = hasCachedFallback;
  }

  getUserMessage(): string {
    if (this.hasCachedFallback) {
      return 'Using cached model documentation. Results may not reflect latest updates.';
    }
    return 'Unable to retrieve model documentation. Please try again later.';
  }
}
