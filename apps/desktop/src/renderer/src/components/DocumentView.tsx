import React, { useEffect, useRef } from 'react';

interface DocumentViewProps {
  fileContent: string;
  activeFilePath: string;
  /** 1-indexed line to scroll to and highlight after render. null/undefined = no scroll. */
  scrollToLine?: number | null | undefined;
  /** Called after the scroll+highlight fires so App can reset scrollToLine to null. */
  onScrollComplete?: (() => void) | undefined;
  /** Settings > Editor > Front matter. Defaults to hiding it. */
  frontMatterMode?: 'hide' | 'table' | undefined;
  /** Settings > Editor > Typography. Fills the pane; defaults to on. */
  fullWidth?: boolean | undefined;
  /** Settings > Editor > Typography. Measure of the column, in ch. Off while fullWidth. */
  lineWidth?: number | undefined;
}

function isMarkdownPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx');
}

function isHtmlPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm');
}

/**
 * Maps a file path to a human-readable language label shown above code files.
 * Returns null for plain text files that need no label.
 */
function getLanguageLabel(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const basename = lower.split('/').pop() ?? lower;
  const dotIdx = basename.lastIndexOf('.');
  const ext = dotIdx === -1 ? '' : basename.slice(dotIdx);
  const name = dotIdx === -1 ? basename : basename.slice(0, dotIdx);

  // Well-known extensionless files
  const NO_EXT: Record<string, string> = {
    makefile: 'Makefile', dockerfile: 'Dockerfile',
    jenkinsfile: 'Jenkinsfile', gemfile: 'Gemfile',
    rakefile: 'Rakefile', procfile: 'Procfile',
  };
  if (!ext && NO_EXT[name]) return NO_EXT[name]!;

  const EXT_MAP: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript (JSX)',
    '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)',
    '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.py': 'Python', '.rb': 'Ruby', '.php': 'PHP',
    '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin Script',
    '.go': 'Go', '.rs': 'Rust',
    '.c': 'C', '.h': 'C Header', '.cpp': 'C++', '.cc': 'C++',
    '.cxx': 'C++', '.hpp': 'C++ Header',
    '.cs': 'C#', '.swift': 'Swift',
    '.m': 'Objective-C', '.mm': 'Objective-C++',
    '.sh': 'Shell', '.bash': 'Bash', '.zsh': 'Zsh',
    '.fish': 'Fish', '.ps1': 'PowerShell',
    '.bat': 'Batch', '.cmd': 'Batch',
    '.html': 'HTML', '.htm': 'HTML',
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
    '.json': 'JSON', '.jsonc': 'JSON', '.json5': 'JSON5',
    '.yaml': 'YAML', '.yml': 'YAML',
    '.toml': 'TOML', '.ini': 'INI', '.env': 'Env',
    '.xml': 'XML', '.svg': 'SVG',
    '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
    '.proto': 'Protocol Buffers',
    '.tf': 'Terraform', '.tfvars': 'Terraform',
    '.hcl': 'HCL', '.dockerfile': 'Dockerfile',
    '.gradle': 'Gradle', '.cmake': 'CMake',
    '.diff': 'Diff', '.patch': 'Diff',
    '.rst': 'reStructuredText', '.adoc': 'AsciiDoc', '.tex': 'LaTeX',
    '.csv': 'CSV', '.log': 'Log',
    '.lock': 'Lock File',
    '.gitignore': 'Git', '.gitattributes': 'Git',
    '.editorconfig': 'EditorConfig',
    '.eslintrc': 'ESLint Config', '.prettierrc': 'Prettier Config',
    '.babelrc': 'Babel Config',
  };
  return EXT_MAP[ext] ?? null;
}

// ── Minimal Markdown renderer ──────────────────────────────────────────────

interface TableToken {
  type: 'table';
  headers: string[];
  alignments: Array<'left' | 'right' | 'center' | 'none'>;
  rows: string[][];
}

type Token =
  | { type: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6'; content: string }
  | { type: 'p'; content: string }
  | { type: 'ul'|'ol'; content: string; items: string[] }
  | { type: 'blockquote'; content: string }
  | { type: 'hr'|'blank'; content: string }
  | { type: 'code_block'; content: string; lang: string }
  | TableToken;

function parseTableRow(line: string): string[] {
  const trimmed = line.replace(/^\||\|$/g, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|?[\s|:\-]+\|?$/.test(line) && /[-]/.test(line);
}

function parseAlignment(cell: string): 'left' | 'right' | 'center' | 'none' {
  const t = cell.trim();
  if (t.startsWith(':') && t.endsWith(':')) return 'center';
  if (t.endsWith(':')) return 'right';
  if (t.startsWith(':')) return 'left';
  return 'none';
}

/**
 * Separates YAML front matter from the body of a markdown string.
 *
 * A front matter block starts with "---" on the very first line and ends with
 * the next "---" (or "...") line. This SPLITS rather than strips, because
 * Settings > Editor lets the reader choose between hiding the block and seeing
 * it as a table — the parser cannot know which, so it returns both halves.
 */
function splitFrontMatter(md: string): { frontMatter: string | null; body: string } {
  const lines = md.split('\n');
  if (lines[0]?.trim() !== '---') return { frontMatter: null, body: md };
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '---' || t === '...') {
      // Skip the closing delimiter line; drop any leading blank line after it
      const rest = lines.slice(i + 1);
      const firstNonBlank = rest.findIndex((l) => l.trim() !== '');
      return {
        frontMatter: lines.slice(1, i).join('\n'),
        body: rest.slice(firstNonBlank === -1 ? rest.length : firstNonBlank).join('\n'),
      };
    }
  }
  // No closing delimiter found — treat the whole file as content
  return { frontMatter: null, body: md };
}

/**
 * Parses the flat `key: value` pairs of a front-matter block for display.
 * Nested YAML is shown verbatim rather than being half-parsed into something
 * misleading.
 */
function parseFrontMatterRows(block: string): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  for (const line of block.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (match === null) continue;
    rows.push({ key: match[1]!, value: match[2]!.trim() });
  }
  return rows;
}

function FrontMatterTable({ block }: { block: string }): React.ReactElement | null {
  const rows = parseFrontMatterRows(block);
  if (rows.length === 0) return null;
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        marginBottom: 28,
        fontSize: 12.5,
        fontFamily: 'var(--font-mono)',
        background: 'var(--surface-section)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td
              style={{
                padding: '6px 14px',
                color: 'var(--text-faint)',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                verticalAlign: 'top',
              }}
            >
              {r.key}
            </td>
            <td
              style={{
                padding: '6px 14px',
                color: 'var(--text-body)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {r.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tokenize(md: string): Token[] {
  const lines = md.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      tokens.push({ type: 'code_block', content: codeLines.join('\n'), lang });
      i++;
      continue;
    }

    // Table — header row followed immediately by a separator row
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1]!)
    ) {
      const headers = parseTableRow(line);
      const sepCells = parseTableRow(lines[i + 1]!);
      const alignments = sepCells.map(parseAlignment);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.includes('|')) {
        rows.push(parseTableRow(lines[i]!));
        i++;
      }
      tokens.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1]!.length as 1|2|3|4|5|6;
      tokens.push({ type: `h${level}` as 'h1', content: hMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      tokens.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*+]\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ul', content: '', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ol', content: '', items });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('> ')) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      tokens.push({ type: 'blank', content: '' });
      i++;
      continue;
    }

    // Paragraph — stop before block-level elements or table starts
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !/^(#{1,6}\s|[-*+]\s|\d+\.\s|> |```|-{3,}|\*{3,}|_{3,})/.test(lines[i]!) &&
      !(lines[i]!.includes('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!))
    ) {
      pLines.push(lines[i]!);
      i++;
    }
    if (pLines.length > 0) {
      tokens.push({ type: 'p', content: pLines.join(' ') });
    }
  }
  return tokens;
}

// ── Inline renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          background: 'var(--surface-sunken)', borderRadius: 3, padding: '1px 5px',
          fontFamily: 'var(--font-mono)', fontSize: '0.88em', color: 'var(--text-muted-strong)',
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const url = linkMatch[2]!;
      return (
        <a
          key={i}
          href={url}
          style={{ color: 'var(--color-accent)', cursor: 'pointer' }}
          onClick={(e) => {
            e.preventDefault();
            void window.arlodoc.openExternal(url);
          }}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// ── Token renderer ─────────────────────────────────────────────────────────

const HEADING_STYLES: Record<string, React.CSSProperties> = {
  h1: { fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 16, marginTop: 40, lineHeight: 1.2, borderBottom: '1px solid var(--border-mid)', paddingBottom: 8 },
  h2: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 12, marginTop: 32, lineHeight: 1.3, borderBottom: '1px solid var(--border-mid)', paddingBottom: 6 },
  h3: { fontSize: 17, fontWeight: 600, marginBottom: 10, marginTop: 24, lineHeight: 1.4 },
  h4: { fontSize: 15, fontWeight: 600, marginBottom: 8,  marginTop: 20 },
  h5: { fontSize: 14, fontWeight: 600, marginBottom: 6,  marginTop: 16 },
  h6: { fontSize: 13, fontWeight: 600, marginBottom: 4,  marginTop: 12, color: 'var(--text-muted-strong)' },
};

const ALIGN_MAP: Record<string, React.CSSProperties['textAlign']> = {
  left: 'left', right: 'right', center: 'center', none: 'left',
};

function renderToken(tok: Token, idx: number): React.ReactNode {
  const base: React.CSSProperties = { fontFamily: 'var(--font-sans)', color: 'var(--text-body)' };

  if (tok.type === 'blank') return null;

  if (tok.type === 'hr') {
    return <hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border-strong)', margin: '24px 0' }} />;
  }

  if (tok.type === 'code_block') {
    return (
      <pre key={idx} style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-body)', overflowX: 'auto', lineHeight: 1.6, margin: '16px 0' }}>
        <code>{tok.content}</code>
      </pre>
    );
  }

  if (tok.type === 'blockquote') {
    return (
      <blockquote key={idx} style={{ borderLeft: '3px solid var(--color-accent)', margin: '16px 0', paddingLeft: 16, color: 'var(--text-muted-strong)', fontStyle: 'italic' }}>
        {tok.content.split('\n').map((l, i) => (
          <p key={i} style={{ margin: 0, lineHeight: 1.7 }}>{renderInline(l)}</p>
        ))}
      </blockquote>
    );
  }

  if (tok.type === 'ul') {
    return (
      <ul key={idx} style={{ ...base, margin: '8px 0', paddingLeft: 24, lineHeight: 1.7 }}>
        {tok.items.map((item, i) => <li key={i} style={{ marginBottom: 2 }}>{renderInline(item)}</li>)}
      </ul>
    );
  }

  if (tok.type === 'ol') {
    return (
      <ol key={idx} style={{ ...base, margin: '8px 0', paddingLeft: 24, lineHeight: 1.7 }}>
        {tok.items.map((item, i) => <li key={i} style={{ marginBottom: 2 }}>{renderInline(item)}</li>)}
      </ol>
    );
  }

  if (tok.type === 'table') {
    return (
      <div key={idx} style={{ margin: '16px 0', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--font-sans)', fontSize: 14 }}>
          <thead>
            <tr>
              {tok.headers.map((h, ci) => (
                <th
                  key={ci}
                  style={{
                    padding: '8px 14px',
                    textAlign: ALIGN_MAP[tok.alignments[ci] ?? 'none'],
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--text-muted-strong)',
                    background: 'var(--surface-section)',
                    borderBottom: '2px solid var(--border-strong)',
                    borderTop: '1px solid var(--border-mid)',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tok.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--surface-alt)' : 'var(--surface-card)' }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '8px 14px',
                      textAlign: ALIGN_MAP[tok.alignments[ci] ?? 'none'],
                      color: 'var(--text-body)',
                      borderBottom: '1px solid var(--border)',
                      verticalAlign: 'top',
                      lineHeight: 1.6,
                    }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tok.type in HEADING_STYLES) {
    const Tag = tok.type as keyof JSX.IntrinsicElements;
    return (
      <Tag key={idx} style={{ ...base, ...HEADING_STYLES[tok.type] }}>
        {renderInline(tok.content)}
      </Tag>
    );
  }

  // paragraph
  return (
    <p key={idx} style={{ ...base, fontSize: 15, lineHeight: 1.75, margin: '8px 0' }}>
      {renderInline(tok.content)}
    </p>
  );
}

function MarkdownView({
  content,
  frontMatterMode = 'hide',
}: {
  content: string;
  frontMatterMode?: 'hide' | 'table' | undefined;
}): React.ReactElement {
  const { frontMatter, body } = splitFrontMatter(content);
  const tokens = tokenize(body);
  return (
    <div
      style={{
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-body)',
      }}
    >
      {frontMatterMode === 'table' && frontMatter !== null && (
        <FrontMatterTable block={frontMatter} />
      )}
      {tokens.map((tok, i) => renderToken(tok, i))}
    </div>
  );
}

// ── HtmlView ───────────────────────────────────────────────────────────────

/**
 * Renders an .html / .htm file as the page it describes, rather than its source.
 *
 * The file is dropped into a fully sandboxed iframe: no `allow-scripts`, so
 * nothing in the file runs, and no `allow-same-origin`, so it gets an opaque
 * origin and cannot reach the app, its storage, or the preload bridge. The
 * renderer's Content-Security-Policy is inherited through `srcdoc`, so remote
 * images, fonts, and stylesheets do not load either — a preview never phones
 * home. Inline and embedded CSS render, which covers the common case.
 *
 * Edit mode is untouched: MarkdownEditor shows the raw text for any file.
 */
function HtmlView({ content }: { content: string }): React.ReactElement {
  return (
    <iframe
      title="HTML preview"
      srcDoc={content}
      sandbox=""
      referrerPolicy="no-referrer"
      style={{
        flex: 1,
        width: '100%',
        border: 'none',
        background: '#fff',
        colorScheme: 'light',
      }}
    />
  );
}

// ── CodeView ───────────────────────────────────────────────────────────────

function CodeView({ content, filePath }: { content: string; filePath: string }): React.ReactElement {
  const label = getLanguageLabel(filePath);
  const lines = content.split('\n');
  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border-mid)', overflow: 'hidden', margin: 0 }}>
      {label && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 16px',
          background: 'var(--surface-sunken)',
          borderBottom: '1px solid var(--border-mid)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted-strong)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}>
          {label}
        </div>
      )}
      <pre style={{
        whiteSpace: 'pre',
        overflowX: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: 1.65,
        color: 'var(--text-body)',
        background: 'var(--surface-section)',
        margin: 0,
        padding: '20px 24px',
      }}>
        <code>
          {lines.map((line, i) => (
            <span key={i} data-line={i + 1} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

// ── DocumentView ───────────────────────────────────────────────────────────

export function DocumentView({
  fileContent,
  activeFilePath,
  scrollToLine,
  onScrollComplete,
  frontMatterMode,
  fullWidth = true,
  lineWidth,
}: DocumentViewProps): React.ReactElement {
  const isMd = isMarkdownPath(activeFilePath);
  const isHtml = isHtmlPath(activeFilePath);
  const isTxt = activeFilePath.toLowerCase().endsWith('.txt');

  // Ref to the outer scrollable container so we can find data-line elements within it
  const containerRef = useRef<HTMLDivElement>(null);
  // Track the last line we scrolled to, to avoid re-firing for the same value
  const lastScrolledLineRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollToLine == null) {
      lastScrolledLineRef.current = null;
      return;
    }
    if (scrollToLine === lastScrolledLineRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-line="${scrollToLine}"]`);
    if (!target) {
      // Markdown/plain-text path — no data-line elements; just notify completion
      onScrollComplete?.();
      return;
    }

    lastScrolledLineRef.current = scrollToLine;

    target.scrollIntoView({ block: 'center' });

    // Transient highlight: inject a one-shot animation
    const HIGHLIGHT_COLOR = 'var(--color-accent-a18)';
    const prevBg = target.style.backgroundColor;
    target.style.transition = 'background-color 0s';
    target.style.backgroundColor = HIGHLIGHT_COLOR;

    const fadeTimer = window.setTimeout(() => {
      target.style.transition = 'background-color 1.2s ease';
      target.style.backgroundColor = prevBg;
    }, 300);

    const cleanupTimer = window.setTimeout(() => {
      target.style.transition = '';
      target.style.backgroundColor = '';
      onScrollComplete?.();
    }, 1600);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [scrollToLine, onScrollComplete]);

  // An HTML file previews as the page it describes, in its own sandboxed frame
  // (see HtmlView) — full-bleed, with no reading column. containerRef still
  // mounts so the scroll-to-line effect can settle: a frame has no [data-line]
  // anchors, so it just reports completion.
  if (isHtml) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden',
          background: 'var(--surface-card)',
        }}
      >
        <HtmlView content={fileContent} />
      </div>
    );
  }

  // The reading column fills the pane by default, so it widens with the window
  // and narrows again the moment the chat panel takes its 380px. A reader who
  // prefers a fixed measure turns Full width off in Settings > Editor, and the
  // column is then held to `lineWidth` and centred instead.
  const measured = !fullWidth && lineWidth !== undefined;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--surface-card)' }}
    >
      <div
        style={{
          width: '100%',
          // Matches the editor's padding, so toggling Edit/Preview does not
          // shift the text sideways.
          padding: '36px 40px',
          // ch tracks the reader's font size, so the measure holds as they zoom.
          ...(measured ? { maxWidth: `${lineWidth}ch`, margin: '0 auto' } : {}),
        }}
      >
        {isMd
          ? <MarkdownView content={fileContent} frontMatterMode={frontMatterMode} />
          : isTxt
            ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-body)', margin: 0 }}>{fileContent}</pre>
            : <CodeView content={fileContent} filePath={activeFilePath} />
        }
      </div>
    </div>
  );
}
