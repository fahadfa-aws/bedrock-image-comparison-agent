import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput,
  ListObjectsV2CommandInput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ImageMetadata } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Configuration for S3 storage service
 */
export interface S3StorageConfig {
  buckets: {
    'us-east-1': string;
    'us-west-2': string;
  };
  signedUrlExpiration?: number; // in seconds
  endpoint?: string; // for LocalStack testing
}

/**
 * Result of an image upload operation
 */
export interface UploadResult {
  s3Key: string;
  s3Url: string;
  bucket: string;
  region: string;
}

/**
 * Service for managing image storage in AWS S3
 * Handles multi-region storage, signed URL generation, and metadata management
 */
export class S3StorageService {
  private s3Clients: Map<string, S3Client>;
  private buckets: Map<string, string>;
  private signedUrlExpiration: number;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(config: S3StorageConfig) {
    this.buckets = new Map([
      ['us-east-1', config.buckets['us-east-1']],
      ['us-west-2', config.buckets['us-west-2']]
    ]);

    this.signedUrlExpiration = config.signedUrlExpiration || 3600; // default 1 hour

    // Initialize S3 clients for both regions
    const clientConfig = config.endpoint ? { endpoint: config.endpoint } : {};
    
    this.s3Clients = new Map([
      ['us-east-1', new S3Client({ region: 'us-east-1', ...clientConfig })],
      ['us-west-2', new S3Client({ region: 'us-west-2', ...clientConfig })]
    ]);

    logger.info('S3StorageService initialized', {
      regions: Array.from(this.buckets.keys()),
      buckets: Array.from(this.buckets.values()),
      signedUrlExpiration: this.signedUrlExpiration
    });
  }

  /**
   * Upload an image to S3 with metadata
   * 
   * @param region - AWS region ('us-east-1' or 'us-west-2')
   * @param modelId - Model identifier for organizing images
   * @param imageBuffer - Image data as Buffer
   * @param metadata - Image metadata to store
   * @returns Upload result with S3 key and URL
   */
  async uploadImage(
    region: string,
    modelId: string,
    imageBuffer: Buffer,
    metadata: ImageMetadata
  ): Promise<UploadResult> {
    this.validateRegion(region);

    const client = this.s3Clients.get(region)!;
    const bucket = this.buckets.get(region)!;

    // Generate unique S3 key: {modelId}/{timestamp}-{uuid}.png
    const timestamp = Date.now();
    const uuid = this.generateUUID();
    const s3Key = `${modelId}/${timestamp}-${uuid}.png`;
    const metadataKey = `metadata/${modelId}/${timestamp}-${uuid}.json`;

    logger.info('Uploading image to S3', {
      region,
      bucket,
      s3Key,
      imageSize: imageBuffer.length
    });

    try {
      // Upload image file with retry logic
      await this.executeWithRetry(async () => {
        const putImageCommand = new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: imageBuffer,
          ContentType: 'image/png',
          ServerSideEncryption: 'AES256',
          Metadata: {
            modelId: metadata.modelId,
            modelName: metadata.modelName,
            generatedAt: metadata.generatedAt.toISOString()
          }
        });

        await client.send(putImageCommand);
      });

      logger.debug('Image uploaded successfully', { s3Key });

      const s3Url = `s3://${bucket}/${s3Key}`;

      // Update metadata with the actual S3 URL
      const updatedMetadata = {
        ...metadata,
        imageUrl: s3Url
      };

      // Upload metadata file with correct S3 URL
      await this.executeWithRetry(async () => {
        const metadataBuffer = Buffer.from(JSON.stringify(updatedMetadata, null, 2), 'utf-8');
        
        const putMetadataCommand = new PutObjectCommand({
          Bucket: bucket,
          Key: metadataKey,
          Body: metadataBuffer,
          ContentType: 'application/json',
          ServerSideEncryption: 'AES256'
        });

        await client.send(putMetadataCommand);
      });

      logger.debug('Metadata uploaded successfully', { metadataKey });

      logger.info('Image and metadata uploaded to S3', {
        region,
        bucket,
        s3Key,
        s3Url
      });

      return {
        s3Key,
        s3Url,
        bucket,
        region
      };

    } catch (error) {
      logger.error('Failed to upload image to S3', {
        region,
        bucket,
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a signed URL for accessing an image
   * 
   * @param region - AWS region where the image is stored
   * @param s3Key - S3 object key
   * @param expiresIn - URL expiration time in seconds (optional)
   * @returns Signed URL for accessing the image
   */
  async getSignedUrl(
    region: string,
    s3Key: string,
    expiresIn?: number
  ): Promise<string> {
    this.validateRegion(region);

    const client = this.s3Clients.get(region)!;
    const bucket = this.buckets.get(region)!;
    const expiration = expiresIn || this.signedUrlExpiration;

    logger.debug('Generating signed URL', {
      region,
      bucket,
      s3Key,
      expiresIn: expiration
    });

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key
      });

      const signedUrl = await getSignedUrl(client, command, {
        expiresIn: expiration
      });

      logger.debug('Signed URL generated', {
        s3Key,
        expiresIn: expiration
      });

      return signedUrl;

    } catch (error) {
      logger.error('Failed to generate signed URL', {
        region,
        bucket,
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an image and its metadata from S3
   * 
   * @param region - AWS region where the image is stored
   * @param s3Key - S3 object key
   */
  async deleteImage(
    region: string,
    s3Key: string
  ): Promise<void> {
    this.validateRegion(region);

    const client = this.s3Clients.get(region)!;
    const bucket = this.buckets.get(region)!;

    // Derive metadata key from image key
    const metadataKey = s3Key.replace(/^([^/]+)\//, 'metadata/$1/').replace(/\.png$/, '.json');

    logger.info('Deleting image from S3', {
      region,
      bucket,
      s3Key,
      metadataKey
    });

    try {
      // Delete image file
      await this.executeWithRetry(async () => {
        const deleteImageCommand = new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key
        });

        await client.send(deleteImageCommand);
      });

      logger.debug('Image deleted', { s3Key });

      // Delete metadata file
      await this.executeWithRetry(async () => {
        const deleteMetadataCommand = new DeleteObjectCommand({
          Bucket: bucket,
          Key: metadataKey
        });

        await client.send(deleteMetadataCommand);
      });

      logger.debug('Metadata deleted', { metadataKey });

      logger.info('Image and metadata deleted from S3', {
        region,
        bucket,
        s3Key
      });

    } catch (error) {
      logger.error('Failed to delete image from S3', {
        region,
        bucket,
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to delete image from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List images in a specific region with optional prefix filter
   * 
   * @param region - AWS region to list images from
   * @param prefix - Optional prefix to filter images (e.g., modelId)
   * @returns Array of image metadata
   */
  async listImages(
    region: string,
    prefix?: string
  ): Promise<ImageMetadata[]> {
    this.validateRegion(region);

    const client = this.s3Clients.get(region)!;
    const bucket = this.buckets.get(region)!;

    // List metadata files instead of image files for efficiency
    const metadataPrefix = prefix ? `metadata/${prefix}/` : 'metadata/';

    logger.info('Listing images from S3', {
      region,
      bucket,
      prefix: metadataPrefix
    });

    try {
      const metadataList: ImageMetadata[] = [];
      let continuationToken: string | undefined;

      // Paginate through all objects
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: metadataPrefix,
          ContinuationToken: continuationToken
        });

        const response = await client.send(listCommand);

        if (response.Contents) {
          // Load metadata for each file
          const metadataPromises = response.Contents
            .filter(obj => obj.Key?.endsWith('.json'))
            .map(async (obj) => {
              try {
                if (!obj.Key) return null;

                const getCommand = new GetObjectCommand({
                  Bucket: bucket,
                  Key: obj.Key
                });

                const response = await client.send(getCommand);
                const body = await response.Body?.transformToString();
                
                if (!body) return null;

                const metadata = JSON.parse(body) as ImageMetadata;
                
                // Convert date strings to Date objects
                if (metadata.generatedAt) {
                  metadata.generatedAt = new Date(metadata.generatedAt);
                }

                // Store the metadata key for deriving image S3 key if imageUrl is empty
                // This supports legacy metadata files created before the imageUrl fix
                (metadata as any)._metadataKey = obj.Key;

                // If imageUrl is empty, derive it from the metadata key
                if (!metadata.imageUrl || metadata.imageUrl === '') {
                  const imageKey = obj.Key.replace('metadata/', '').replace('.json', '.png');
                  metadata.imageUrl = `s3://${bucket}/${imageKey}`;
                  
                  logger.debug('Derived imageUrl from metadata key', {
                    metadataKey: obj.Key,
                    imageUrl: metadata.imageUrl
                  });
                }

                return metadata;
              } catch (error) {
                logger.error('Failed to load metadata file', {
                  key: obj.Key,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                return null;
              }
            });

          const results = await Promise.all(metadataPromises);
          const validMetadata = results.filter((m): m is ImageMetadata => m !== null);
          metadataList.push(...validMetadata);
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      logger.info('Images listed from S3', {
        region,
        bucket,
        count: metadataList.length
      });

      return metadataList;

    } catch (error) {
      logger.error('Failed to list images from S3', {
        region,
        bucket,
        prefix: metadataPrefix,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to list images from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an image exists in S3
   * 
   * @param region - AWS region where the image should be stored
   * @param s3Key - S3 object key
   * @returns true if image exists, false otherwise
   */
  async imageExists(
    region: string,
    s3Key: string
  ): Promise<boolean> {
    this.validateRegion(region);

    const client = this.s3Clients.get(region)!;
    const bucket = this.buckets.get(region)!;

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key
      });

      await client.send(headCommand);
      return true;

    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      
      logger.error('Error checking image existence', {
        region,
        bucket,
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute an operation with retry logic
   * 
   * @private
   * @param operation - Async operation to execute
   * @param retries - Number of retries remaining
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if error is retryable
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && retries > 0) {
        logger.warn('Retrying operation', {
          retriesRemaining: retries,
          error: error.message
        });

        // Exponential backoff
        const delay = this.RETRY_DELAY * (this.MAX_RETRIES - retries + 1);
        await this.sleep(delay);

        return this.executeWithRetry(operation, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   * 
   * @private
   * @param error - Error to check
   * @returns true if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'RequestTimeout',
      'RequestTimeoutException',
      'ServiceUnavailable',
      'ServiceUnavailableException',
      'ThrottlingException',
      'TooManyRequestsException',
      'InternalServerError',
      'InternalError'
    ];

    return retryableErrors.includes(error.name) || 
           error.$metadata?.httpStatusCode === 503 ||
           error.$metadata?.httpStatusCode === 500;
  }

  /**
   * Validate that the region is supported
   * 
   * @private
   * @param region - Region to validate
   */
  private validateRegion(region: string): void {
    if (!this.s3Clients.has(region)) {
      throw new Error(`Unsupported region: ${region}. Supported regions: ${Array.from(this.s3Clients.keys()).join(', ')}`);
    }
  }

  /**
   * Generate a simple UUID v4
   * 
   * @private
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Sleep for a specified duration
   * 
   * @private
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the bucket name for a specific region
   * 
   * @param region - AWS region
   * @returns Bucket name
   */
  getBucketName(region: string): string {
    this.validateRegion(region);
    return this.buckets.get(region)!;
  }

  /**
   * Get all configured regions
   * 
   * @returns Array of region names
   */
  getRegions(): string[] {
    return Array.from(this.s3Clients.keys());
  }
}
