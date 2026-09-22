'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Tldraw, Editor, TLComponents } from 'tldraw';
import {
  MousePointer,
  Pencil,
  Crosshair,
  Trash2,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  X,
  Highlighter,
  ArrowUpRight,
  Square,
  Type,
  Eraser,
  Palette,
  Sparkles,
} from 'lucide-react';

interface PresenterCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Yellow', value: 'yellow', hex: '#eab308' },
  { name: 'Light Blue', value: 'light-blue', hex: '#38bdf8' },
  { name: 'Light Green', value: 'light-green', hex: '#4ade80' },
  { name: 'Light Violet', value: 'light-violet', hex: '#a855f7' },
  { name: 'White', value: 'white', hex: '#ffffff' },
];

export const PresenterCanvas: React.FC<PresenterCanvasProps> = ({
  isOpen,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [passThrough, setPassThrough] = useState<boolean>(false);
  const [isLaserActive, setIsLaserActive] = useState<boolean>(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string>('draw');
  const [isCanvasVisible, setIsCanvasVisible] = useState<boolean>(true);
  const [showFullUi, setShowFullUi] = useState<boolean>(true);
  const [selectedColor, setSelectedColor] = useState<string>('yellow');
  const editorRef = useRef<Editor | null>(null);

  // Custom components to eliminate clutter and provide invisible background
  const components: TLComponents = useMemo(
    () => ({
      Background: null,
      ContextMenu: null,
      HelpMenu: null,
      MainMenu: null,
      PageMenu: null,
      NavigationPanel: null,
    }),
    []
  );

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    try {
      editor.user.updateUserPreferences({ colorScheme: 'dark' });
      editor.setCurrentTool('draw');
    } catch {}
  }, []);

  // Set tool in tldraw
  const selectTool = useCallback((toolId: string) => {
    setActiveTool(toolId);
    if (editorRef.current) {
      try {
        editorRef.current.setCurrentTool(toolId);
      } catch {}
    }
  }, []);

  // Set color in tldraw
  const selectColor = useCallback((colorName: string) => {
    setSelectedColor(colorName);
    if (editorRef.current) {
      try {
        editorRef.current.setStyleForNextShapes(
          // @ts-expect-error tldraw DefaultColorStyle
          { id: 'color', type: 'color' },
          colorName
        );
      } catch {}
    }
  }, []);

  // Clear all annotations
  const handleClear = useCallback(() => {
    if (editorRef.current) {
      try {
        const shapes = editorRef.current.getCurrentPageShapeIds();
        editorRef.current.deleteShapes(Array.from(shapes));
      } catch {}
    }
  }, []);

  // Track cursor position for custom Laser pointer
  useEffect(() => {
    if (!isOpen || !isLaserActive) {
      setLaserPos(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setLaserPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => setIsMouseDown(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, isLaserActive]);

  // Global keyboard shortcuts in presenter mode
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      // Escape -> exit presenter mode
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // 'L' -> Toggle Laser Pointer
      if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsLaserActive((prev) => {
          const next = !prev;
          if (next && editorRef.current && !passThrough) {
            try {
              editorRef.current.setCurrentTool('laser');
            } catch {}
          }
          return next;
        });
        return;
      }

      // 'T' -> Toggle Click Pass-Through
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPassThrough((prev) => !prev);
        return;
      }

      // 'C' -> Clear canvas
      if (e.key.toLowerCase() === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleClear();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleClear, passThrough]);

  // Ensure tldraw elements release focus when switching to pass-through
  useEffect(() => {
    if (passThrough && typeof document !== 'undefined') {
      if (document.activeElement && document.activeElement.closest('.presenter-tldraw-overlay')) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  }, [passThrough]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden pointer-events-none ${passThrough ? '' : 'select-none'}`}>
      {/* ─── Transparent Tldraw Canvas Container ─── */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          isCanvasVisible ? 'opacity-100' : 'opacity-0'
        } ${
          passThrough
            ? 'presenter-tldraw-overlay pass-through pointer-events-none'
            : 'presenter-tldraw-overlay draw-mode pointer-events-auto'
        }`}
        style={{ pointerEvents: passThrough ? 'none' : 'auto' }}
      >
        <Tldraw
          hideUi={!showFullUi}
          components={components}
          onMount={handleMount}
          autoFocus={!passThrough}
        />
      </div>

      {/* ─── Glowing Laser Pointer ─── */}
      {isLaserActive && laserPos && (
        <div
          className="fixed pointer-events-none z-100 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
          style={{
            left: `${laserPos.x}px`,
            top: `${laserPos.y}px`,
          }}
        >
          {/* Laser Center Dot */}
          <div
            className={`rounded-full bg-red-500 shadow-[0_0_12px_4px_#ef4444,0_0_24px_8px_rgba(239,68,68,0.5)] transition-all duration-100 ${
              isMouseDown ? 'w-4 h-4 scale-125' : 'w-3 h-3'
            }`}
          />
          {/* Outer Pulsing Halo */}
          <div className="absolute -inset-2.5 rounded-full border border-red-400/60 animate-ping opacity-75" />
          {/* Subtle Outer Glow Aura */}
          <div className="absolute -inset-6 rounded-full bg-red-500/20 blur-sm pointer-events-none" />
        </div>
      )}

      {/* ─── Floating Presenter Control Dock (Always Clickable) ─── */}
      <div className="presenter-dock absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-100 flex flex-col items-center gap-1.5 max-w-[95vw]">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-zinc-700/80 shadow-2xl text-zinc-200">
          {/* Presenter Mode Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-[11px] font-bold shrink-0">
            <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline font-mono">PRESENTER</span>
          </div>

          <div className="h-4 w-px bg-zinc-800 shrink-0 mx-0.5" />

          {/* 1. Toggle: Click Pass-Through (Interact with App vs Draw on Canvas) */}
          <button
            type="button"
            onClick={() => setPassThrough((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
              passThrough
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/40'
                : 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.3)] ring-1 ring-violet-500/40'
            }`}
            title={
              passThrough
                ? 'Click pass-through is ON: Clicks interact with 8085 simulator (Press T to toggle)'
                : 'Draw Mode is ON: Clicks draw annotations on canvas (Press T to toggle)'
            }
          >
            {passThrough ? (
              <>
                <MousePointer className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px]">Pass to App</span>
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-mono text-[11px]">Draw Mode</span>
              </>
            )}
          </button>

          {/* 2. Laser Pointer Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsLaserActive((prev) => {
                const next = !prev;
                if (next && editorRef.current && !passThrough) {
                  try {
                    editorRef.current.setCurrentTool('laser');
                  } catch {}
                }
                return next;
              });
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
              isLaserActive
                ? 'bg-red-500/20 border-red-500/60 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.4)] ring-1 ring-red-500/40'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Toggle Laser Pointer (Press L)"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLaserActive ? 'text-red-400 animate-spin' : 'text-zinc-400'}`} />
            <span className="font-mono text-[11px]">Laser</span>
            {isLaserActive && <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />}
          </button>

          <div className="h-4 w-px bg-zinc-800 shrink-0 mx-0.5" />

          {/* 3. Quick Drawing Tools Palette (active when in Draw Mode) */}
          <div className="flex items-center gap-0.5 bg-zinc-900/80 p-0.5 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('draw');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'draw'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Pen / Pencil"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('highlight');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'highlight'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Highlighter"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('arrow');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'arrow'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Arrow"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('geo');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'geo'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Rectangle / Shape"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('text');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'text'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Text Note"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPassThrough(false);
                selectTool('eraser');
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                !passThrough && activeTool === 'eraser'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Presets */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-900/80 px-1.5 py-1 rounded-xl border border-zinc-800">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => selectColor(c.value)}
                className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                  selectedColor === c.value
                    ? 'scale-125 border-white ring-1 ring-white/50'
                    : 'border-zinc-700/60 hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
                title={`Color: ${c.name}`}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-zinc-800 shrink-0 mx-0.5" />

          {/* 4. Full Tldraw UI Palette Toggle */}
          <button
            type="button"
            onClick={() => setShowFullUi((prev) => !prev)}
            className={`p-1.5 rounded-xl border text-xs transition-colors ${
              showFullUi
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle tldraw tool panel"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* 5. Hide / Show Annotations Toggle */}
          <button
            type="button"
            onClick={() => setIsCanvasVisible((prev) => !prev)}
            className={`p-1.5 rounded-xl border text-xs transition-colors ${
              isCanvasVisible
                ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}
            title={isCanvasVisible ? 'Hide Annotations' : 'Show Annotations'}
          >
            {isCanvasVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* 6. Clear Canvas */}
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
            title="Clear All Drawings (Ctrl+C)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* 7. Browser Fullscreen (F11) Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* 8. Exit Presenter Mode */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors ml-1"
            title="Exit Presenter Mode (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Presenter Mode Hint Tag */}
        <div className="px-2.5 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-[10px] text-zinc-400 font-mono shadow-sm flex items-center gap-3">
          <span>
            {passThrough ? (
              <span className="text-emerald-400 font-bold">● Pass-through active</span>
            ) : (
              <span className="text-violet-400 font-bold">● Draw mode active</span>
            )}
          </span>
          <span className="text-zinc-600">|</span>
          <span>Shortcuts: <kbd className="text-zinc-300">T</kbd> Pass-Through · <kbd className="text-zinc-300">L</kbd> Laser · <kbd className="text-zinc-300">Esc</kbd> Exit</span>
        </div>
      </div>
    </div>
  );
};
