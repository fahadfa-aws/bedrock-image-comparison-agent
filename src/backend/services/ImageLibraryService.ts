import { promises as fs } from 'fs';
import path from 'path';
import { ImageMetadata, StorageStats } from '../../shared/types.js';
import { logger } from '../logger.js';

/**
 * Service for managing image storage, metadata persistence, and retrieval operations
 * Implements caching, filtering, and search capabilities for the image gallery
 */
export class ImageLibraryService {
  private imageStoragePath: string;
  private metadataCache: Map<string, ImageMetadata>;
  private cacheTimestamp: number;
  private readonly cacheTTL: number = 60000; // 1 minute

  constructor(imageStoragePath: string) {
    this.imageStoragePath = imageStoragePath;
    this.metadataCache = new Map();
    this.cacheTimestamp = 0;
    logger.info('ImageLibraryService initialized', { imageStoragePath });
  }

  /**
   * Validate image ID to prevent path traversal attacks
   * 
   * @private
   * @param imageId - Image identifier to validate
   * @returns true if valid, false otherwise
   */
  private validateImageId(imageId: string): boolean {
    // Reject any path traversal attempts
    if (imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
      logger.warn('Path traversal attempt detected', { imageId });
      return false;
    }

    // Ensure alphanumeric with hyphens, colons, and dots only
    const isValid = /^[a-zA-Z0-9\-:.]+$/.test(imageId);
    
    if (!isValid) {
      logger.warn('Invalid image ID format', { imageId });
    }
    
    return isValid;
  }

  /**
   * Check if cache is still valid based on TTL
   * 
   * @private
   * @returns true if cache is valid, false if expired
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.cacheTTL;
  }

  /**
   * Scan image directory and load all metadata files
   * Updates in-memory cache with loaded metadata
   * 
   * @returns Array of ImageMetadata objects
   */
  async scanImageDirectory(): Promise<ImageMetadata[]> {
    logger.info('Scanning image directory', { path: this.imageStoragePath });

    try {
      // Ensure directory exists
      await fs.mkdir(this.imageStoragePath, { recursive: true });

      // Read all files in directory
      const files = await fs.readdir(this.imageStoragePath);
      
      // Filter for JSON metadata files
      const metadataFiles = files.filter(file => file.endsWith('.json'));
      
      logger.info('Found metadata files', { count: metadataFiles.length });

      // Load all metadata files in parallel
      const metadataPromises = metadataFiles.map(async (file) => {
        try {
          const filePath = path.join(this.imageStoragePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const metadata = JSON.parse(content);
          
          // Convert date strings to Date objects
          if (metadata.generatedAt) {
            metadata.generatedAt = new Date(metadata.generatedAt);
          }
          
          return metadata as ImageMetadata;
        } catch (error) {
          logger.error('Failed to load metadata file', { 
            file, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          return null;
        }
      });

      const results = await Promise.all(metadataPromises);
      
      // Filter out null results (corrupted files)
      const validMetadata = results.filter((m): m is ImageMetadata => m !== null);

      // Update cache
      this.metadataCache.clear();
      validMetadata.forEach(metadata => {
        this.metadataCache.set(metadata.id, metadata);
      });
      this.cacheTimestamp = Date.now();

      logger.info('Image directory scan completed', { 
        total: metadataFiles.length,
        valid: validMetadata.length,
        corrupted: metadataFiles.length - validMetadata.length
      });

      return validMetadata;
    } catch (error) {
      logger.error('Failed to scan image directory', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error(`Failed to scan image directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get metadata for a specific image
   * Checks cache first before file system access
   * 
   * @param imageId - Unique image identifier
   * @returns ImageMetadata or null if not found
   */
  async getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
    // Validate image ID
    if (!this.validateImageId(imageId)) {
      throw new Error('Invalid image ID');
    }

    // Check cache first if valid
    if (this.isCacheValid() && this.metadataCache.has(imageId)) {
      logger.debug('Returning cached metadata', { imageId });
      return this.metadataCache.get(imageId)!;
    }

    // Load from file system
    try {
      const metadataPath = path.join(this.imageStoragePath, `${imageId}.json`);
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);

      // Convert date strings to Date objects
      if (metadata.generatedAt) {
        metadata.generatedAt = new Date(metadata.generatedAt);
      }

      // Update cache
      this.metadataCache.set(imageId, metadata);

      logger.debug('Loaded metadata from file', { imageId });
      return metadata as ImageMetadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.debug('Metadata file not found', { imageId });
        return null;
      }
      
      logger.error('Failed to read metadata file', { 
        imageId, 
        error: error.message 
      });
      throw new Error(`Failed to read metadata: ${error.message}`);
    }
  }

  /**
   * Save image metadata to file system
   * Creates storage directory if it doesn't exist
   * 
   * @param imageId - Unique image identifier
   * @param metadata - Image metadata to save
   */
  async saveImageMetadata(imageId: string, metadata: ImageMetadata): Promise<void> {
    // Validate image ID
    if (!this.validateImageId(imageId)) {
      throw new Error('Invalid image ID');
    }

    try {
      // Ensure directory exists
      await fs.mkdir(this.imageStoragePath, { recursive: true });

      // Write metadata to JSON file with pretty formatting
      const metadataPath = path.join(this.imageStoragePath, `${imageId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      // Update cache
      this.metadataCache.set(imageId, metadata);

      logger.info('Saved image metadata', { imageId });
    } catch (error) {
      logger.error('Failed to save metadata', { 
        imageId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error(`Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete image and its metadata from storage
   * Removes from cache and handles missing files gracefully
   * 
   * @param imageId - Unique image identifier
   */
  async deleteImage(imageId: string): Promise<void> {
    // Validate image ID
    if (!this.validateImageId(imageId)) {
      throw new Error('Invalid image ID');
    }

    try {
      const imagePath = path.join(this.imageStoragePath, `${imageId}.png`);
      const metadataPath = path.join(this.imageStoragePath, `${imageId}.json`);

      // Delete both files, handling missing files gracefully
      const deletePromises = [
        fs.unlink(imagePath).catch(error => {
          if (error.code !== 'ENOENT') {
            throw error;
          }
          logger.debug('Image file not found during delete', { imageId });
        }),
        fs.unlink(metadataPath).catch(error => {
          if (error.code !== 'ENOENT') {
            throw error;
          }
          logger.debug('Metadata file not found during delete', { imageId });
        })
      ];

      await Promise.all(deletePromises);

      // Remove from cache
      this.metadataCache.delete(imageId);

      logger.info('Deleted image and metadata', { imageId });
    } catch (error) {
      logger.error('Failed to delete image', { 
        imageId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate storage statistics
   * 
   * @returns StorageStats object with totals and breakdowns
   */
  async getStorageStats(): Promise<StorageStats> {
    logger.debug('Calculating storage statistics');

    // Get all images (from cache or scan)
    let images: ImageMetadata[];
    if (this.isCacheValid() && this.metadataCache.size > 0) {
      images = Array.from(this.metadataCache.values());
    } else {
      images = await this.scanImageDirectory();
    }

    // Calculate statistics
    const totalImages = images.length;
    const totalSize = images.reduce((sum, img) => sum + img.fileSize, 0);
    
    // Group size by model ID
    const sizeByModel: Record<string, number> = {};
    images.forEach(img => {
      if (!sizeByModel[img.modelId]) {
        sizeByModel[img.modelId] = 0;
      }
      sizeByModel[img.modelId] += img.fileSize;
    });

    // Find oldest and newest images
    let oldestImage: Date | null = null;
    let newestImage: Date | null = null;

    if (images.length > 0) {
      const sortedByDate = [...images].sort((a, b) => 
        a.generatedAt.getTime() - b.generatedAt.getTime()
      );
      oldestImage = sortedByDate[0].generatedAt;
      newestImage = sortedByDate[sortedByDate.length - 1].generatedAt;
    }

    const stats: StorageStats = {
      totalImages,
      totalSize,
      sizeByModel,
      oldestImage,
      newestImage
    };

    logger.debug('Storage statistics calculated', { 
      totalImages, 
      totalSize,
      modelCount: Object.keys(sizeByModel).length
    });

    return stats;
  }

  /**
   * Filter images by model ID
   * 
   * @param images - Array of images to filter
   * @param modelId - Model ID to filter by
   * @returns Filtered array of images
   */
  filterByModel(images: ImageMetadata[], modelId: string): ImageMetadata[] {
    return images.filter(img => img.modelId === modelId);
  }

  /**
   * Search images by prompt text
   * Searches in both original and optimized prompts
   * 
   * @param images - Array of images to search
   * @param query - Search query string
   * @returns Filtered array of images matching the query
   */
  searchByPrompt(images: ImageMetadata[], query: string): ImageMetadata[] {
    if (!query || query.trim() === '') {
      return images;
    }

    const lowerQuery = query.toLowerCase().trim();
    
    return images.filter(img => {
      const originalPrompt = img.originalPrompt.toLowerCase();
      const optimizedPrompt = img.optimizedPrompt.toLowerCase();
      
      return originalPrompt.includes(lowerQuery) || optimizedPrompt.includes(lowerQuery);
    });
  }

  /**
   * Sort images by specified order
   * 
   * @param images - Array of images to sort
   * @param order - Sort order: 'newest', 'oldest', or 'model'
   * @returns Sorted array of images
   */
  sortImages(images: ImageMetadata[], order: 'newest' | 'oldest' | 'model'): ImageMetadata[] {
    const sorted = [...images];

    switch (order) {
      case 'newest':
        sorted.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());
        break;
      case 'model':
        sorted.sort((a, b) => {
          const modelCompare = a.modelId.localeCompare(b.modelId);
          if (modelCompare !== 0) return modelCompare;
          // If same model, sort by newest first
          return b.generatedAt.getTime() - a.generatedAt.getTime();
        });
        break;
    }

    return sorted;
  }

  /**
   * Invalidate the metadata cache
   * Forces next read to scan directory
   */
  invalidateCache(): void {
    this.cacheTimestamp = 0;
    logger.debug('Cache invalidated');
  }
}
