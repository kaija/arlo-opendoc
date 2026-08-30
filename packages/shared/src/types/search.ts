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
  /**
   * Directory and file names to skip. Absent means "use the built-in
   * defaults" — the field is optional so existing callers keep working and so
   * a caller that has no knowledge-base settings to hand still gets sensible
   * exclusions rather than searching node_modules.
   */
  excludes?: string[] | undefined;
  /** Honour the repository's .gitignore. Absent means yes. */
  respectGitignore?: boolean | undefined;
  /** Include dot-prefixed files. Absent means no. */
  includeHidden?: boolean | undefined;
  /** Cap on the number of files returned. Absent means the built-in limit. */
  maxResults?: number | undefined;
}
