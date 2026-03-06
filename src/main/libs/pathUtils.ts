/**
 * Main-process path utilities.
 *
 * Re-exports every helper from the shared `pathCore` module and adds functions
 * that depend on Node.js built-ins (`path`, `fs`, `os`) or Electron APIs.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';

// Re-export all shared (pure-string) helpers so callers only need one import.
export * from '../../shared/pathCore';

import {
  safeDecodeURIComponent,
  stripFileProtocol,
  normalizeWindowsDriveLetter,
  normalizeUnicode,
} from '../../shared/pathCore';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// ---------------------------------------------------------------------------
// Platform-aware path normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a path for the current platform.
 *
 * Applies — in order:
 *   1. `file://` protocol stripping + URI decoding
 *   2. macOS NFC normalisation (fixes NFD mismatches from HFS+/APFS)
 *   3. Windows drive-letter uppercasing + separator normalisation
 *   4. `path.normalize` for `.` / `..` segments and duplicate separators
 */
export function normalizePlatformPath(inputPath: string): string {
  let result = inputPath.trim();
  if (!result) return result;

  // 1. file:// protocol
  if (/^file:\/\//i.test(result)) {
    result = safeDecodeURIComponent(result.replace(/^file:\/\//i, ''));
    // Undo leading / before drive letter on Windows (file:///C:/…)
    if (/^\/[A-Za-z]:/.test(result)) {
      result = result.slice(1);
    }
  }

  // 2. macOS Unicode normalisation
  if (isMac) {
    result = normalizeUnicode(result);
  }

  // 3. Windows drive letter + separators
  if (isWindows) {
    result = normalizeWindowsDriveLetter(result);
  }

  // 4. Standard normalisation (., .., duplicate separators)
  result = path.normalize(result);

  return result;
}

// ---------------------------------------------------------------------------
// Home-directory expansion
// ---------------------------------------------------------------------------

/**
 * Expand a leading `~/` (or `~\` on Windows) to the user's home directory.
 */
export function expandHome(inputPath: string): string {
  if (!inputPath.startsWith('~/') && !inputPath.startsWith('~\\')) {
    return inputPath;
  }
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.resolve(home, inputPath.slice(2));
}

// ---------------------------------------------------------------------------
// Resource-path resolution (dev vs packaged)
// ---------------------------------------------------------------------------

/**
 * Return the path to a resource file, handling the difference between
 * development (`__dirname`-relative) and packaged (`process.resourcesPath`)
 * Electron builds.
 *
 * In development the project root is inferred by walking up from `__dirname`
 * (which typically points at `dist-electron/`).
 */
export function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  // Development: __dirname is dist-electron/ → project root is one level up.
  return path.join(__dirname, '..', ...segments);
}

/**
 * Like `getResourcePath` but ensures the path points outside of the `.asar`
 * archive (i.e. into `app.asar.unpacked/…`).
 *
 * Use this when the target file must be accessible to native code or
 * `child_process` (which cannot read from inside an asar).
 */
export function getAsarUnpackedPath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      ...segments,
    );
  }
  return path.join(app.getAppPath(), ...segments);
}

// ---------------------------------------------------------------------------
// Path comparison
// ---------------------------------------------------------------------------

/**
 * Compare two paths in a platform-aware manner.
 *
 *   - Windows: case-insensitive comparison after normalisation.
 *   - macOS:   NFC-normalised, case-insensitive comparison.
 *   - Linux:   exact comparison after normalisation.
 */
export function pathsEqual(a: string, b: string): boolean {
  let na = normalizePlatformPath(a);
  let nb = normalizePlatformPath(b);

  if (isWindows || isMac) {
    na = na.toLowerCase();
    nb = nb.toLowerCase();
  }

  return na === nb;
}

// ---------------------------------------------------------------------------
// File-name helpers (need Node.js `path`)
// ---------------------------------------------------------------------------

/**
 * Sanitise a raw file name (or full path) for safe use as a file name.
 * Extracts the basename first to strip directory components.
 */
export function sanitizeAttachmentName(value: string | undefined, fallback = 'attachment'): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  const fileName = path.basename(raw);
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || fallback;
}
