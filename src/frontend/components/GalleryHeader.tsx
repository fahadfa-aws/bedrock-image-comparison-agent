import React, { useState, useEffect } from 'react';
import { StorageStats } from '../../shared/types';

interface GalleryHeaderProps {
  models: string[];
  selectedModel: string | null;
  onModelChange: (modelId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: 'newest' | 'oldest' | 'model';
  onSortChange: (order: 'newest' | 'oldest' | 'model') => void;
  totalImages: number;
  storageStats: StorageStats | null;
}

const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  models,
  selectedModel,
  onModelChange,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  totalImages,
  storageStats,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input with 300ms delay
  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    const timeout = setTimeout(() => {
      onSearchChange(localSearchQuery);
    }, 300);

    setDebounceTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [localSearchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
  };

  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  };

  const getSortLabel = (order: 'newest' | 'oldest' | 'model'): string => {
    switch (order) {
      case 'newest':
        return 'Newest First';
      case 'oldest':
        return 'Oldest First';
      case 'model':
        return 'Model Name';
      default:
        return 'Newest First';
    }
  };

  return (
    <div className="gallery-header-controls">
      {/* Filter Controls Row */}
      <div className="gallery-controls-row">
        {/* Model Filter Dropdown */}
        <div className="control-group">
          <label htmlFor="model-filter" className="control-label">
            Filter by Model
          </label>
          <select
            id="model-filter"
            value={selectedModel || ''}
            onChange={(e) => onModelChange(e.target.value || null)}
            className="gallery-select"
          >
            <option value="">All Models</option>
            {models.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="control-group">
          <label htmlFor="search-input" className="control-label">
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="search-input"
              type="text"
              value={localSearchQuery}
              onChange={handleSearchChange}
              placeholder="Search by prompt..."
              className="gallery-search-input"
              style={{ paddingRight: localSearchQuery ? '2.5rem' : '0.75rem' }}
            />
            {localSearchQuery && (
              <button
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Clear search"
              >
                <svg
                  style={{ width: '1.25rem', height: '1.25rem' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sort Selector */}
        <div className="control-group">
          <label htmlFor="sort-selector" className="control-label">
            Sort By
          </label>
          <select
            id="sort-selector"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest' | 'model')}
            className="gallery-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="model">Model Name</option>
          </select>
        </div>
      </div>

      {/* Storage Statistics Row */}
      <div className="gallery-stats-bar">
        <div className="stats-info">
          <div className="stat-item">
            <strong>{totalImages}</strong> images
          </div>
          {storageStats && (
            <>
              <span className="stat-divider">|</span>
              <div className="stat-item">
                <strong>{formatStorageSize(storageStats.totalSize)}</strong> used
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GalleryHeader;
