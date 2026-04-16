import { useState, useRef, useCallback } from "react";
import { Upload, FileText } from "lucide-react";
import { ingestText, ingestFile } from "../lib/api";

interface IngestPanelProps {
  onComplete: () => void;
  brain?: string;
}

type IngestResult = {
  success: boolean;
  pages_touched?: string[];
  summary?: string;
  error?: string;
};

export default function IngestPanel({ onComplete, brain }: IngestPanelProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [dragover, setDragover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTextIngest = async () => {
    if (!title.trim() || !content.trim() || loading) return;
    setLoading(true);
    setStatus("Reading source and building wiki pages...");
    setResult(null);
    try {
      const res = await ingestText(title.trim(), content.trim(), brain);
      setResult(res);
      if (res.success) {
        setTitle("");
        setContent("");
        onComplete();
      }
    } catch {
      setResult({ success: false, error: "Request failed. Is the backend running?" });
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const handleFileDrop = useCallback(
    async (file: File) => {
      setLoading(true);
      setStatus(`Ingesting ${file.name}...`);
      setResult(null);
      try {
        const res = await ingestFile(file, brain);
        setResult(res);
        if (res.success) onComplete();
      } catch {
        setResult({ success: false, error: "File upload failed." });
      } finally {
        setLoading(false);
        setStatus("");
      }
    },
    [onComplete]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  };

  return (
    <div className="ingest-panel">
      <h2>Ingest Source</h2>
      <p className="ingest-desc">Add new knowledge to your wiki from files or text.</p>

      <div
        className={`ingest-dropzone${dragover ? " dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="ingest-dropzone-icon">
          <Upload size={22} />
        </div>
        <div className="ingest-dropzone-text">
          Drop a file here, or <strong>click to browse</strong>
        </div>
        <div className="ingest-dropzone-hint">Accepts .md and .txt files</div>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      <div className="ingest-or">or paste text below</div>

      <div className="ingest-form">
        <input
          className="ingest-input"
          placeholder="Source title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />
        <textarea
          className="ingest-input ingest-textarea"
          placeholder="Paste the source content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
        />
        <button
          className="action-btn"
          onClick={handleTextIngest}
          disabled={loading || !title.trim() || !content.trim()}
        >
          {loading ? (
            <>
              <div className="spinner" />
              {status}
            </>
          ) : (
            <>
              <FileText size={16} />
              Ingest
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={`ingest-result ${result.success ? "success" : "error"}`}>
          {result.success ? (
            <>
              <h4>Ingest complete</h4>
              <p>{result.summary}</p>
              {result.pages_touched && result.pages_touched.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, marginTop: 8 }}>Pages touched:</p>
                  <ul>
                    {result.pages_touched.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <h4>Ingest failed</h4>
              <p>{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
