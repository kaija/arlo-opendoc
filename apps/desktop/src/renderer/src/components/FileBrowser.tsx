import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FileNode } from '@arlo-doc/shared';
import { FileTypeIcon } from './FileTypeIcon';

// ── Types ──────────────────────────────────────────────────────────────────

interface FileBrowserProps {
  fileTree: FileNode;
  expandedPaths: string[];
  activeFilePath: string | null;
  onFileClick: (path: string) => void;
  onDirectoryToggle: (path: string) => void;
  isLoading?: boolean | undefined;
  gitStatusMap?: Map<string, string> | undefined;
}

interface FlatRow {
  node: FileNode;
  depth: number;
}

interface TreeRowProps {
  node: FileNode;
  depth: number;
  isExpanded: boolean;
  isActive: boolean;
  isHovered: boolean;
  isLoading: boolean;
  isPreviewable: boolean;
  gitStatus?: string | undefined;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;

// ── Helpers ────────────────────────────────────────────────────────────────

function isPreviewable(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt');
}

function flattenVisible(nodes: FileNode[], depth: number, expandedPaths: string[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.kind === 'dir' && expandedPaths.includes(node.path)) {
      rows.push(...flattenVisible(node.children, depth + 1, expandedPaths));
    }
  }
  return rows;
}

// ── GitStatusBadge ─────────────────────────────────────────────────────────

interface GitStatusBadgeProps {
  status: string; // "M" | "A" | "D"
}

const STATUS_COLORS: Record<string, string> = {
  M: '#d98000',
  A: '#2da44e',
  D: '#cf222e',
};

function GitStatusBadge({ status }: GitStatusBadgeProps): React.ReactElement {
  const color = STATUS_COLORS[status] ?? '#8e8eaa';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color,
        lineHeight: 1,
        flexShrink: 0,
        letterSpacing: 0,
      }}
      aria-label={`git status: ${status}`}
    >
      {status}
    </span>
  );
}

// ── TreeRow ────────────────────────────────────────────────────────────────

function TreeRow({
  node,
  depth,
  isExpanded,
  isActive,
  isHovered,
  isLoading,
  isPreviewable,
  gitStatus,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
}: TreeRowProps): React.ReactElement {
  let background = 'transparent';
  if (isActive) background = 'rgba(88,86,214,.08)';
  else if (isHovered) background = 'rgba(88,86,214,.04)';

  const isUnsupported = node.kind === 'file' && !isPreviewable;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 26,
    paddingLeft: 8 + depth * 12,
    paddingRight: 8,
    borderRadius: 6,
    background,
    color: isActive ? '#5856D6' : isUnsupported ? '#b8b8cc' : '#1a1a2e',
    fontWeight: isActive ? 500 : 400,
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    cursor: isLoading ? 'default' : isUnsupported ? 'default' : 'pointer',
    userSelect: 'none',
    gap: 4,
    pointerEvents: isLoading ? 'none' : 'auto',
    opacity: isLoading ? 0.6 : isUnsupported ? 0.45 : 1,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {node.kind === 'dir' ? (
        isExpanded
          ? <ChevronDown size={12} style={{ flexShrink: 0, color: isActive ? '#5856D6' : '#8e8eaa' }} />
          : <ChevronRight size={12} style={{ flexShrink: 0, color: isActive ? '#5856D6' : '#8e8eaa' }} />
      ) : (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <FileTypeIcon fileName={node.name} />
        </span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
        {node.name}
      </span>
      {gitStatus && <GitStatusBadge status={gitStatus} />}
    </div>
  );
}

// ── FileBrowser ────────────────────────────────────────────────────────────

export function FileBrowser({
  fileTree,
  expandedPaths,
  activeFilePath,
  onFileClick,
  onDirectoryToggle,
  isLoading = false,
  gitStatusMap,
}: FileBrowserProps): React.ReactElement {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

  const flatRows = flattenVisible(fileTree.children, 0, expandedPaths);

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        background: '#f8f8fc',
        borderRight: '1px solid rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        userSelect: resizing ? 'none' : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px 6px',
          fontSize: 11,
          fontWeight: 500,
          color: '#8e8eaa',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {fileTree.name}
      </div>

      {/* Scrollable tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {flatRows.map(({ node, depth }) => {
          const previewable = node.kind === 'file' && isPreviewable(node.name);
          return (
            <TreeRow
              key={node.path}
              node={node}
              depth={depth}
              isExpanded={expandedPaths.includes(node.path)}
              isActive={node.path === activeFilePath}
              isHovered={hoveredPath === node.path}
              isLoading={isLoading}
              isPreviewable={previewable}
              gitStatus={gitStatusMap?.get(node.path)}
              onMouseEnter={() => setHoveredPath(node.path)}
              onMouseLeave={() => setHoveredPath(null)}
              onClick={() => { if (node.kind === 'dir') onDirectoryToggle(node.path); }}
              onDoubleClick={() => { if (node.kind === 'file' && previewable) onFileClick(node.path); }}
            />
          );
        })}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 4,
          height: '100%',
          cursor: 'col-resize',
          background: resizing ? 'rgba(88,86,214,.25)' : 'transparent',
          transition: 'background 0.15s',
          zIndex: 10,
        }}
        title="Drag to resize"
      />
    </div>
  );
}
