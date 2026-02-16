import './ErrorToast.css';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

export function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <div className="error-toast">
      <span className="error-toast-icon">⚠️</span>
      <span className="error-toast-message">{message}</span>
      <button className="error-toast-close" onClick={onClose}>
        <span>✕</span>
      </button>
    </div>
  );
}
