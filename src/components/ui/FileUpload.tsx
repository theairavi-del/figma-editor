import { useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { processZipFile } from '../../utils/fileUtils';
import './FileUpload.css';

export function FileUpload() {
  const { setProject, setLoading, setError } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file containing HTML, CSS, and JS files');
      setUploadStatus('error');
      return;
    }

    setLoading(true);
    setUploadStatus('uploading');

    try {
      const result = await processZipFile(file);
      
      if (result.success && result.project) {
        setProject(result.project);
        setUploadStatus('idle');
      } else {
        setError(result.error || 'Failed to process ZIP file');
        setUploadStatus('error');
      }
    } catch {
      setError('An unexpected error occurred while processing the file');
      setUploadStatus('error');
    } finally {
      setLoading(false);
    }
  }, [setProject, setLoading, setError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

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
        className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${uploadStatus === 'error' ? 'error' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleInputChange}
          className="file-upload-input"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="file-upload-label">
          {uploadStatus === 'uploading' ? (
            <>
              <div className="file-upload-spinner" />
              <span className="file-upload-text">Processing...</span>
            </>
          ) : uploadStatus === 'error' ? (
            <>
              <span className="file-upload-icon error">⚠️</span>
              <span className="file-upload-text">Upload failed. Try again.</span>
            </>
          ) : (
            <>
              <span className="file-upload-icon">📤</span>
              <span className="file-upload-text">
                Drop your ZIP file here, or <span className="file-upload-link">click to browse</span>
              </span>
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
      </div>
    </div>
  );
}
