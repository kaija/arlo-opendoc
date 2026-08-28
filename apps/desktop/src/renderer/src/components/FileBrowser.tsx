import React, { useState } from 'react';
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
  isLoading?: boolean;
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
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns true for file types the preview pane can render. */
function isPreviewable(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt');
}

// ── flattenVisible ─────────────────────────────────────────────────────────

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

// ── TreeRow ────────────────────────────────────────────────────────────────

function TreeRow({
  node,
  depth,
  isExpanded,
  isActive,
  isHovered,
  isLoading,
  isPreviewable,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
}: TreeRowProps): React.ReactElement {
  let background = 'transparent';
  if (isActive) {
    background = 'rgba(88,86,214,.08)';
  } else if (isHovered) {
    background = 'rgba(88,86,214,.04)';
  }

  // Non-previewable files are dimmed and show a not-allowed cursor
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

  const nameStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
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
        isExpanded ? (
          <ChevronDown size={12} style={{ flexShrink: 0, color: isActive ? '#5856D6' : '#8e8eaa' }} />
        ) : (
          <ChevronRight size={12} style={{ flexShrink: 0, color: isActive ? '#5856D6' : '#8e8eaa' }} />
        )
      ) : (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <FileTypeIcon fileName={node.name} />
        </span>
      )}
      <span style={nameStyle}>{node.name}</span>
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
}: FileBrowserProps): React.ReactElement {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const flatRows = flattenVisible(fileTree.children, 0, expandedPaths);
  const folderBasename = fileTree.name;

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: '#f8f8fc',
        borderRight: '1px solid rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header: folder basename */}
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
        {folderBasename}
      </div>

      {/* Scrollable tree body */}
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
              onMouseEnter={() => setHoveredPath(node.path)}
              onMouseLeave={() => setHoveredPath(null)}
              onClick={() => {
                // Directories toggle on single click
                if (node.kind === 'dir') {
                  onDirectoryToggle(node.path);
                }
                // Files open on double click — single click is a no-op
              }}
              onDoubleClick={() => {
                if (node.kind === 'file' && previewable) {
                  onFileClick(node.path);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
