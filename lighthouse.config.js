/**
 * Lighthouse Configuration for Performance Testing
 * 
 * This configuration defines performance budgets and testing parameters
 * for the Bedrock Image Comparison Agent.
 */

export default {
  extends: 'lighthouse:default',
  
  settings: {
    // Only run performance audits
    onlyCategories: ['performance'],
    
    // Emulate mobile device
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    
    // Screen emulation
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
  },
  
  // Performance budgets
  budgets: [
    {
      resourceSizes: [
        {
          resourceType: 'script',
          budget: 500, // 500KB for JavaScript
        },
        {
          resourceType: 'stylesheet',
          budget: 100, // 100KB for CSS
        },
        {
          resourceType: 'image',
          budget: 2000, // 2MB for images
        },
        {
          resourceType: 'font',
          budget: 100, // 100KB for fonts
        },
        {
          resourceType: 'total',
          budget: 3000, // 3MB total
        },
      ],
      
      resourceCounts: [
        {
          resourceType: 'script',
          budget: 10, // Max 10 script files
        },
        {
          resourceType: 'stylesheet',
          budget: 5, // Max 5 CSS files
        },
        {
          resourceType: 'third-party',
          budget: 5, // Max 5 third-party requests
        },
      ],
      
      timings: [
        {
          metric: 'first-contentful-paint',
          budget: 2000, // 2 seconds
        },
        {
          metric: 'largest-contentful-paint',
          budget: 3000, // 3 seconds
        },
        {
          metric: 'interactive',
          budget: 4000, // 4 seconds
        },
        {
          metric: 'total-blocking-time',
          budget: 300, // 300ms
        },
        {
          metric: 'cumulative-layout-shift',
          budget: 0.1, // 0.1 CLS score
        },
        {
          metric: 'speed-index',
          budget: 3500, // 3.5 seconds
        },
      ],
    },
  ],
  
  // Custom audits
  audits: [
    'metrics',
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
    'bootup-time',
    'mainthread-work-breakdown',
    'network-requests',
    'network-rtt',
    'network-server-latency',
    'resource-summary',
    'third-party-summary',
    'unused-javascript',
    'unused-css-rules',
    'modern-image-formats',
    'uses-optimized-images',
    'uses-text-compression',
    'uses-responsive-images',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'dom-size',
    'critical-request-chains',
    'user-timings',
    'font-display',
    'unminified-css',
    'unminified-javascript',
  ],
};
