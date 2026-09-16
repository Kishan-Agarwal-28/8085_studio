'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Check,
  X,
  Plus,
} from 'lucide-react';
import {
  FileNode,
  initFileSystem,
  getDirectoryTree,
  createFile,
  createFolder,
  deleteEntry,
  renameEntry,
  isOPFSSupported,
} from '@/lib/opfs/filesystem';
import { toast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FileExplorerProps {
  currentFilePath: string | null;
  hasUnsavedChanges?: boolean;
  onSelectFile: (path: string) => void;
  onFileDeleted?: (deletedPath: string) => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  currentFilePath,
  hasUnsavedChanges = false,
  onSelectFile,
  onFileDeleted,
  onFileRenamed,
}) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/examples', '/my_programs'])
  );
  const [loading, setLoading] = useState(false);
  const [isOpfs] = useState(() => (typeof window !== 'undefined' ? isOPFSSupported() : true));

  // Inline creation state: { parentPath: string, type: 'file' | 'folder' } | null
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [createName, setCreateName] = useState('');

  // Inline rename state: { path: string, kind: 'file' | 'directory', currentName: string } | null
  const [renaming, setRenaming] = useState<{
    path: string;
    kind: 'file' | 'directory';
    currentName: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    path: string;
    name: string;
    kind: 'file' | 'directory';
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load tree on mount
  const refreshTree = useCallback(async () => {
    setLoading(true);
    try {
      const nodes = await getDirectoryTree();
      setTree(nodes);
    } catch (e) {
      console.error('Error refreshing tree:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initFileSystem()
      .then((nodes) => {
        setTree(nodes);
      })
      .catch((e) => {
        console.error('Init FS error:', e);
      });
  }, []);

  useEffect(() => {
    if (creating || renaming) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [creating, renaming]);

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Start new file / folder creation
  const handleStartCreate = (parentPath: string, type: 'file' | 'folder', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => new Set(prev).add(parentPath));
    setRenaming(null);
    setCreating({ parentPath, type });
    setCreateName(type === 'file' ? 'untitled.asm' : 'new_folder');
  };

  // Commit new file / folder creation
  const handleCommitCreate = async () => {
    if (!creating) return;
    const name = createName.trim();
    if (!name) {
      setCreating(null);
      return;
    }

    try {
      if (creating.type === 'file') {
        const finalName = name.endsWith('.asm') ? name : `${name}.asm`;
        const initialTemplate = `; ============================================
; 8085 Assembly - ${finalName}
; ============================================
ORG 2000H

MVI A, 00H
HLT
`;
        const newPath = await createFile(creating.parentPath, finalName, initialTemplate);
        await refreshTree();
        onSelectFile(newPath);
        toast.add({
          title: 'File Created',
          description: `Created ${finalName} in ${creating.parentPath}`,
          type: 'success',
        });
      } else {
        await createFolder(creating.parentPath, name);
        await refreshTree();
        setExpandedFolders((prev) => new Set(prev).add(`${creating.parentPath}/${name}`));
        toast.add({
          title: 'Folder Created',
          description: `Created folder "${name}"`,
          type: 'success',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.add({
        title: 'Creation Failed',
        description: msg || 'Could not create item',
        type: 'error',
      });
    } finally {
      setCreating(null);
      setCreateName('');
    }
  };

  // Start rename
  const handleStartRename = (
    path: string,
    currentName: string,
    kind: 'file' | 'directory',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setCreating(null);
    setRenaming({ path, kind, currentName });
    setRenameValue(currentName);
  };

  // Commit rename
  const handleCommitRename = async () => {
    if (!renaming) return;
    const newName = renameValue.trim();
    if (!newName || newName === renaming.currentName) {
      setRenaming(null);
      return;
    }

    try {
      const newPath = await renameEntry(renaming.path, newName, renaming.kind);
      await refreshTree();
      if (onFileRenamed) onFileRenamed(renaming.path, newPath);
      if (currentFilePath === renaming.path) {
        onSelectFile(newPath);
      }
      toast.add({
        title: 'Renamed Successfully',
        description: `Renamed to "${newName}"`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.add({
        title: 'Rename Failed',
        description: msg || 'Could not rename item',
        type: 'error',
      });
    } finally {
      setRenaming(null);
      setRenameValue('');
    }
  };

  // Delete file or folder - opens custom AlertDialog
  const handleDelete = (
    path: string,
    name: string,
    kind: 'file' | 'directory',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setDeleteTarget({ path, name, kind });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { path, name, kind } = deleteTarget;
    setDeleteTarget(null);

    try {
      await deleteEntry(path, kind);
      await refreshTree();
      if (onFileDeleted) onFileDeleted(path);
      toast.add({
        title: `${kind === 'directory' ? 'Folder' : 'File'} Deleted`,
        description: `Deleted "${name}"`,
        type: 'info',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.add({
        title: 'Delete Failed',
        description: msg || 'Could not delete item',
        type: 'error',
      });
    }
  };

  // Recursive Tree Node Renderer
  const renderNode = (node: FileNode, depth = 0) => {
    const isFolder = node.kind === 'directory';
    const isExpanded = expandedFolders.has(node.path);
    const isCurrent = currentFilePath === node.path;
    const isBeingRenamed = renaming?.path === node.path;
    const isParentOfCreating = creating?.parentPath === node.path;

    return (
      <div key={node.path} className="flex flex-col select-none">
        {/* Node Row */}
        <div
          onClick={(e) => {
            if (isFolder) {
              toggleFolder(node.path, e);
            } else {
              onSelectFile(node.path);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 text-xs font-mono cursor-pointer transition-colors border-l-2 ${
            isCurrent
              ? 'bg-amber-500/15 border-amber-500 text-amber-200 font-semibold'
              : 'border-transparent text-zinc-300 hover:bg-zinc-900/80 hover:text-zinc-100'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
            {/* Folder Caret */}
            {isFolder ? (
              <span
                onClick={(e) => toggleFolder(node.path, e)}
                className="p-0.5 text-zinc-500 hover:text-zinc-200"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </span>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {/* Icon */}
            {isFolder ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400/80 shrink-0" />
              )
            ) : (
              <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
            )}

            {/* Name or Rename Input */}
            {isBeingRenamed ? (
              <div
                className="flex items-center gap-1 flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className="bg-zinc-950 px-1 py-0.5 text-xs text-amber-200 border border-amber-500 rounded outline-none w-full"
                />
                <button
                  type="button"
                  onClick={handleCommitRename}
                  className="p-0.5 hover:text-green-400"
                  title="Confirm"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(null)}
                  className="p-0.5 hover:text-red-400"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="truncate flex-1" title={node.name}>
                {node.name}
              </span>
            )}

            {/* Unsaved indicator for active file */}
            {!isFolder && isCurrent && hasUnsavedChanges && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
            )}
          </div>

          {/* Quick Hover Actions */}
          {!isBeingRenamed && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
              {isFolder && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleStartCreate(node.path, 'file', e)}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                    title="New file in this folder"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleStartCreate(node.path, 'folder', e)}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                    title="New subfolder"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={(e) => handleStartRename(node.path, node.name, node.kind, e)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400"
                title="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(node.path, node.name, node.kind, e)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Children (if expanded folder) */}
        {isFolder && isExpanded && (
          <div className="flex flex-col">
            {/* Inline creation field if adding item inside this folder */}
            {isParentOfCreating && (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                className="flex items-center gap-1.5 py-1 pr-2 bg-zinc-900/60"
              >
                {creating.type === 'folder' ? (
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitCreate();
                    if (e.key === 'Escape') setCreating(null);
                  }}
                  placeholder={creating.type === 'file' ? 'filename.asm' : 'folder_name'}
                  className="bg-zinc-950 px-1 py-0.5 text-xs text-amber-200 border border-amber-500 rounded outline-none flex-1 font-mono"
                />
                <button
                  type="button"
                  onClick={handleCommitCreate}
                  className="p-0.5 text-green-400 hover:text-green-300"
                  title="Create (Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(null)}
                  className="p-0.5 text-red-400 hover:text-red-300"
                  title="Cancel (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {node.children && node.children.length > 0 ? (
              node.children.map((child) => renderNode(child, depth + 1))
            ) : !isParentOfCreating ? (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                className="py-1 text-[11px] font-mono text-zinc-600 italic"
              >
                (Empty folder)
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-border select-none overflow-hidden">
      {/* ─── Explorer Header ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/60 text-xs font-semibold shrink-0">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <HardDrive className="w-3.5 h-3.5 text-amber-400" />
          <span className="tracking-wider uppercase text-[11px] font-bold">Files</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStartCreate('/', 'file')}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
            title="New File at root"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStartCreate('/', 'folder')}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
            title="New Folder at root"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={refreshTree}
            className={`p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition ${
              loading ? 'animate-spin text-amber-400' : ''
            }`}
            title="Refresh Files"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Root Level Inline Creation ─── */}
      {creating && creating.parentPath === '/' && (
        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-900/80 border-b border-zinc-800">
          {creating.type === 'folder' ? (
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitCreate();
              if (e.key === 'Escape') setCreating(null);
            }}
            placeholder={creating.type === 'file' ? 'filename.asm' : 'folder_name'}
            className="bg-zinc-950 px-1 py-0.5 text-xs text-amber-200 border border-amber-500 rounded outline-none flex-1 font-mono"
          />
          <button
            type="button"
            onClick={handleCommitCreate}
            className="p-0.5 text-green-400 hover:text-green-300"
            title="Create (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCreating(null)}
            className="p-0.5 text-red-400 hover:text-red-300"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Tree Content ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent py-1">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-zinc-500 flex flex-col items-center gap-2">
            <span>No files found.</span>
            <button
              onClick={() => handleStartCreate('/', 'file')}
              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
            >
              <Plus className="w-3 h-3" /> Create a file
            </button>
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* ─── Storage Footer Badge ─── */}
      <div className="p-2 border-t border-border bg-card/40 flex items-center justify-between text-[10px] font-mono text-zinc-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isOpfs ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>Workspace Ready</span>
        </div>
        <span className="text-zinc-600">v1.0</span>
      </div>

      {/* ─── Delete Confirmation Alert Dialog ─── */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border border-border bg-zinc-950 text-zinc-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-zinc-100">
              Delete {deleteTarget?.kind === 'directory' ? 'Folder' : 'File'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400">
              Are you sure you want to delete <span className="font-semibold text-zinc-200">&quot;{deleteTarget?.name}&quot;</span>?
              {deleteTarget?.kind === 'directory' && ' All contents inside will also be deleted.'} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              variant="outline"
              size="sm"
              className="text-xs bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
