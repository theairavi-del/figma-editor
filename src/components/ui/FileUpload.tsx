import { useCallback, useState, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { processZipFile, validateFile, formatFileSize } from '../../utils/fileUtils';
import type { FileProgress } from '../../types';
import './FileUpload.css';

export function FileUpload() {
  const { setProject, setLoading, setError } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error' | 'success'>('idle');
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [recentFile, setRecentFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleProgress = useCallback((p: FileProgress) => {
    setProgress(p);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    // Reset state
    setUploadStatus('idle');
    setProgress(null);
    setRecentFile(file);
    setError(null);

    // Validate file before processing
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setUploadStatus('error');
      return;
    }

    setLoading(true);
    setUploadStatus('uploading');

    try {
      const result = await processZipFile(file, handleProgress);
      
      if (result.success && result.project) {
        setProject(result.project);
        setUploadStatus('success');
        
        // Reset after showing success briefly
        setTimeout(() => {
          setUploadStatus('idle');
          setProgress(null);
        }, 1000);
      } else {
        setError(result.error || 'Failed to process ZIP file');
        setUploadStatus('error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setUploadStatus('error');
    } finally {
      setLoading(false);
    }
  }, [setProject, setLoading, setError, handleProgress]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Handle multiple files - take the first valid ZIP
    const zipFile = Array.from(files).find(f => f.name.endsWith('.zip'));
    
    if (zipFile) {
      handleFile(zipFile);
    } else {
      setError('Please drop a ZIP file (.zip extension required)');
      setUploadStatus('error');
    }
  }, [handleFile, setError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input value so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFile]);

  const handleRetry = useCallback(() => {
    if (recentFile) {
      handleFile(recentFile);
    } else {
      setUploadStatus('idle');
      setError(null);
      setProgress(null);
    }
  }, [recentFile, handleFile, setError]);

  const getStageText = (stage: FileProgress['stage']) => {
    switch (stage) {
      case 'reading': return 'Reading file...';
      case 'parsing': return 'Parsing ZIP archive...';
      case 'extracting': return `Extracting files... ${progress?.current || 0}/${progress?.total || 0}`;
      case 'processing': return 'Processing HTML...';
      case 'finalizing': return 'Finalizing...';
      case 'complete': return 'Complete!';
      case 'error': return 'Error occurred';
      default: return 'Processing...';
    }
  };

  return (
    <div className="file-upload-container">
      <div className="file-upload-branding">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="16" cy="16" r="14" fill="#0d99ff"/>
          <circle cx="48" cy="16" r="14" fill="#f5a623"/>
          <circle cx="16" cy="48" r="14" fill="#14ae5c"/>
          <circle cx="48" cy="48" r="14" fill="#f24822"/>
        </svg>
        <h1>Figma-like Visual Website Builder</h1>
        <p>Edit HTML websites visually - just like Figma</p>
      </div>

      <div
        className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${uploadStatus === 'error' ? 'error' : ''} ${uploadStatus === 'success' ? 'success' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-testid="file-upload-zone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleInputChange}
          className="file-upload-input"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="file-upload-label">
          {uploadStatus === 'uploading' ? (
            <>
              <div className="file-upload-spinner" />
              <span className="file-upload-text">
                {progress ? getStageText(progress.stage) : 'Processing...'}
              </span>
              {progress && progress.percent > 0 && (
                <div className="file-upload-progress">
                  <div 
                    className="file-upload-progress-bar" 
                    style={{ width: `${progress.percent}%` }}
                  />
                  <span className="file-upload-progress-text">{progress.percent}%</span>
                </div>
              )}
            </>
          ) : uploadStatus === 'error' ? (
            <>
              <span className="file-upload-icon error">⚠️</span>
              <span className="file-upload-text">Upload failed</span>
              <button 
                className="file-upload-retry" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRetry();
                }}
              >
                Click to retry
              </button>
            </>
          ) : uploadStatus === 'success' ? (
            <>
              <span className="file-upload-icon success">✓</span>
              <span className="file-upload-text">Upload successful!</span>
            </>
          ) : (
            <>
              <span className="file-upload-icon">📤</span>
              <span className="file-upload-text">
                Drop your ZIP file here, or <span className="file-upload-link">click to browse</span>
              </span>
              {recentFile && (
                <span className="file-upload-recent">
                  Last: {recentFile.name} ({formatFileSize(recentFile.size)})
                </span>
              )}
            </>
          )}
        </label>
      </div>

      <div className="file-upload-info">
        <div className="file-upload-feature">
          <span className="feature-icon">📦</span>
          <div>
            <h3>Upload ZIP</h3>
            <p>Include HTML, CSS, JS, and images</p>
          </div>
        </div>
        <div className="file-upload-feature">
          <span className="feature-icon">✏️</span>
          <div>
            <h3>Edit Visually</h3>
            <p>Select and modify elements on canvas</p>
          </div>
        </div>
      </div>

      <div className="file-upload-formats">
        <p>Supported formats: HTML, CSS, JavaScript, images (PNG, JPG, SVG)</p>
        <p className="file-upload-limits">Maximum file size: {formatFileSize(50 * 1024 * 1024)}</p>
      </div>
    </div>
  );
}
