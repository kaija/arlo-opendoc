import React from 'react';

interface FileTypeIconProps {
  fileName: string;
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  // No dot, or dot is at index 0 (e.g. ".gitignore") → no extension
  if (lastDot <= 0) return '';
  return fileName.slice(lastDot).toLowerCase();
}

type IconName =
  | 'markdown'
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'yaml'
  | 'image'
  | 'shell'
  | 'text'
  | 'generic';

function getIconName(fileName: string): IconName {
  const ext = getExtension(fileName);
  switch (ext) {
    case '.md':
    case '.mdx':
      return 'markdown';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
      return 'javascript';
    case '.json':
      return 'json';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return 'image';
    case '.sh':
    case '.bash':
      return 'shell';
    case '.txt':
      return 'text';
    default:
      return 'generic';
  }
}

const SVG_COMMON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '14',
  height: '14',
  viewBox: '0 0 14 14',
} as const;

function MarkdownIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="markdown" style={{ color: 'var(--text-muted)' }}>
      <rect x="1" y="1" width="9" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M3 5h6M3 7.5l1.5 2L6 7.5l1.5 2L9 7.5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The TypeScript and JavaScript marks below use their official brand colours,
// and the strokes drawn on top of them are fixed contrast pairs against those
// fills. Neither moves with the theme, so both stay literal by design.
function TypeScriptIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="typescript">
      <rect x="1" y="1" width="12" height="12" rx="2.5" fill="#3178C6" />
      <path d="M3.5 7h4M5.5 5v6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M8.5 8.5c0-.8.5-1.5 1.5-1.5s1.5.7 1.5 1.5-.5 1.5-1.5 1.5"
        stroke="#fff"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function JavaScriptIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="javascript">
      <rect x="1" y="1" width="12" height="12" rx="2.5" fill="#F7DF1E" />
      <path d="M5 9.5c0 1-1 1.5-2 1" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 5v5c0 1.5 3 1.5 3 0" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function JsonIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="json" style={{ color: 'var(--text-muted)' }}>
      <path
        d="M4.5 2c-1 0-1.5.5-1.5 1.5v1c0 .8-.5 1.5-1 1.5.5 0 1 .7 1 1.5v1c0 1 .5 1.5 1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M9.5 2c1 0 1.5.5 1.5 1.5v1c0 .8.5 1.5 1 1.5-.5 0-1 .7-1 1.5v1c0 1-.5 1.5-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function YamlIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="yaml" style={{ color: 'var(--text-muted)' }}>
      <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="image" style={{ color: 'var(--text-muted)' }}>
      <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="4.5" cy="5.5" r="1" fill="currentColor" />
      <path
        d="M1.5 10.5l3-3.5 2.5 3 2-2 3 3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShellIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="shell" style={{ color: 'var(--text-muted)' }}>
      <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M3.5 9l2.5-2L3.5 5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="text" style={{ color: 'var(--text-muted)' }}>
      <rect x="1.5" y="1" width="9" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M3.5 4.5h5M3.5 7h5M3.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function GenericIcon(): React.ReactElement {
  return (
    <svg {...SVG_COMMON_PROPS} data-icon="generic" style={{ color: 'var(--text-dim)' }}>
      <path
        d="M3 1h6l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

const ICON_COMPONENTS: Record<IconName, () => React.ReactElement> = {
  markdown: MarkdownIcon,
  typescript: TypeScriptIcon,
  javascript: JavaScriptIcon,
  json: JsonIcon,
  yaml: YamlIcon,
  image: ImageIcon,
  shell: ShellIcon,
  text: TextIcon,
  generic: GenericIcon,
};

export function FileTypeIcon({ fileName }: FileTypeIconProps): React.ReactElement {
  const iconName = getIconName(fileName);
  const IconComponent = ICON_COMPONENTS[iconName];
  return <IconComponent />;
}
