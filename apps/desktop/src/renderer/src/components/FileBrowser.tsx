import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Settings as SettingsIcon } from 'lucide-react';
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
  branch?: string | undefined;
  repoName?: string | undefined;
  showHidden?: boolean | undefined;
  onToggleHidden?: () => void;
  /** Opens the settings dialog. Renders the footer gear when provided. */
  onOpenSettings?: (() => void) | undefined;
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

/**
 * Mirror of isSupportedFile() from fileClickLogic.ts — kept local to avoid
 * importing renderer logic into a pure UI component.  Both lists must stay
 * in sync.  Controls whether a file row is clickable in the sidebar.
 */
const PREVIEWABLE_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.rst', '.adoc', '.tex',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.json5',
  '.yaml', '.yml', '.toml', '.ini', '.env',
  '.xml', '.svg',
  '.py', '.rb', '.php', '.java', '.kt', '.kts',
  '.go', '.rs', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  '.cs', '.swift', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.gql', '.proto',
  '.dockerfile', '.tf', '.tfvars', '.hcl', '.nginx',
  '.gradle', '.cmake', '.makefile',
  '.csv', '.log', '.diff', '.patch', '.lock',
  '.gitignore', '.gitattributes', '.editorconfig',
  '.eslintrc', '.prettierrc', '.babelrc',
]);

const NO_EXT_PREVIEWABLE = new Set([
  'makefile', 'dockerfile', 'jenkinsfile', 'gemfile', 'rakefile', 'procfile',
]);

function isPreviewable(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return NO_EXT_PREVIEWABLE.has(lower.split('/').pop() ?? lower);
  return PREVIEWABLE_EXTENSIONS.has(lower.slice(dotIdx));
}

function flattenVisible(nodes: FileNode[], depth: number, expandedPaths: string[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.kind === 'dir' && expandedPaths.includes(node.path)) {
      // Debug: log when expanding deep nodes
      if (depth >= 3) {
        console.log('[FileBrowser] expanding depth', depth, 'path:', node.path, 'children:', node.children.length);
      }
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
  M: 'var(--color-warning-strong)',
  A: 'var(--color-success-text)',
  D: 'var(--color-danger-text)',
};

function GitStatusBadge({ status }: GitStatusBadgeProps): React.ReactElement {
  const color = STATUS_COLORS[status] ?? 'var(--text-faint)';
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
  if (isActive) background = 'var(--color-accent-a08)';
  else if (isHovered) background = 'var(--color-accent-a04)';

  const isUnsupported = node.kind === 'file' && !isPreviewable;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 26,
    paddingLeft: 8 + Math.min(depth, 8) * 10,
    paddingRight: 8,
    borderRadius: 6,
    background,
    color: isActive ? 'var(--color-accent)' : isUnsupported ? 'var(--text-disabled)' : 'var(--text-body)',
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
          ? <ChevronDown size={12} style={{ flexShrink: 0, color: isActive ? 'var(--color-accent)' : 'var(--text-faint)' }} />
          : <ChevronRight size={12} style={{ flexShrink: 0, color: isActive ? 'var(--color-accent)' : 'var(--text-faint)' }} />
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
  branch,
  repoName,
  showHidden = false,
  onToggleHidden,
  onOpenSettings,
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

  useEffect(() => {
    if (expandedPaths.length > 0) {
      console.log(
        '[FileBrowser] expandedPaths count:', expandedPaths.length,
        'deepest:', expandedPaths.reduce((acc, p) => Math.max(acc, p.split('/').length), 0), 'levels'
      );
    }
  }, [expandedPaths]);

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        background: 'var(--surface-section)',
        borderRight: '1px solid var(--border)',
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
          padding: '10px 8px 6px 16px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {repoName ?? fileTree.name}
        </span>
        {branch && (
          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0, flexShrink: 0 }}>
            {branch}
          </span>
        )}
        {onToggleHidden && (
          <button
            onClick={onToggleHidden}
            title={showHidden ? '隱藏隱藏檔案' : '顯示隱藏檔案'}
            style={{
              marginLeft: 6,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showHidden ? 'var(--color-accent-a12)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 3px',
              color: showHidden ? 'var(--color-accent)' : 'var(--text-faint)',
              lineHeight: 1,
            }}
            aria-label={showHidden ? '隱藏隱藏檔案' : '顯示隱藏檔案'}
            aria-pressed={showHidden}
          >
            {showHidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
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
              onClick={() => {
                if (node.kind === 'dir') {
                  onDirectoryToggle(node.path);
                } else if (node.kind === 'file' && previewable) {
                  onFileClick(node.path);
                }
              }}
              onDoubleClick={() => {}}
            />
          );
        })}
      </div>

      {/* Footer — the settings entry point */}
      {onOpenSettings !== undefined && (
        <div
          style={{
            height: 42,
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
          }}
        >
          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-faint)',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <SettingsIcon size={15} />
            Settings
          </button>
        </div>
      )}

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
          background: resizing ? 'var(--color-accent-a25)' : 'transparent',
          transition: 'background 0.15s',
          zIndex: 10,
        }}
        title="Drag to resize"
      />
    </div>
  );
}
