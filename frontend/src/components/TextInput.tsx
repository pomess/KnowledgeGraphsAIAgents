import { useRef, useState, useEffect } from 'react';
import { animate, createScope, stagger, spring } from 'animejs';
import './TextInput.css';

interface TextInputProps {
  onGenerate: (text: string, files: File[], url?: string, mode?: 'replace' | 'merge') => void;
  isLoading: boolean;
  hasGraph?: boolean;
}

export default function TextInput({ onGenerate, isLoading, hasGraph }: TextInputProps) {
  const root = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [error, setError] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const glowAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const scope = createScope({ root }).add(() => {
      // Stagger input groups entrance
      animate('.input-group', {
        opacity: [0, 1],
        translateY: [20, 0],
        delay: stagger(100),
        duration: 600,
        ease: spring({ stiffness: 120, damping: 15 }),
      });

      // Looping glow pulse on generate button when idle
      glowAnimRef.current = animate('.generate-btn', {
        boxShadow: [
          '0 4px 6px rgba(0,0,0,0.1)',
          '0 4px 20px rgba(56, 189, 248, 0.4)',
        ],
        loop: true,
        alternate: true,
        duration: 2000,
        ease: 'inOut(2)',
      });
    });
    return () => scope.revert();
  }, []);

  // Animate error message in/out
  useEffect(() => {
    if (error && errorRef.current) {
      animate(errorRef.current, {
        translateY: [10, 0],
        opacity: [0, 1],
        duration: 400,
        ease: spring({ stiffness: 150, damping: 12 }),
      });
    }
  }, [error]);

  const handleGenerate = () => {
    if (!text && files.length === 0 && !url.trim()) {
      setError('Please provide text, upload a file, or enter a URL.');
      return;
    }
    setError('');

    // Multi-stage spring click keyframe
    if (btnRef.current) {
      animate(btnRef.current, {
        scale: [1, 0.92, 1.05, 1],
        duration: 500,
        ease: spring({ stiffness: 300, damping: 10 }),
      });
    }
    onGenerate(text, files, url.trim() || undefined, mergeMode ? 'merge' : 'replace');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  return (
    <div ref={root} className="text-input-section">
      <div className="input-group">
        <label htmlFor="text-input">Plain Text</label>
        <textarea
          id="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text here (e.g., 'Alice lives in Paris. She works for the Sorbonne.')"
        />
      </div>

      <div className="input-group">
        <label>Upload Documents</label>
        <div className="file-upload">
          <label htmlFor="file-input" className="custom-file-label">
            {files.length > 0
              ? `${files.length} file(s) selected`
              : 'Click to upload files (.txt, .pdf, .docx, .csv)'}
          </label>
          <input
            type="file"
            id="file-input"
            multiple
            accept=".txt,.pdf,.docx,.doc,.csv"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="url-input">Website URL</label>
        <input
          type="url"
          id="url-input"
          className="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://en.wikipedia.org/wiki/..."
        />
      </div>

      {hasGraph && (
        <div className="input-group merge-toggle-row">
          <label className="merge-toggle-label">
            <input
              type="checkbox"
              checked={mergeMode}
              onChange={(e) => setMergeMode(e.target.checked)}
              className="merge-checkbox"
            />
            <span>Add to existing graph</span>
          </label>
        </div>
      )}

      <button
        ref={btnRef}
        className="generate-btn input-group"
        onClick={handleGenerate}
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : mergeMode ? 'Merge into Graph' : 'Generate Graph'}
      </button>

      {error && (
        <div ref={errorRef} className="error-message" style={{ opacity: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
