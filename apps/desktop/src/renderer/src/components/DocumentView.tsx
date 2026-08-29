import React from 'react';

interface DocumentViewProps {
  activeNoteId: string;
  fileContent?: string | null;
  activeFilePath?: string | null;
}

function isMarkdownPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx');
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
          background: '#f0f0f8', borderRadius: 3, padding: '1px 5px',
          fontFamily: 'var(--font-mono)', fontSize: '0.88em', color: '#52526b',
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
          style={{ color: '#5856D6', cursor: 'pointer' }}
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
  h1: { fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 16, marginTop: 40, lineHeight: 1.2, borderBottom: '1px solid rgba(0,0,0,.08)', paddingBottom: 8 },
  h2: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 12, marginTop: 32, lineHeight: 1.3, borderBottom: '1px solid rgba(0,0,0,.08)', paddingBottom: 6 },
  h3: { fontSize: 17, fontWeight: 600, marginBottom: 10, marginTop: 24, lineHeight: 1.4 },
  h4: { fontSize: 15, fontWeight: 600, marginBottom: 8,  marginTop: 20 },
  h5: { fontSize: 14, fontWeight: 600, marginBottom: 6,  marginTop: 16 },
  h6: { fontSize: 13, fontWeight: 600, marginBottom: 4,  marginTop: 12, color: '#52526b' },
};

const ALIGN_MAP: Record<string, React.CSSProperties['textAlign']> = {
  left: 'left', right: 'right', center: 'center', none: 'left',
};

function renderToken(tok: Token, idx: number): React.ReactNode {
  const base: React.CSSProperties = { fontFamily: 'var(--font-sans)', color: '#1a1a2e' };

  if (tok.type === 'blank') return null;

  if (tok.type === 'hr') {
    return <hr key={idx} style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,.1)', margin: '24px 0' }} />;
  }

  if (tok.type === 'code_block') {
    return (
      <pre key={idx} style={{ background: '#f0f0f8', borderRadius: 8, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#1a1a2e', overflowX: 'auto', lineHeight: 1.6, margin: '16px 0' }}>
        <code>{tok.content}</code>
      </pre>
    );
  }

  if (tok.type === 'blockquote') {
    return (
      <blockquote key={idx} style={{ borderLeft: '3px solid #5856D6', margin: '16px 0', paddingLeft: 16, color: '#52526b', fontStyle: 'italic' }}>
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
                    color: '#52526b',
                    background: '#f8f8fc',
                    borderBottom: '2px solid rgba(0,0,0,.1)',
                    borderTop: '1px solid rgba(0,0,0,.08)',
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
              <tr key={ri} style={{ background: ri % 2 === 1 ? '#fafafa' : '#fff' }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '8px 14px',
                      textAlign: ALIGN_MAP[tok.alignments[ci] ?? 'none'],
                      color: '#1a1a2e',
                      borderBottom: '1px solid rgba(0,0,0,.06)',
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

function MarkdownView({ content }: { content: string }): React.ReactElement {
  const tokens = tokenize(content);
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#1a1a2e' }}>
      {tokens.map((tok, i) => renderToken(tok, i))}
    </div>
  );
}

// ── DocumentView ───────────────────────────────────────────────────────────

export function DocumentView({ activeNoteId, fileContent, activeFilePath }: DocumentViewProps): React.ReactElement {
  if (fileContent != null && activeFilePath != null) {
    const isMd = isMarkdownPath(activeFilePath);
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 740, padding: '48px 40px' }}>
          {isMd
            ? <MarkdownView content={fileContent} />
            : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, color: '#1a1a2e', margin: 0 }}>{fileContent}</pre>
          }
        </div>
      </div>
    );
  }

  // Demo mode
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 720, padding: '48px 40px' }}>
        {activeNoteId === 'deploy-rollback' ? <DeployRollbackDoc /> : <PaymentsRunbookDoc />}
      </div>
    </div>
  );
}

// ── Demo docs ──────────────────────────────────────────────────────────────

function DeployRollbackDoc(): React.ReactElement {
  return (
    <>
      <h1 style={{ fontSize: 31, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.025em', marginBottom: 18, fontFamily: 'var(--font-sans)', lineHeight: 1.2 }}>
        Deploy rollback
      </h1>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: '#1a1a2e', letterSpacing: '-0.015em', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
        Prerequisites
      </h2>
      <pre style={{ background: '#f0f0f8', borderRadius: 8, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#1a1a2e', overflowX: 'auto', lineHeight: 1.6 }}>
        {`# Identify the last stable release tag\ngit log --oneline --tags --simplify-by-decoration`}
      </pre>
    </>
  );
}

function PaymentsRunbookDoc(): React.ReactElement {
  return (
    <>
      <h1 style={{ fontSize: 31, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.025em', marginBottom: 18, fontFamily: 'var(--font-sans)', lineHeight: 1.2 }}>
        Payments service runbook
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: '#1a1a2e', maxWidth: '68ch', marginBottom: 32, fontFamily: 'var(--font-sans)' }}>
        This runbook covers the most common operational scenarios for the Payments service.
      </p>
    </>
  );
}
