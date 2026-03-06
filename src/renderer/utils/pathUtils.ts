/**
 * Renderer-process path utilities.
 *
 * Re-exports every helper from the shared `pathCore` module and adds
 * renderer-specific helpers that operate on pure strings (no Node.js / Electron
 * APIs are available in the renderer with `nodeIntegration: false`).
 */

// Re-export all shared helpers.
export * from '@shared/pathCore';

import {
  safeDecodeURIComponent,
  stripFileProtocol,
  stripHashAndQuery,
  isAbsolutePath,
  isRelativePath,
  hasScheme,
} from '@shared/pathCore';

// ---------------------------------------------------------------------------
// Root-relative path parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `file://root::relative` formatted path and return the resolved
 * absolute path, or `null` if the format does not match.
 */
export function parseRootRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (!/^file:\/\//i.test(trimmed)) return null;
  const separatorIndex = trimmed.indexOf('::');
  if (separatorIndex < 0) return null;

  const rootPart = trimmed.slice(0, separatorIndex);
  const relativePart = trimmed.slice(separatorIndex + 2);
  if (!relativePart.trim()) return null;

  const rootPath = safeDecodeURIComponent(
    stripFileProtocol(stripHashAndQuery(rootPart)),
  );
  const relativePath = safeDecodeURIComponent(
    stripHashAndQuery(relativePart),
  );
  if (!rootPath || !relativePath) return null;

  const normalizedRoot = rootPath.replace(/[\\/]+$/, '');
  const normalizedRelative = relativePath.replace(/^[\\/]+/, '');
  if (!normalizedRelative) return null;

  return `${normalizedRoot}/${normalizedRelative}`;
}

// ---------------------------------------------------------------------------
// Local-path normalisation
// ---------------------------------------------------------------------------

/**
 * Attempt to normalise a path-like string into a usable local path.
 *
 * Returns `null` when the string is empty or has a non-file scheme.
 */
export function normalizeLocalPath(
  value: string,
): { path: string; isRelative: boolean; isAbsolute: boolean } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fileScheme = /^file:\/\//i.test(trimmed);
  const schemePresent = hasScheme(trimmed);
  if (schemePresent && !fileScheme && !isAbsolutePath(trimmed)) return null;

  let raw = trimmed;
  if (fileScheme) {
    raw = stripFileProtocol(raw);
  }
  raw = stripHashAndQuery(raw);
  const decoded = safeDecodeURIComponent(raw);
  const resultPath = decoded || raw;
  if (!resultPath) return null;

  return {
    path: resultPath,
    isRelative: isRelativePath(resultPath),
    isAbsolute: isAbsolutePath(resultPath),
  };
}

// ---------------------------------------------------------------------------
// Absolute-path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a (potentially relative) file path against the given `cwd`.
 */
export function toAbsolutePathFromCwd(filePath: string, cwd: string): string {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }
  return `${cwd.replace(/\/$/, '')}/${filePath.replace(/^\.\//, '')}`;
}
