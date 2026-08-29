export interface FileNameMatch {
  /** Absolute path on disk. */
  filePath: string;
  /** Base name only (e.g. "index.ts"). */
  fileName: string;
}

export interface ContentMatchLine {
  /** 1-indexed line number. */
  lineNumber: number;
  /** Raw text content of the line. */
  text: string;
  /** true = matched line; false = context line (±2 surrounding lines). */
  isMatch: boolean;
}

export interface ContentMatch {
  /** Absolute path on disk. */
  filePath: string;
  lines: ContentMatchLine[];
}

export interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
}
