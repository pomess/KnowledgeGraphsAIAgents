import { useEffect, useRef, useState } from 'react';
import { animate, spring } from 'animejs';
import { deleteNode as apiDeleteNode, updateNode as apiUpdateNode } from '../api/graphApi';
import type { CytoscapeElement } from '../api/graphApi';
import './NodeDetailPanel.css';

/** Visual config per entity type — matches GraphViewer/GraphLegend */
const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  Person:       { bg: '#064e3b', border: '#059669' },
  Organization: { bg: '#1e1b4b', border: '#4338ca' },
  Location:     { bg: '#451a03', border: '#b45309' },
  Document:     { bg: '#1c1917', border: '#78716c' },
  Entity:       { bg: '#1e293b', border: '#334155' },
};

interface NodeDetailPanelProps {
  nodeId: string;
  elements: CytoscapeElement[];
  onClose: () => void;
  onAskAbout: (question: string) => void;
  onGraphUpdated?: (elements: CytoscapeElement[]) => void;
  onFocusNode?: (nodeId: string, hops?: number) => void;
  isFocused?: boolean;
  onClearFocus?: () => void;
}

interface Relationship {
  direction: 'out' | 'in';
  label: string;
  targetId: string;
  targetType: string;
}

export default function NodeDetailPanel({ nodeId, elements, onClose, onAskAbout, onGraphUpdated, onFocusNode, isFocused, onClearFocus }: NodeDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState('');

  // Find node data
  const nodeData = elements.find((el) => el.data.id === nodeId && !el.data.source);
  const nodeType = nodeData?.data.type || 'Entity';
  const nodeLabel = nodeData?.data.label || nodeId;
  const colors = TYPE_COLORS[nodeType] || TYPE_COLORS.Entity;

  // Build node-to-type lookup
  const nodeTypeMap = new Map<string, string>();
  for (const el of elements) {
    if (el.data.id && !el.data.source) {
      nodeTypeMap.set(el.data.id, el.data.type || 'Entity');
    }
  }

  // Find relationships involving this node
  const relationships: Relationship[] = [];
  for (const el of elements) {
    if (el.data.source && el.data.target) {
      if (el.data.source === nodeId) {
        relationships.push({
          direction: 'out',
          label: el.data.label || 'related to',
          targetId: el.data.target,
          targetType: nodeTypeMap.get(el.data.target) || 'Entity',
        });
      } else if (el.data.target === nodeId) {
        relationships.push({
          direction: 'in',
          label: el.data.label || 'related to',
          targetId: el.data.source,
          targetType: nodeTypeMap.get(el.data.source) || 'Entity',
        });
      }
    }
  }

  // Entrance animation
  useEffect(() => {
    if (panelRef.current) {
      animate(panelRef.current, {
        opacity: [0, 1],
        translateX: [20, 0],
        duration: 350,
        ease: spring({ stiffness: 200, damping: 16 }),
      });
    }
  }, [nodeId]);

  const handleAsk = () => {
    onAskAbout(`Tell me about ${nodeLabel}`);
    onClose();
  };

  const handleDelete = async () => {
    try {
      const result = await apiDeleteNode(nodeId);
      onGraphUpdated?.(result.elements);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSaveType = async () => {
    if (!editType.trim() || editType === nodeType) {
      setIsEditing(false);
      return;
    }
    try {
      const result = await apiUpdateNode(nodeId, { type: editType.trim() });
      onGraphUpdated?.(result.elements);
      setIsEditing(false);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  return (
    <div ref={panelRef} className="node-detail-panel" style={{ opacity: 0 }}>
      <div className="node-detail-header">
        <div className="node-detail-title-row">
          <span
            className="node-detail-badge"
            style={{ backgroundColor: colors.bg, borderColor: colors.border }}
          >
            {nodeType.charAt(0)}
          </span>
          <div className="node-detail-title-info">
            <span className="node-detail-name">{nodeLabel}</span>
            <span className="node-detail-type">{nodeType}</span>
          </div>
        </div>
        <button className="node-detail-close" onClick={onClose}>&times;</button>
      </div>

      <div className="node-detail-body">
        {relationships.length > 0 ? (
          <div className="node-detail-section">
            <span className="node-detail-section-label">Relationships ({relationships.length})</span>
            <div className="node-detail-relations">
              {relationships.map((rel, i) => (
                <div key={i} className="node-detail-rel">
                  {rel.direction === 'out' ? (
                    <span className="rel-arrow">
                      <span className="rel-label">{rel.label}</span>
                      <span className="rel-direction">&rarr;</span>
                      <span className="rel-target">{rel.targetId}</span>
                    </span>
                  ) : (
                    <span className="rel-arrow">
                      <span className="rel-target">{rel.targetId}</span>
                      <span className="rel-direction">&rarr;</span>
                      <span className="rel-label">{rel.label}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="node-detail-empty">No relationships found</div>
        )}
      </div>

      <div className="node-detail-footer">
        <div className="node-detail-footer-row">
          <button className="node-detail-ask-btn" onClick={handleAsk}>
            Ask about {nodeLabel}
          </button>
          {isFocused ? (
            <button className="node-detail-focus-btn active" onClick={() => onClearFocus?.()}>
              Unfocus
            </button>
          ) : (
            <button className="node-detail-focus-btn" onClick={() => onFocusNode?.(nodeId, 2)}>
              Focus
            </button>
          )}
        </div>
        <div className="node-detail-footer-row edit-row">
          {!isEditing ? (
            <button
              className="node-detail-edit-btn"
              onClick={() => { setEditType(nodeType); setIsEditing(true); }}
            >
              Edit Type
            </button>
          ) : (
            <div className="edit-type-form">
              <input
                className="edit-type-input"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveType()}
                autoFocus
              />
              <button className="edit-type-save" onClick={handleSaveType}>Save</button>
            </div>
          )}
          <button className="node-detail-delete-btn" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
