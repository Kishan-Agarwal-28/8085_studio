import { PRESET_PROGRAMS } from '@/lib/8085/presets';

export interface FileNode {
  id: string; // Absolute path, e.g. "/examples/bubble_sort.asm"
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: FileNode[];
}

/**
 * Normalizes a path to start with '/' and not end with '/' (except root '/')
 */
export function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return '/' + parts.join('/');
}

/**
 * Splits path into parent directory and entry name
 */
export function splitPath(path: string): { parentPath: string; name: string } {
  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { parentPath: '/', name: '' };
  }
  const name = parts[parts.length - 1];
  const parentParts = parts.slice(0, -1);
  const parentPath = '/' + parentParts.join('/');
  return { parentPath, name };
}

// In-memory / localStorage fallback in case OPFS is blocked or unavailable (e.g. older browsers or restricted iframes)
class MemoryStorageFallback {
  private storageKey = '8085_opfs_fallback_files';
  private files: Record<string, string> = {}; // path -> content
  private dirs: Set<string> = new Set(['/', '/examples', '/my_programs']);

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.files = parsed.files || {};
          this.dirs = new Set(parsed.dirs || ['/', '/examples', '/my_programs']);
        }
      } catch {
        // storage disabled
      }
    }
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({ files: this.files, dirs: Array.from(this.dirs) })
        );
      } catch {}
    }
  }

  public async getTree(): Promise<FileNode[]> {
    const rootNodes: FileNode[] = [];
    const dirMap = new Map<string, FileNode>();

    dirMap.set('/', { id: '/', name: 'root', path: '/', kind: 'directory', children: [] });

    // Ensure all directories are in map
    const sortedDirs = Array.from(this.dirs).sort((a, b) => a.localeCompare(b));
    for (const d of sortedDirs) {
      if (d === '/') continue;
      const { parentPath, name } = splitPath(d);
      const node: FileNode = { id: d, name, path: d, kind: 'directory', children: [] };
      dirMap.set(d, node);
      const parent = dirMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Add files
    for (const [filePath] of Object.entries(this.files)) {
      const { parentPath, name } = splitPath(filePath);
      const fileNode: FileNode = { id: filePath, name, path: filePath, kind: 'file' };
      const parent = dirMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(fileNode);
      } else {
        rootNodes.push(fileNode);
      }
    }

    const root = dirMap.get('/')!;
    return root.children || [];
  }

  public async readFile(path: string): Promise<string> {
    const norm = normalizePath(path);
    if (this.files[norm] !== undefined) return this.files[norm];
    throw new Error(`File not found: ${path}`);
  }

  public async writeFile(path: string, content: string): Promise<void> {
    const norm = normalizePath(path);
    const { parentPath } = splitPath(norm);
    this.dirs.add(parentPath);
    this.files[norm] = content;
    this.persist();
  }

  public async createFile(parentPath: string, name: string, content = ''): Promise<string> {
    const parent = normalizePath(parentPath);
    const fullPath = normalizePath(`${parent}/${name}`);
    this.dirs.add(parent);
    this.files[fullPath] = content;
    this.persist();
    return fullPath;
  }

  public async createDirectory(parentPath: string, name: string): Promise<string> {
    const parent = normalizePath(parentPath);
    const fullPath = normalizePath(`${parent}/${name}`);
    this.dirs.add(parent);
    this.dirs.add(fullPath);
    this.persist();
    return fullPath;
  }

  public async deleteItem(path: string, isDirectory: boolean): Promise<void> {
    const norm = normalizePath(path);
    if (isDirectory) {
      this.dirs.delete(norm);
      for (const d of Array.from(this.dirs)) {
        if (d.startsWith(norm + '/')) this.dirs.delete(d);
      }
      for (const f of Object.keys(this.files)) {
        if (f.startsWith(norm + '/')) delete this.files[f];
      }
    } else {
      delete this.files[norm];
    }
    this.persist();
  }

  public async renameItem(path: string, newName: string, isDirectory: boolean): Promise<string> {
    const norm = normalizePath(path);
    const { parentPath } = splitPath(norm);
    const newPath = normalizePath(`${parentPath}/${newName}`);

    if (isDirectory) {
      this.dirs.delete(norm);
      this.dirs.add(newPath);
      for (const d of Array.from(this.dirs)) {
        if (d.startsWith(norm + '/')) {
          this.dirs.delete(d);
          this.dirs.add(d.replace(norm, newPath));
        }
      }
      for (const [f, c] of Object.entries(this.files)) {
        if (f.startsWith(norm + '/')) {
          delete this.files[f];
          this.files[f.replace(norm, newPath)] = c;
        }
      }
    } else {
      const content = this.files[norm] || '';
      delete this.files[norm];
      this.files[newPath] = content;
    }
    this.persist();
    return newPath;
  }
}

const memoryFallback = new MemoryStorageFallback();

/**
 * Checks whether Origin Private File System (OPFS) is supported in current environment
 */
export function isOPFSSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(navigator?.storage?.getDirectory);
}

/**
 * Gets the OPFS root directory handle
 */
async function getOPFSRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOPFSSupported()) return null;
  try {
    return await navigator.storage.getDirectory();
  } catch (err) {
    console.warn('[OPFS] Failed to obtain root directory handle, falling back:', err);
    return null;
  }
}

/**
 * Resolves a directory handle along a path, optionally creating missing directories
 */
async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  dirPath: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  const parts = normalizePath(dirPath).split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/**
 * Recursively builds the directory tree from a directory handle
 */
async function buildTreeFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  // Use values() async iterator on FileSystemDirectoryHandle
  // @ts-expect-error - entries/values are standard async iterators on FileSystemDirectoryHandle in modern browsers
  for await (const handle of dirHandle.values()) {
    const itemPath = normalizePath(`${currentPath}/${handle.name}`);
    if (handle.kind === 'directory') {
      const children = await buildTreeFromHandle(handle as FileSystemDirectoryHandle, itemPath);
      nodes.push({
        id: itemPath,
        name: handle.name,
        path: itemPath,
        kind: 'directory',
        children,
      });
    } else if (handle.kind === 'file') {
      nodes.push({
        id: itemPath,
        name: handle.name,
        path: itemPath,
        kind: 'file',
      });
    }
  }

  // Sort directories first, then alphabetically
  nodes.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });

  return nodes;
}

/**
 * Seeds default folders and sample files if the file system is currently empty
 */
async function seedDefaultFilesIfEmpty(root: FileSystemDirectoryHandle): Promise<void> {
  let hasEntries = false;
  try {
    // @ts-expect-error - values() on directory handle
    for await (const _ of root.values()) {
      hasEntries = true;
      break;
    }
  } catch {
    hasEntries = false;
  }

  if (hasEntries) return;

  try {
    // 1. Create examples folder with preset programs
    const examplesDir = await root.getDirectoryHandle('examples', { create: true });
    for (const preset of PRESET_PROGRAMS) {
      const fileName = `${preset.id.replace(/-/g, '_')}.asm`;
      const fileHandle = await examplesDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(preset.code);
      await writable.close();
    }

    // 2. Create my_programs folder with starter main.asm
    const myProgramsDir = await root.getDirectoryHandle('my_programs', { create: true });
    const mainHandle = await myProgramsDir.getFileHandle('main.asm', { create: true });
    const writable = await mainHandle.createWritable();
    const starterCode = `; ============================================
; 8085 Assembly - My Program
; ============================================
ORG 2000H

MVI A, 05H        ; Load Accumulator with 5
MVI B, 03H        ; Load Register B with 3
ADD B             ; A = A + B (5 + 3 = 8)
STA 2050H         ; Store result 8 in memory at 2050H
HLT               ; Stop execution
`;
    await writable.write(starterCode);
    await writable.close();
  } catch (e) {
    console.warn('[OPFS] Seeding default files error:', e);
  }
}

/**
 * Initializes the OPFS filesystem and returns the top-level tree
 */
export async function initFileSystem(): Promise<FileNode[]> {
  const root = await getOPFSRoot();
  if (!root) {
    // Initialize memory fallback if empty
    const tree = await memoryFallback.getTree();
    if (tree.length === 0) {
      for (const preset of PRESET_PROGRAMS) {
        const fileName = `${preset.id.replace(/-/g, '_')}.asm`;
        await memoryFallback.createFile('/examples', fileName, preset.code);
      }
      await memoryFallback.createFile(
        '/my_programs',
        'main.asm',
        `; 8085 Assembly Program\nORG 2000H\n\nMVI A, 05H\nMVI B, 03H\nADD B\nSTA 2050H\nHLT\n`
      );
    }
    return memoryFallback.getTree();
  }

  await seedDefaultFilesIfEmpty(root);
  return await buildTreeFromHandle(root);
}

/**
 * Gets the full directory tree
 */
export async function getDirectoryTree(): Promise<FileNode[]> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.getTree();
  return await buildTreeFromHandle(root);
}

/**
 * Reads text content from a file path
 */
export async function readFile(path: string): Promise<string> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.readFile(path);

  const { parentPath, name } = splitPath(path);
  const dirHandle = await resolveDirectory(root, parentPath, false);
  const fileHandle = await dirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Writes text content to an existing or new file path
 */
export async function writeFile(path: string, content: string): Promise<void> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.writeFile(path, content);

  const { parentPath, name } = splitPath(path);
  const dirHandle = await resolveDirectory(root, parentPath, true);
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Creates a new file in the specified directory
 */
export async function createFile(parentPath: string, name: string, initialContent = ''): Promise<string> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.createFile(parentPath, name, initialContent);

  const dirHandle = await resolveDirectory(root, parentPath, true);
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(initialContent);
  await writable.close();

  return normalizePath(`${parentPath}/${name}`);
}

/**
 * Creates a new directory in the specified directory
 */
export async function createFolder(parentPath: string, name: string): Promise<string> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.createDirectory(parentPath, name);

  const dirHandle = await resolveDirectory(root, parentPath, true);
  await dirHandle.getDirectoryHandle(name, { create: true });

  return normalizePath(`${parentPath}/${name}`);
}

/**
 * Deletes a file or directory
 */
export async function deleteEntry(path: string, kind: 'file' | 'directory'): Promise<void> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.deleteItem(path, kind === 'directory');

  const { parentPath, name } = splitPath(path);
  const dirHandle = await resolveDirectory(root, parentPath, false);
  await dirHandle.removeEntry(name, { recursive: kind === 'directory' });
}

/**
 * Renames a file or directory
 */
export async function renameEntry(path: string, newName: string, kind: 'file' | 'directory'): Promise<string> {
  const root = await getOPFSRoot();
  if (!root) return memoryFallback.renameItem(path, newName, kind === 'directory');

  const { parentPath, name } = splitPath(path);
  const dirHandle = await resolveDirectory(root, parentPath, false);

  if (kind === 'file') {
    const oldFileHandle = await dirHandle.getFileHandle(name);
    // @ts-expect-error - Chromium handle.move support
    if (typeof oldFileHandle.move === 'function') {
      // @ts-expect-error - move API
      await oldFileHandle.move(newName);
    } else {
      // Cross-browser copy-and-delete fallback
      const file = await oldFileHandle.getFile();
      const content = await file.text();
      const newFileHandle = await dirHandle.getFileHandle(newName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      await dirHandle.removeEntry(name);
    }
  } else {
    const oldDirHandle = await dirHandle.getDirectoryHandle(name);
    // @ts-expect-error - Chromium handle.move support
    if (typeof oldDirHandle.move === 'function') {
      // @ts-expect-error - move API
      await oldDirHandle.move(newName);
    } else {
      // Cross-browser recursive copy and delete
      await copyDirectoryRecursive(oldDirHandle, dirHandle, newName);
      await dirHandle.removeEntry(name, { recursive: true });
    }
  }

  return normalizePath(`${parentPath}/${newName}`);
}

/**
 * Helper to recursively copy directory contents
 */
async function copyDirectoryRecursive(
  srcDir: FileSystemDirectoryHandle,
  destParent: FileSystemDirectoryHandle,
  newDirName: string
): Promise<void> {
  const newDir = await destParent.getDirectoryHandle(newDirName, { create: true });
  // @ts-expect-error - values() on directory handle
  for await (const handle of srcDir.values()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const targetFile = await newDir.getFileHandle(handle.name, { create: true });
      const w = await targetFile.createWritable();
      await w.write(text);
      await w.close();
    } else if (handle.kind === 'directory') {
      await copyDirectoryRecursive(handle as FileSystemDirectoryHandle, newDir, handle.name);
    }
  }
}
