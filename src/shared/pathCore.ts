/**
 * Shared path utilities — pure string operations only.
 *
 * This module is imported by **both** the main process (`src/main/`) and the
 * renderer process (`src/renderer/`).  It MUST NOT depend on Node.js built-ins
 * (`path`, `fs`, `os`, `child_process`) or on Electron APIs (`app`, `shell`).
 *
 * Platform-aware functions that need Node.js/Electron live in:
 *   - Main:     `src/main/libs/pathUtils.ts`
 *   - Renderer: `src/renderer/utils/pathUtils.ts`
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Characters that are illegal in file names on Windows (and most OSes). */
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

// -- Sandbox workspace constants --------------------------------------------

export const SANDBOX_WORKSPACE_GUEST_ROOT = '/workspace/project';
export const SANDBOX_WORKSPACE_LEGACY_ROOT = '/workspace';
export const SANDBOX_WORKSPACE_RESERVED_DIRS = new Set(['skills', 'ipc', 'tmp']);
export const SANDBOX_WORKSPACE_PATH_PATTERN =
  /\/workspace(?:\/project)?(?:\/[^\s'"`)\]}>,;:!?]*)?/g;

// ---------------------------------------------------------------------------
// URI / protocol helpers
// ---------------------------------------------------------------------------

/**
 * Safely decode a percent-encoded URI component, returning the original value
 * on failure (e.g. when the string contains a bare `%` that is not part of a
 * valid percent-encoded sequence).
 */
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Strip the `file://` (case-insensitive) protocol prefix from a path.
 *
 * On Windows, paths like `file:///C:/foo` become `/C:/foo` after removing the
 * scheme.  This function additionally strips the leading `/` before a drive
 * letter so the result is a native Windows path (`C:/foo`).
 */
export function stripFileProtocol(value: string): string {
  let cleaned = value.replace(/^file:\/\//i, '');
  // /C: → C:
  if (/^\/[A-Za-z]:/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Remove the URL hash (`#…`) and query string (`?…`) from a path-like string.
 */
export function stripHashAndQuery(value: string): string {
  return value.split('#')[0].split('?')[0];
}

// ---------------------------------------------------------------------------
// Path classification
// ---------------------------------------------------------------------------

/**
 * Test whether `value` starts with a URI scheme (e.g. `http:`, `ftp:`).
 */
export function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

/**
 * Test whether `value` looks like an absolute filesystem path.
 * Recognises both Unix (`/foo`) and Windows (`C:\foo`, `C:/foo`) conventions.
 */
export function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

/**
 * Test whether `value` looks like a relative filesystem path (i.e. it is
 * neither absolute nor has a URI scheme).
 */
export function isRelativePath(value: string): boolean {
  return !isAbsolutePath(value) && !hasScheme(value);
}

// ---------------------------------------------------------------------------
// File-name sanitisation
// ---------------------------------------------------------------------------

/**
 * Remove characters that are illegal in file names on Windows and replace runs
 * of whitespace with a single space.  CJK / Unicode characters are preserved.
 *
 * @param value    Raw file name (not a full path — use `path.basename` first).
 * @param fallback Returned when the sanitised result is empty.
 */
export function sanitizeFileName(value: string, fallback = 'file'): string {
  const sanitized = value
    .replace(INVALID_FILE_NAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || fallback;
}

// ---------------------------------------------------------------------------
// Unicode normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a string to NFC (Canonical Decomposition followed by Canonical
 * Composition).
 *
 * macOS HFS+/APFS stores file names in NFD form.  Comparing an NFC-encoded
 * user-provided path against an NFD-encoded directory listing will fail unless
 * both sides are normalised first.
 */
export function normalizeUnicode(value: string): string {
  return value.normalize('NFC');
}

// ---------------------------------------------------------------------------
// Windows drive-letter normalisation (pure string)
// ---------------------------------------------------------------------------

/**
 * Normalise a Windows-style path:
 *   - `file:///C:/foo` → URI-decoded, protocol stripped
 *   - `/C:/foo` → `C:/foo`
 *   - `/c/foo` (MSYS / Git-Bash style) → `C:\foo`
 *   - Forward slashes → backslashes
 *   - Drive letter uppercased
 *
 * On non-Windows-looking paths the input is returned unchanged.
 */
export function normalizeWindowsDriveLetter(value: string): string {
  let result = value.trim();
  if (!result) return value;

  // Handle file:// protocol
  if (/^file:\/\//i.test(result)) {
    result = safeDecodeURIComponent(result.replace(/^file:\/\//i, ''));
  }

  // /C: → C:
  if (/^\/[A-Za-z]:/.test(result)) {
    result = result.slice(1);
  }

  // MSYS-style /c/foo → C:\foo
  const unixDriveMatch = result.match(/^[/\\]([A-Za-z])[/\\](.+)$/);
  if (unixDriveMatch) {
    const drive = unixDriveMatch[1].toUpperCase();
    const rest = unixDriveMatch[2].replace(/[/\\]+/g, '\\');
    return `${drive}:\\${rest}`;
  }

  // Standard C:/foo or C:\foo — uppercase drive, backslash separators
  if (/^[A-Za-z]:[/\\]/.test(result)) {
    const drive = result[0].toUpperCase();
    const rest = result.slice(1).replace(/\//g, '\\');
    return `${drive}${rest}`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Home-directory expansion (pure — caller supplies homeDir)
// ---------------------------------------------------------------------------

/**
 * Expand a leading `~/` or `~\` to the supplied home directory.
 */
export function expandHomePure(inputPath: string, homeDir: string): string {
  if (!inputPath.startsWith('~/') && !inputPath.startsWith('~\\')) {
    return inputPath;
  }
  const normalizedHome = homeDir.replace(/[\\/]+$/, '');
  return `${normalizedHome}/${inputPath.slice(2)}`;
}

// ---------------------------------------------------------------------------
// Sandbox guest-path mapping
// ---------------------------------------------------------------------------

function isReservedSandboxSegment(relativePath: string): boolean {
  const [firstSegment] = relativePath.split('/');
  return Boolean(
    firstSegment && SANDBOX_WORKSPACE_RESERVED_DIRS.has(firstSegment.toLowerCase()),
  );
}

/**
 * Map a sandbox guest path (e.g. `/workspace/project/src/foo.ts`) back to the
 * corresponding host path by replacing the sandbox root prefix with `cwd`.
 *
 * Returns `null` when the path cannot be mapped (not a sandbox path, reserved
 * directory, or `cwd` is empty).
 */
export function mapSandboxGuestPathToCwd(
  filePath: string,
  cwd?: string,
): string | null {
  if (!cwd) return null;

  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedCwd = cwd.replace(/[\\/]+$/, '');

  // Try /workspace/project first
  if (
    normalizedPath === SANDBOX_WORKSPACE_GUEST_ROOT
    || normalizedPath.startsWith(`${SANDBOX_WORKSPACE_GUEST_ROOT}/`)
  ) {
    const relativePath = normalizedPath
      .slice(SANDBOX_WORKSPACE_GUEST_ROOT.length)
      .replace(/^\/+/, '');
    if (relativePath && isReservedSandboxSegment(relativePath)) {
      return null;
    }
    return relativePath ? `${normalizedCwd}/${relativePath}` : normalizedCwd;
  }

  // Fallback to legacy /workspace
  if (
    normalizedPath !== SANDBOX_WORKSPACE_LEGACY_ROOT
    && !normalizedPath.startsWith(`${SANDBOX_WORKSPACE_LEGACY_ROOT}/`)
  ) {
    return null;
  }

  const legacyRelativePath = normalizedPath
    .slice(SANDBOX_WORKSPACE_LEGACY_ROOT.length)
    .replace(/^\/+/, '');
  if (!legacyRelativePath) {
    return normalizedCwd;
  }

  if (isReservedSandboxSegment(legacyRelativePath)) {
    return null;
  }

  return `${normalizedCwd}/${legacyRelativePath}`;
}

/**
 * Replace all sandbox guest paths in a text string with host paths.
 */
export function mapSandboxGuestPathsInText(
  value: string,
  cwd?: string,
): string {
  if (!value || !cwd || !value.includes('/workspace')) {
    return value;
  }

  return value.replace(SANDBOX_WORKSPACE_PATH_PATTERN, (candidatePath) =>
    mapSandboxGuestPathToCwd(candidatePath, cwd) ?? candidatePath,
  );
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Extract the last segment (file or folder name) from a path.
 * Works with both `/` and `\` separators and ignores trailing separators.
 */
export function getLastPathSegment(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/, '');
  const normalized = withoutTrailingSeparators || trimmed;
  const parts = normalized.split(/[\\/]+/).filter(Boolean);

  if (parts.length === 0) {
    return normalized;
  }

  return parts[parts.length - 1];
}

/**
 * Return a compact display name for a folder path, optionally truncated from
 * the right to `maxLength` characters.
 */
export function getCompactFolderName(rawPath: string, maxLength?: number): string {
  const folderName = getLastPathSegment(rawPath);
  if (!folderName) return '';

  if (typeof maxLength === 'number' && maxLength > 0 && folderName.length > maxLength) {
    return folderName.slice(-maxLength);
  }

  return folderName;
}
