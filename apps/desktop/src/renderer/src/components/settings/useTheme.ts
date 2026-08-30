import React from 'react';
import type { Theme } from '@arlo-doc/shared';

/**
 * Reflects the chosen theme onto the document root.
 *
 * The contract lives in globals.css: an explicit choice sets data-theme, while
 * 'system' REMOVES the attribute so the prefers-color-scheme media query
 * decides. That is why 'system' is an absence here rather than a value — it
 * keeps one source of truth in CSS and lets the app paint correctly before
 * React has mounted.
 */
export function useTheme(theme: Theme | undefined): void {
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === undefined || theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);
}
