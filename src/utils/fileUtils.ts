import JSZip from 'jszip';
import type { Project, ProjectFile, FileUploadResult, ElementData, FileValidationResult, FileProgress } from '../types';

// Configuration constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_COUNT = 500;

/**
 * Validate file before processing
 */
export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(MAX_FILE_SIZE)})`
    };
  }

  // Check file extension
  if (!file.name.endsWith('.zip')) {
    return {
      valid: false,
      error: 'Please upload a ZIP file (.zip extension required)'
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Process a ZIP file and extract all contents with progress tracking
 */
export async function processZipFile(
  file: File,
  onProgress?: (progress: FileProgress) => void
): Promise<FileUploadResult> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  try {
    onProgress?.({ stage: 'reading', percent: 10 });

    // Read the ZIP file
    const zipData = await file.arrayBuffer();
    
    onProgress?.({ stage: 'parsing', percent: 25 });
    
    const zip = await JSZip.loadAsync(zipData);
    const files: ProjectFile[] = [];
    let rootHtmlPath = '';

    // Get list of files
    const zipEntries: { path: string; entry: JSZip.JSZipObject }[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        zipEntries.push({ path: relativePath, entry: zipEntry });
      }
    });

    // Check file count
    if (zipEntries.length > MAX_FILES_COUNT) {
      return {
        success: false,
        error: `ZIP contains too many files (${zipEntries.length}). Maximum allowed: ${MAX_FILES_COUNT}`
      };
    }

    // Check for potentially dangerous files
    const dangerousFiles = zipEntries.filter(({ path }) => {
      const lowerPath = path.toLowerCase();
      return lowerPath.endsWith('.exe') || 
             lowerPath.endsWith('.dll') || 
             lowerPath.endsWith('.bat') ||
             lowerPath.endsWith('.sh') ||
             lowerPath.includes('__MACOSX');
    });

    if (dangerousFiles.length > 0) {
      return {
        success: false,
        error: `ZIP contains unsupported file types. Please remove: ${dangerousFiles.map(f => f.path).join(', ')}`
      };
    }

    onProgress?.({ stage: 'extracting', percent: 40, current: 0, total: zipEntries.length });

    // Extract all files from ZIP with progress
    let processedCount = 0;
    const filePromises: Promise<void>[] = [];

    for (const { path: relativePath, entry: zipEntry } of zipEntries) {
      const promise = (async () => {
        try {
          // Check file extension
          const ext = relativePath.split('.').pop()?.toLowerCase() || '';
          const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'].includes(ext);
          
          // Read content appropriately
          let content: string;
          if (isBinary) {
            // For binary files, we'll store a placeholder or base64
            const blob = await zipEntry.async('blob');
            content = URL.createObjectURL(blob); // Store as blob URL for images
          } else {
            content = await zipEntry.async('text');
          }

          const type = getFileType(relativePath);
          
          files.push({
            path: relativePath,
            content,
            type,
            size: content.length
          });

          // Find root HTML file
          if (type === 'html' && !rootHtmlPath) {
            // Prefer index.html or the HTML file at root level
            const lowerPath = relativePath.toLowerCase();
            if (lowerPath.endsWith('index.html') || !relativePath.includes('/')) {
              rootHtmlPath = relativePath;
            }
          }

          processedCount++;
          onProgress?.({ 
            stage: 'extracting', 
            percent: 40 + Math.round((processedCount / zipEntries.length) * 30),
            current: processedCount,
            total: zipEntries.length 
          });
        } catch (err) {
          console.warn(`Failed to extract ${relativePath}:`, err);
          // Continue processing other files
        }
      })();

      filePromises.push(promise);
    }

    await Promise.all(filePromises);

    onProgress?.({ stage: 'finalizing', percent: 75 });

    // Validate we found HTML files
    if (!rootHtmlPath && files.some(f => f.type === 'html')) {
      rootHtmlPath = files.find(f => f.type === 'html')!.path;
    }

    if (!rootHtmlPath) {
      return {
        success: false,
        error: 'No HTML file found in the ZIP archive. Please include at least one HTML file.'
      };
    }

    // Process HTML files to add visual IDs with shared counter
    onProgress?.({ stage: 'processing', percent: 85 });
    
    let globalIdCounter = 0;
    const processedFiles = files.map(file => {
      if (file.type === 'html') {
        const processed = addVisualIdsToHtml(file.content, globalIdCounter);
        // Count IDs added to update counter for next file
        const idMatches = processed.match(/data-visual-id="el-(\d+)"/g);
        if (idMatches) {
          const maxId = Math.max(...idMatches.map(match => {
            const num = match.match(/el-(\d+)/);
            return num ? parseInt(num[1], 10) : 0;
          }));
          globalIdCounter = maxId + 1;
        }
        return {
          ...file,
          content: processed
        };
      }
      return file;
    });

    onProgress?.({ stage: 'complete', percent: 100 });

    const project: Project = {
      id: generateId(),
      name: sanitizeProjectName(file.name.replace(/\.zip$/i, '')),
      files: processedFiles,
      rootHtmlPath,
      modifiedAt: Date.now(),
      totalSize: file.size
    };

    return {
      success: true,
      project
    };
  } catch (error) {
    console.error('ZIP processing error:', error);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('encrypted')) {
        return {
          success: false,
          error: 'ZIP file is password protected. Please remove the password and try again.'
        };
      }
      if (error.message.includes('corrupted') || error.message.includes('invalid')) {
        return {
          success: false,
          error: 'ZIP file appears to be corrupted. Please check the file and try again.'
        };
      }
      return {
        success: false,
        error: `Failed to process ZIP file: ${error.message}`
      };
    }
    
    return {
      success: false,
      error: 'Failed to process ZIP file. Please try again with a different file.'
    };
  }
}

/**
 * Sanitize project name for safe use
 */
function sanitizeProjectName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .trim()
    .substring(0, 50) || 'Untitled Project';
}

/**
 * Add unique data-visual-id attributes to all elements in HTML
 * Uses a project-scoped counter to avoid collisions
 */
function addVisualIdsToHtml(html: string, startCounter = 0): string {
  let idCounter = startCounter;
  
  // Use a more robust approach with DOM parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  function addIds(element: Element) {
    if (element.nodeType === Node.ELEMENT_NODE) {
      if (!(element as HTMLElement).hasAttribute('data-visual-id')) {
        (element as HTMLElement).setAttribute('data-visual-id', `el-${idCounter++}`);
      }
      Array.from(element.children).forEach(addIds);
    }
  }
  
  addIds(doc.documentElement);
  
  return doc.documentElement.outerHTML;
}

/**
 * Determine file type from extension
 */
function getFileType(path: string): ProjectFile['type'] {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['css'].includes(ext)) return 'css';
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'js';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'image';
  return 'other';
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract element data from a DOM element
 */
export function extractElementData(element: Element): ElementData | null {
  if (!(element instanceof HTMLElement)) return null;
  
  const visualId = element.getAttribute('data-visual-id');
  if (!visualId) return null;

  const computedStyle = window.getComputedStyle(element);
  const styles: Record<string, string> = {};
  
  // Extract relevant styles
  const relevantProperties = [
    'color', 'background-color', 'font-size', 'font-family', 'font-weight',
    'line-height', 'text-align', 'padding', 'margin', 'border-radius',
    'border-width', 'border-color', 'border-style', 'display', 'position',
    'width', 'height', 'top', 'left', 'right', 'bottom', 'z-index',
    'flex-direction', 'justify-content', 'align-items', 'gap'
  ];
  
  relevantProperties.forEach(prop => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== 'initial' && value !== 'none' && value !== 'auto') {
      styles[prop] = value;
    }
  });

  // Get inline styles
  const inlineStyles: Record<string, string> = {};
  for (let i = 0; i < element.style.length; i++) {
    const prop = element.style.item(i);
    inlineStyles[prop] = element.style.getPropertyValue(prop);
  }

  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (!attr.name.startsWith('data-visual') && attr.name !== 'style') {
      attributes[attr.name] = attr.value;
    }
  }

  const rect = element.getBoundingClientRect();

  return {
    id: visualId,
    tagName: element.tagName.toLowerCase(),
    className: element.className || undefined,
    styles: { ...styles, ...inlineStyles },
    attributes,
    textContent: element.children.length === 0 ? element.textContent || undefined : undefined,
    children: Array.from(element.children)
      .map(child => extractElementData(child))
      .filter((child): child is ElementData => child !== null),
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom
    },
    parentId: element.parentElement?.getAttribute('data-visual-id') || undefined,
    index: Array.from(element.parentElement?.children || []).indexOf(element)
  };
}

/**
 * Build a complete HTML document from files
 */
export function buildHtmlDocument(project: Project): string {
  const htmlFile = project.files.find(f => f.path === project.rootHtmlPath);
  if (!htmlFile) return '';

  let html = htmlFile.content;

  // Inject CSS files
  const cssFiles = project.files.filter(f => f.type === 'css');
  cssFiles.forEach(cssFile => {
    const cssPath = cssFile.path.split('/').pop();
    // Check if already linked
    if (!html.includes(`href="${cssFile.path}"`) && !html.includes(`href="${cssPath}"`)) {
      const styleTag = `<style data-injected="true">\n/* ${cssFile.path} */\n${cssFile.content}\n</style>`;
      html = html.replace('</head>', `${styleTag}\n</head>`);
    }
  });

  // Inline styles for CSS files
  cssFiles.forEach(cssFile => {
    const pathPattern = new RegExp(
      `<link[^>]*href=["'][^"']*${escapeRegex(cssFile.path)}["'][^>]*>`,
      'gi'
    );
    html = html.replace(pathPattern, `<style>${cssFile.content}</style>`);
  });

  return html;
}

/**
 * Create a ZIP file from project files with progress tracking
 */
export async function createZipFromProject(
  project: Project,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const totalFiles = project.files.length;

  project.files.forEach((file, index) => {
    // Remove injected styles when exporting
    let content = file.content;
    if (file.type === 'html') {
      content = content.replace(/<style data-injected="true">[\s\S]*?<\/style>\n?/g, '');
    }
    zip.file(file.path, content);
    
    onProgress?.(Math.round(((index + 1) / totalFiles) * 80));
  });

  onProgress?.(90);

  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    onProgress?.(90 + Math.round(metadata.percent * 0.1));
  });

  onProgress?.(100);
  return blob;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert pixels to a number
 */
export function parsePixels(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Convert a number to pixels string
 */
export function toPixels(value: number): string {
  return `${value}px`;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000 } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = delayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Retry failed');
}
