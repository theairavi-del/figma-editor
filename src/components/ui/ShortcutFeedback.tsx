import { useEffect, useState } from 'react';
import './ShortcutFeedback.css';

interface ShortcutFeedbackProps {
  action: string;
}

export function ShortcutFeedback({ action }: ShortcutFeedbackProps) {
  // State for animation - initialized on mount
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Animate progress bar
    const duration = 1000;
    const interval = 16; // ~60fps
    const steps = duration / interval;
    const decrement = 100 / steps;

    let currentProgress = 100;
    const timer = setInterval(() => {
      currentProgress -= decrement;
      const newProgress = Math.max(0, currentProgress);
      setProgress(newProgress);

      if (currentProgress <= 0) {
        clearInterval(timer);
        setVisible(false);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []); // Empty deps - animation runs once per mount

  if (!visible) return null;

  return (
    <div className="shortcut-feedback">
      <div className="shortcut-feedback-content">
        <span className="shortcut-feedback-icon">⌨️</span>
        <span className="shortcut-feedback-text">{action}</span>
      </div>
      <div 
        className="shortcut-feedback-progress"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
