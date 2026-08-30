import type React from 'react';
import type { SettingsApi } from './useSettings';

/**
 * Panes are DATA, not just JSX.
 *
 * Each setting is an entry that knows its own label, its search keywords and
 * how to render itself. The header search then filters these entries directly
 * and renders the matches — so search results are the real, live controls, and
 * there is no parallel index to drift out of step with the panes.
 */

export interface SettingEntry {
  /** Stable id, used for React keys and scroll targets. */
  id: string;
  /** Human label — also the primary search term. */
  label: string;
  /** Extra words that should find this setting. */
  keywords?: string[];
  render: (s: SettingsApi) => React.ReactNode;
}

export interface PaneSection {
  title: string;
  entries: SettingEntry[];
}

export type PaneScope = 'app' | 'kb' | 'about';

export interface PaneDef {
  id: string;
  label: string;
  scope: PaneScope;
  /** One-line description shown under the pane heading. */
  blurb?: string;
  sections: PaneSection[];
  /** Non-searchable chrome rendered above the sections (tables, banners). */
  custom?: (s: SettingsApi) => React.ReactNode;
}

/** Flattens every pane into searchable rows. */
export interface SearchHit {
  pane: PaneDef;
  section: PaneSection;
  entry: SettingEntry;
}

export function searchPanes(panes: PaneDef[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const hits: SearchHit[] = [];
  for (const pane of panes) {
    for (const section of pane.sections) {
      for (const entry of section.entries) {
        const haystack = [entry.label, section.title, pane.label, ...(entry.keywords ?? [])]
          .join(' ')
          .toLowerCase();
        if (haystack.includes(q)) hits.push({ pane, section, entry });
      }
    }
  }
  return hits;
}
