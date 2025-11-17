/**
 * Bundle Analysis Script
 * 
 * Analyzes the production build to identify optimization opportunities
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface FileInfo {
  path: string;
  size: number;
  type: string;
}

interface BundleAnalysis {
  totalSize: number;
  fileCount: number;
  files: FileInfo[];
  byType: Record<string, { count: number; size: number }>;
  largestFiles: FileInfo[];
  recommendations: string[];
}

function analyzeBundle(): BundleAnalysis {
  const distPath = './dist';
  const files: FileInfo[] = [];
  const byType: Record<string, { count: number; size: number }> = {};
  
  function scanDirectory(dir: string, relativePath = '') {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const relPath = join(relativePath, item);
        
        try {
          const stats = statSync(fullPath);
          
          if (stats.isDirectory()) {
            scanDirectory(fullPath, relPath);
          } else if (stats.isFile()) {
            const ext = extname(item).slice(1) || 'unknown';
            const fileInfo: FileInfo = {
              path: relPath,
              size: stats.size,
              type: ext,
            };
            
            files.push(fileInfo);
            
            if (!byType[ext]) {
              byType[ext] = { count: 0, size: 0 };
            }
            byType[ext].count++;
            byType[ext].size += stats.size;
          }
        } catch (err) {
          // Skip files we can't access
        }
      }
    } catch (err) {
      console.error(`Error scanning directory ${dir}:`, err);
    }
  }
  
  scanDirectory(distPath);
  
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const largestFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 10);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  // Check JavaScript size
  const jsSize = byType['js']?.size || 0;
  if (jsSize > 500 * 1024) {
    recommendations.push('JavaScript bundle is large (>500KB). Consider code splitting.');
  }
  
  // Check CSS size
  const cssSize = byType['css']?.size || 0;
  if (cssSize > 100 * 1024) {
    recommendations.push('CSS bundle is large (>100KB). Consider removing unused styles.');
  }
  
  // Check for uncompressed files
  const hasGzip = files.some(f => f.path.endsWith('.gz'));
  if (!hasGzip) {
    recommendations.push('Enable gzip compression for production builds.');
  }
  
  // Check for source maps in production
  const hasSourceMaps = files.some(f => f.path.endsWith('.map'));
  if (hasSourceMaps) {
    recommendations.push('Remove source maps from production build to reduce size.');
  }
  
  // Check total bundle size
  if (totalSize > 3 * 1024 * 1024) {
    recommendations.push('Total bundle size exceeds 3MB. Review dependencies and assets.');
  }
  
  // Check for duplicate dependencies
  const jsFiles = files.filter(f => f.type === 'js');
  if (jsFiles.length > 10) {
    recommendations.push('Many JavaScript files detected. Consider bundling or code splitting strategy.');
  }
  
  return {
    totalSize,
    fileCount: files.length,
    files,
    byType,
    largestFiles,
    recommendations,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function printAnalysis(analysis: BundleAnalysis) {
  console.log('\n' + '='.repeat(60));
  console.log('📦 BUNDLE ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📊 Overview:');
  console.log(`  Total Size: ${formatSize(analysis.totalSize)}`);
  console.log(`  File Count: ${analysis.fileCount}`);
  
  console.log('\n📁 Size by File Type:');
  Object.entries(analysis.byType)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([type, info]) => {
      const percentage = ((info.size / analysis.totalSize) * 100).toFixed(1);
      console.log(`  .${type}: ${formatSize(info.size)} (${info.count} files, ${percentage}%)`);
    });
  
  console.log('\n📈 Largest Files:');
  analysis.largestFiles.forEach((file, index) => {
    const percentage = ((file.size / analysis.totalSize) * 100).toFixed(1);
    console.log(`  ${index + 1}. ${file.path}`);
    console.log(`     ${formatSize(file.size)} (${percentage}%)`);
  });
  
  if (analysis.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  } else {
    console.log('\n✓ Bundle size is optimized!');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Performance budget check
  console.log('\n🎯 Performance Budget Check:');
  
  const budgets = {
    'JavaScript': { actual: analysis.byType['js']?.size || 0, budget: 500 * 1024 },
    'CSS': { actual: analysis.byType['css']?.size || 0, budget: 100 * 1024 },
    'Images': { actual: (analysis.byType['png']?.size || 0) + (analysis.byType['jpg']?.size || 0) + (analysis.byType['jpeg']?.size || 0), budget: 2 * 1024 * 1024 },
    'Total': { actual: analysis.totalSize, budget: 3 * 1024 * 1024 },
  };
  
  Object.entries(budgets).forEach(([name, { actual, budget }]) => {
    const percentage = ((actual / budget) * 100).toFixed(1);
    const status = actual <= budget ? '✓' : '✗';
    const color = actual <= budget ? '' : ' (OVER BUDGET)';
    console.log(`  ${status} ${name}: ${formatSize(actual)} / ${formatSize(budget)} (${percentage}%)${color}`);
  });
  
  console.log('\n' + '='.repeat(60));
}

// Main execution
try {
  const analysis = analyzeBundle();
  printAnalysis(analysis);
  
  // Exit with error if over budget
  const totalBudget = 3 * 1024 * 1024;
  if (analysis.totalSize > totalBudget) {
    console.error('\n❌ Bundle size exceeds budget!');
    process.exit(1);
  }
  
  console.log('\n✓ Bundle analysis complete!');
} catch (error) {
  console.error('Error analyzing bundle:', error);
  process.exit(1);
}
