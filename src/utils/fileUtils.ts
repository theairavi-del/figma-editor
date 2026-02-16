import JSZip from 'jszip';
import type { Project, ProjectFile, FileUploadResult, ElementData } from '../types';

/**
 * Process a ZIP file and extract all contents
 */
export async function processZipFile(file: File): Promise<FileUploadResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const files: ProjectFile[] = [];
    let rootHtmlPath = '';

    // Extract all files from ZIP
    const filePromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;

      const promise = zipEntry.async('text').then(content => {
        const type = getFileType(relativePath);
        
        files.push({
          path: relativePath,
          content,
          type
        });

        // Find root HTML file
        if (type === 'html' && !rootHtmlPath) {
          // Prefer index.html or the HTML file at root level
          if (relativePath.toLowerCase().endsWith('index.html') || 
              !relativePath.includes('/')) {
            rootHtmlPath = relativePath;
          }
        }
      });

      filePromises.push(promise);
    });

    await Promise.all(filePromises);

    if (!rootHtmlPath && files.some(f => f.type === 'html')) {
      rootHtmlPath = files.find(f => f.type === 'html')!.path;
    }

    if (!rootHtmlPath) {
      return {
        success: false,
        error: 'No HTML file found in the ZIP archive'
      };
    }

    // Process HTML files to add visual IDs with shared counter
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

    const project: Project = {
      id: generateId(),
      name: file.name.replace('.zip', ''),
      files: processedFiles,
      rootHtmlPath,
      modifiedAt: Date.now()
    };

    return {
      success: true,
      project
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process ZIP file'
    };
  }
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
    rect: element.getBoundingClientRect(),
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
 * Create a ZIP file from project files
 */
export async function createZipFromProject(project: Project): Promise<Blob> {
  const zip = new JSZip();

  project.files.forEach(file => {
    // Remove injected styles when exporting
    let content = file.content;
    if (file.type === 'html') {
      content = content.replace(/<style data-injected="true">[\s\S]*?<\/style>\n?/g, '');
    }
    zip.file(file.path, content);
  });

  return zip.generateAsync({ type: 'blob' });
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
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Convert a number to pixels string
 */
export function toPixels(value: number): string {
  return `${value}px`;
}
