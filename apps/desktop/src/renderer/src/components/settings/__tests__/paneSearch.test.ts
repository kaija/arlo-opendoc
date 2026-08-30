import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { searchPanes } from '../paneTypes';
import type { PaneDef } from '../paneTypes';
import { APPLICATION_PANES } from '../panes/application';
import { KB_PANES } from '../panes/knowledgeBase';
import { aboutPane } from '../panes/about';

const ALL: PaneDef[] = [...APPLICATION_PANES, ...KB_PANES, aboutPane];

/**
 * The header search is the only way to find a setting without knowing which of
 * eleven panes it lives in, so its index is worth pinning down. Because entries
 * ARE the panes rather than a parallel list, these tests double as a check that
 * every pane is reachable and that no two entries collide on an id.
 */

describe('settings search', () => {
  it('an empty query matches nothing rather than everything', () => {
    expect(searchPanes(ALL, '')).toEqual([]);
    expect(searchPanes(ALL, '   ')).toEqual([]);
  });

  it('finds a setting by its label', () => {
    const hits = searchPanes(ALL, 'default branch');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.pane.id).toBe('repository');
    expect(hits[0]!.entry.id).toBe('default-branch');
  });

  it('finds a setting by a keyword that is not in its label', () => {
    // "dark" appears nowhere in the label "Theme".
    const hits = searchPanes(ALL, 'dark');
    expect(hits.map((h) => h.entry.id)).toContain('theme');
  });

  it('finds the API key from the word "key" alone', () => {
    const hits = searchPanes(ALL, 'key');
    expect(hits.map((h) => h.entry.id)).toContain('anthropic-key');
  });

  it('spans panes — "branch" reaches both Repository and Publishing', () => {
    const hits = searchPanes(ALL, 'branch');
    const panes = new Set(hits.map((h) => h.pane.id));
    expect(panes.has('repository')).toBe(true);
    expect(panes.has('publishing')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(searchPanes(ALL, 'AUTOSAVE').length).toBe(searchPanes(ALL, 'autosave').length);
    expect(searchPanes(ALL, 'AUTOSAVE').length).toBeGreaterThan(0);
  });

  it('does not throw for a pane that has no entries', () => {
    // Keyboard is custom-rendered with no searchable entries.
    expect(() => searchPanes(ALL, 'keyboard')).not.toThrow();
  });

  it('returns nothing for a query that matches no setting', () => {
    expect(searchPanes(ALL, 'zzzzzznotasetting')).toEqual([]);
  });

  it('never returns a hit whose text does not contain the query', () => {
    const terms = ['theme', 'branch', 'key', 'search', 'agent', 'font', 'update'];
    for (const term of terms) {
      for (const hit of searchPanes(ALL, term)) {
        const haystack = [
          hit.entry.label,
          hit.section.title,
          hit.pane.label,
          ...(hit.entry.keywords ?? []),
        ]
          .join(' ')
          .toLowerCase();
        expect(haystack).toContain(term);
      }
    }
  });

  it('never throws, for any query', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (q) => {
        searchPanes(ALL, q);
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

describe('pane definitions', () => {
  it('every entry id is unique within its pane', () => {
    for (const pane of ALL) {
      const ids = pane.sections.flatMap((s) => s.entries.map((e) => e.id));
      expect(new Set(ids).size, `duplicate entry id in pane "${pane.id}"`).toBe(ids.length);
    }
  });

  it('every pane id is unique', () => {
    const ids = ALL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pane has either sections or custom chrome', () => {
    for (const pane of ALL) {
      expect(
        pane.sections.length > 0 || pane.custom !== undefined,
        `pane "${pane.id}" would render empty`,
      ).toBe(true);
    }
  });

  it('covers the eleven panes the design calls for, in three scopes', () => {
    expect(ALL).toHaveLength(11);
    expect(ALL.filter((p) => p.scope === 'app')).toHaveLength(6);
    expect(ALL.filter((p) => p.scope === 'kb')).toHaveLength(4);
    expect(ALL.filter((p) => p.scope === 'about')).toHaveLength(1);
  });

  it('every entry carries a non-empty label for the result list', () => {
    for (const pane of ALL) {
      for (const section of pane.sections) {
        for (const entry of section.entries) {
          expect(entry.label.trim().length, `${pane.id}/${entry.id}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
