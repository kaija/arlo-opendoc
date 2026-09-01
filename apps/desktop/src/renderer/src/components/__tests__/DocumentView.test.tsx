/**
 * Feature: html-preview
 *
 * In Preview mode an .html / .htm file is rendered as the page it describes,
 * inside a fully sandboxed iframe — not shown as escaped source. Edit mode is
 * unchanged (MarkdownEditor is a plain textarea), so it is not exercised here.
 *
 * The other Preview paths must not regress: Markdown still renders formatted,
 * and a non-HTML source file still renders as source text.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentView } from '../DocumentView.js';

function render(fileContent: string, activeFilePath: string): string {
  return renderToStaticMarkup(
    <DocumentView fileContent={fileContent} activeFilePath={activeFilePath} />,
  );
}

/** HTML-entity-escape the way React escapes an attribute value. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The srcdoc attribute value, or null if absent. `renderToStaticMarkup` emits
 * the JSX prop name `srcDoc` verbatim; the browser treats that attribute name
 * as case-insensitive, so it is the real `srcdoc`. Match either casing.
 */
function srcdocOf(html: string): string | null {
  return html.match(/srcdoc="([^"]*)"/i)?.[1] ?? null;
}

describe('DocumentView — HTML preview', () => {
  const HTML = '<!doctype html><h1>Hello</h1><p>world</p>';

  it.each(['page.html', 'page.htm', 'deep/PATH/Report.HTML'])(
    'renders %s inside a sandboxed iframe carrying the file as srcdoc',
    (path) => {
      const html = render(HTML, path);
      expect(html).toContain('<iframe');
      // The file content rides in srcdoc, escaped — never as visible source.
      expect(srcdocOf(html)).toBe(escapeAttr(HTML));
    },
  );

  it('sandboxes the frame with no script or same-origin escape hatch', () => {
    const html = render(HTML, 'page.html');
    const iframe = html.match(/<iframe[^>]*>/)?.[0] ?? '';
    expect(iframe).toContain('sandbox=""');
    expect(iframe).not.toContain('allow-scripts');
    expect(iframe).not.toContain('allow-same-origin');
  });

  it('does not fall through to the source-code view for HTML', () => {
    const src = '<script>alert(1)</script>';
    const html = render(src, 'evil.html');
    // CodeView would emit the markup escaped inside a <pre><code> block; the
    // iframe path keeps it only in the srcdoc attribute.
    expect(html).not.toMatch(/<pre[^>]*><code>/);
    expect(srcdocOf(html)).toBe(escapeAttr(src));
  });
});

describe('DocumentView — other preview paths still hold', () => {
  it('renders Markdown as formatted HTML, not an iframe', () => {
    const html = render('# Title\n\nA paragraph.', 'notes.md');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<h1');
    expect(html).toContain('Title');
  });

  it('renders a non-HTML source file as source text, not an iframe', () => {
    const html = render('const x = 1;\n', 'main.js');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<code>');
    expect(html).toContain('const x = 1;');
  });
});
