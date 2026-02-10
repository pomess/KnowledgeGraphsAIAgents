import { useState, useRef, useEffect } from 'react';
import { animate, spring } from 'animejs';
import type { CytoscapeElement } from '../api/graphApi';
import type { GraphViewerHandle } from './GraphViewer';
import './ExportMenu.css';

interface ExportMenuProps {
  elements: CytoscapeElement[];
  graphRef: React.RefObject<GraphViewerHandle | null>;
}

function download(content: string | Blob, filename: string, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportMenu({ elements, graphRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && menuRef.current) {
      animate(menuRef.current, {
        opacity: [0, 1],
        translateY: [5, 0],
        duration: 200,
        ease: spring({ stiffness: 250, damping: 18 }),
      });
    }
  }, [open]);

  if (elements.length === 0) return null;

  const handleExportPNG = () => {
    const cy = graphRef.current?.getCy();
    if (!cy) return;
    const dataUrl = cy.png({ full: true, scale: 2, bg: '#0b0f1a' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'graph.png';
    a.click();
    setOpen(false);
  };

  const handleExportJSON = () => {
    download(JSON.stringify(elements, null, 2), 'graph.json', 'application/json');
    setOpen(false);
  };

  const handleExportGEXF = async () => {
    try {
      const response = await fetch('/export?format=gexf');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      download(blob, 'graph.gexf', 'application/xml');
    } catch (err) {
      console.error('GEXF export failed:', err);
    }
    setOpen(false);
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/export?format=csv');
      if (!response.ok) throw new Error('Export failed');
      const text = await response.text();
      download(text, 'graph.csv', 'text/csv');
    } catch (err) {
      console.error('CSV export failed:', err);
    }
    setOpen(false);
  };

  return (
    <div className="export-menu-wrapper">
      <button
        className="export-toggle-btn"
        onClick={() => setOpen((v) => !v)}
        title="Export Graph"
      >
        &#x21E9;
      </button>
      {open && (
        <div ref={menuRef} className="export-dropdown" style={{ opacity: 0 }}>
          <button className="export-option" onClick={handleExportPNG}>PNG Image</button>
          <button className="export-option" onClick={handleExportJSON}>JSON (Cytoscape)</button>
          <button className="export-option" onClick={handleExportGEXF}>GEXF (Gephi)</button>
          <button className="export-option" onClick={handleExportCSV}>CSV</button>
        </div>
      )}
    </div>
  );
}
