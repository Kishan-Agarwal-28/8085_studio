'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PRESET_PROGRAMS, PresetProgram } from '@/lib/8085/presets';
import { CompileResult, SimulationResult, TraceStep } from '@/lib/8085/types';
import { WorkerClient } from '@/lib/worker-client';
import { toast } from '@/components/ui/toast';
import {
  Play,
  Hammer,
  ChevronDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Pause,
  Download,
  Cpu,
  FolderTree,
  Save,
  Home as HomeIcon,
  BookOpen,
} from 'lucide-react';
import { FileExplorer } from '@/components/FileExplorer';
import {
  readFile,
  writeFile,
  initFileSystem,
  splitPath,
} from '@/lib/opfs/filesystem';

const Monaco8085Editor = dynamic(
  () => import('@/components/Monaco8085Editor').then((m) => m.Monaco8085Editor),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950 animate-pulse rounded-lg" /> }
);

const CpuVisualizer = dynamic(
  () => import('@/components/CpuVisualizer').then((m) => m.CpuVisualizer),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950 animate-pulse rounded-lg" /> }
);

function SimulatorApp() {
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_PROGRAMS[0].id);
  const [code, setCode] = useState(PRESET_PROGRAMS[0].code);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(() =>
    WorkerClient.compile(PRESET_PROGRAMS[0].code)
  );
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(() => {
    const comp = WorkerClient.compile(PRESET_PROGRAMS[0].code);
    if (comp.success) {
      return WorkerClient.simulate(comp, PRESET_PROGRAMS[0].initialMemory);
    }
    return null;
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [memBaseAddress, setMemBaseAddress] = useState<number>(
    () => PRESET_PROGRAMS[0].initialMemory?.[0]?.address ?? 0x2050
  );
  const [userMemoryEdits, setUserMemoryEdits] = useState<Record<number, number>>({});

  // File System & OPFS states with LocalStorage persistence
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('8085_explorer_open');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [explorerWidth, setExplorerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('8085_explorer_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 160 && parsed <= 420) return parsed;
      }
    } catch {}
    return 230;
  });
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('8085_current_file');
      if (saved) return saved;
    } catch {}
    return '/my_programs/main.asm';
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingExplorer = useRef(false);

  // Resizing States with LocalStorage Persistence
  const [editorWidth, setEditorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('8085_editor_width');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) return parsed;
      }
    } catch {}
    return 45;
  });
  const [hexHeight, setHexHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('8085_hex_height');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 50 && parsed <= 450) return parsed;
      }
    } catch {}
    return 140;
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const isDraggingHoriz = useRef(false);
  const isDraggingVert = useRef(false);

  const currentPreset = useMemo<PresetProgram>(
    () => PRESET_PROGRAMS.find((p) => p.id === selectedPresetId) || PRESET_PROGRAMS[0],
    [selectedPresetId]
  );

  // Register service worker and load initial file from OPFS
  useEffect(() => {
    WorkerClient.registerServiceWorker();

    // Initialize OPFS and load last opened file if exists
    initFileSystem().then(async () => {
      let fileToLoad = '/my_programs/main.asm';
      try {
        const saved = localStorage.getItem('8085_current_file');
        if (saved) fileToLoad = saved;
      } catch {}

      try {
        const fileContent = await readFile(fileToLoad);
        if (fileContent) {
          setCode(fileContent);
          setCurrentFilePath(fileToLoad);
        }
      } catch {
        // file doesn't exist yet, keep default code
      }
    });
  }, []);

  // Horizontal Drag Handler (Code Editor vs Visualizer split)
  const handleHorizMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHoriz.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingHoriz.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (offsetX / rect.width) * 100));
      setEditorWidth(pct);
    };

    const onMouseUp = () => {
      isDraggingHoriz.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setEditorWidth((curr) => {
        try {
          localStorage.setItem('8085_editor_width', curr.toFixed(1));
        } catch {}
        return curr;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Vertical Drag Handler (Editor vs Hex panel split)
  const handleVertMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingVert.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const startY = e.clientY;
    const startHeight = hexHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingVert.current) return;
      const delta = startY - moveEvent.clientY; // dragging up increases hex height
      const newH = Math.max(50, Math.min(450, startHeight + delta));
      setHexHeight(newH);
    };

    const onMouseUp = () => {
      isDraggingVert.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setHexHeight((curr) => {
        try {
          localStorage.setItem('8085_hex_height', curr.toString());
        } catch {}
        return curr;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Playback timer
  useEffect(() => {
    if (isPlaying && simulationResult) {
      const ms = Math.max(80, Math.floor(600 / speed));
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= (simulationResult?.steps.length ?? 1) - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, ms);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, simulationResult]);

  // Explorer Drag Handler (Resizing File Explorer width)
  const handleExplorerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingExplorer.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingExplorer.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const clamped = Math.max(160, Math.min(420, offsetX));
      setExplorerWidth(clamped);
    };

    const onMouseUp = () => {
      isDraggingExplorer.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setExplorerWidth((curr) => {
        try {
          localStorage.setItem('8085_explorer_width', curr.toString());
        } catch {}
        return curr;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleToggleExplorer = () => {
    setIsExplorerOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('8085_explorer_open', String(next));
      } catch {}
      return next;
    });
  };

  // Code change with 10s debounced auto-save
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setHasUnsavedChanges(true);

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (currentFilePath) {
        try {
          await writeFile(currentFilePath, newCode);
          setHasUnsavedChanges(false);
        } catch (err) {
          console.warn('[AutoSave error]:', err);
        }
      }
    }, 10000); // 10s debounce auto-save
  }, [currentFilePath]);

  // Manual save (Ctrl+S or Save Button)
  const handleSaveFile = useCallback(async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const targetPath = currentFilePath || '/my_programs/main.asm';
    try {
      await writeFile(targetPath, code);
      setHasUnsavedChanges(false);
      setCurrentFilePath(targetPath);
      try {
        localStorage.setItem('8085_current_file', targetPath);
      } catch {}
      toast.add({
        title: 'File Saved',
        description: `Saved "${splitPath(targetPath).name}"`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.add({
        title: 'Save Failed',
        description: msg || 'Could not save file',
        type: 'error',
      });
    }
  }, [code, currentFilePath]);

  // Open / Switch file
  const handleSelectFile = useCallback(
    async (path: string) => {
      try {
        // Auto-save previous file if modified
        if (hasUnsavedChanges && currentFilePath) {
          await writeFile(currentFilePath, code);
        }
        const content = await readFile(path);
        setCode(content);
        setCurrentFilePath(path);
        setHasUnsavedChanges(false);
        try {
          localStorage.setItem('8085_current_file', path);
        } catch {}
        toast.add({
          title: 'Opened File',
          description: splitPath(path).name,
          type: 'info',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.add({
          title: 'Failed to Open File',
          description: msg || 'Could not read file',
          type: 'error',
        });
      }
    },
    [code, currentFilePath, hasUnsavedChanges]
  );

  const handleFileDeleted = useCallback(
    (deletedPath: string) => {
      if (currentFilePath === deletedPath) {
        setCurrentFilePath(null);
        setHasUnsavedChanges(false);
      }
    },
    [currentFilePath]
  );

  const handleFileRenamed = useCallback(
    (oldPath: string, newPath: string) => {
      if (currentFilePath === oldPath) {
        setCurrentFilePath(newPath);
        try {
          localStorage.setItem('8085_current_file', newPath);
        } catch {}
      }
    },
    [currentFilePath]
  );

  // Playback helpers
  const steps = simulationResult?.steps ?? [];
  const totalSteps = steps.length;
  const activeStep: TraceStep | undefined = totalSteps > 0 && currentStep < totalSteps ? steps[currentStep] : undefined;
  const activeLine = activeStep?.line;

  const handleTogglePlay = useCallback(() => {
    if (totalSteps === 0) return;
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [currentStep, totalSteps]);

  const handleNextStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const handlePrevStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
    toast.add({
      title: 'Program Reset',
      description: 'Simulator reset to Step 0',
      type: 'info',
    });
  }, []);

  // STEP 1: Compile
  const handleCompile = useCallback(() => {
    setIsPlaying(false);
    const result = WorkerClient.compile(code);
    setCompileResult(result);
    setSimulationResult(null);
    setCurrentStep(0);

    if (result.success) {
      toast.add({
        title: 'Compilation Successful',
        description: `${result.machineCode.length} bytes generated. Click "Run" to simulate.`,
        type: 'success',
      });
    } else {
      const errCount = result.diagnostics.filter((d) => d.severity === 'error').length;
      toast.add({
        title: 'Compilation Failed',
        description: `${errCount} error${errCount !== 1 ? 's' : ''} found. Check the editor for details.`,
        type: 'error',
      });
    }
  }, [code]);

  // STEP 2: Run
  const handleRun = useCallback(() => {
    setIsPlaying(false);
    const comp = WorkerClient.compile(code);
    setCompileResult(comp);

    if (!comp.success) {
      const errCount = comp.diagnostics.filter((d) => d.severity === 'error').length;
      toast.add({
        title: 'Cannot Run — Compilation Failed',
        description: `Fix ${errCount} error${errCount !== 1 ? 's' : ''} before running.`,
        type: 'error',
      });
      return;
    }

    // Merge preset initialMemory and user's manual memory modifications
    const memMap = new Map<number, number>();
    if (currentPreset.initialMemory) {
      for (const block of currentPreset.initialMemory) {
        for (let i = 0; i < block.values.length; i++) {
          memMap.set((block.address + i) & 0xFFFF, block.values[i] & 0xFF);
        }
      }
    }
    // Overlay user memory edits
    for (const [addrStr, byteVal] of Object.entries(userMemoryEdits)) {
      memMap.set(parseInt(addrStr, 10) & 0xFFFF, byteVal & 0xFF);
    }

    const initialMemBlocks: { address: number; values: number[] }[] = [];
    memMap.forEach((byteVal, addr) => {
      initialMemBlocks.push({ address: addr, values: [byteVal] });
    });

    const sim = WorkerClient.simulate(comp, initialMemBlocks);
    setSimulationResult(sim);
    setCurrentStep(0);

    // Auto-detect optimal memory base address
    let targetMem = 0x2050;
    const firstMemAccessStep = sim.steps.find((s) => s.activeMemoryAddresses && s.activeMemoryAddresses.length > 0);
    if (firstMemAccessStep && firstMemAccessStep.activeMemoryAddresses.length > 0) {
      targetMem = firstMemAccessStep.activeMemoryAddresses[0];
    } else {
      const editedAddrs = Object.keys(userMemoryEdits);
      if (editedAddrs.length > 0) {
        targetMem = parseInt(editedAddrs[0], 10);
      } else if (currentPreset.initialMemory?.[0]?.address !== undefined) {
        targetMem = currentPreset.initialMemory[0].address;
      }
    }
    setMemBaseAddress(targetMem & ~0x0F);

    // Release focus from Monaco editor so keyboard controls (Space, Arrows, R) immediately work
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.closest('.monaco-editor') || document.activeElement.tagName === 'TEXTAREA') {
        document.activeElement.blur();
      }
    }

    if (sim.success && sim.steps.length > 0) {
      toast.add({
        title: 'Simulation Ready',
        description: `${sim.steps.length} steps recorded (${sim.totalCycles} T-states). Press Space or Play to start.`,
        type: 'success',
      });
    } else {
      toast.add({
        title: 'Simulation Warning',
        description: sim.error || 'No instructions were executed. Check your code.',
        type: 'warning',
      });
    }
  }, [code, currentPreset.initialMemory, userMemoryEdits]);

  // Global keyboard shortcuts (F9 / Ctrl+Enter, Ctrl+S, Space, Arrows, R)
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      // 1. Run / Simulate: F9 or Ctrl+Enter / Cmd+Enter (always active everywhere, including inside editor)
      if (
        e.code === 'F9' ||
        e.key === 'F9' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'Enter'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRun();
        return;
      }

      // 2. Save file: Ctrl+S / Cmd+S (always active everywhere)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveFile();
        return;
      }

      // Check if user is typing text inside an input, textarea, or Monaco editor
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        Boolean(target?.closest?.('.monaco-editor')) ||
        (target?.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio'].includes((target as HTMLInputElement).type?.toLowerCase()));

      if (isTyping) {
        return;
      }

      // 4. Play / Pause Execution: Space
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      }
      // 5. Step Forward: ArrowRight
      else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      }
      // 6. Step Backward: ArrowLeft
      else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      }
      // 7. Reset Program: R
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', handle, true);
    return () => window.removeEventListener('keydown', handle, true);
  }, [handleRun, handleSaveFile, handleTogglePlay, handleNextStep, handlePrevStep, handleReset]);

  const handleSelectPreset = (id: string) => {
    const preset = PRESET_PROGRAMS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setCode(preset.code);
    setUserMemoryEdits({});
    setIsPlaying(false);

    // Update active file reference
    const presetPath = `/examples/${preset.id.replace(/-/g, '_')}.asm`;
    setCurrentFilePath(presetPath);
    setHasUnsavedChanges(false);
    try {
      localStorage.setItem('8085_current_file', presetPath);
    } catch {}

    const comp = WorkerClient.compile(preset.code);
    setCompileResult(comp);
    if (comp.success) {
      const sim = WorkerClient.simulate(comp, preset.initialMemory);
      setSimulationResult(sim);
      setCurrentStep(0);
      setMemBaseAddress(preset.initialMemory?.[0]?.address ?? 0x2050);
    } else {
      setSimulationResult(null);
      setCurrentStep(0);
      setMemBaseAddress(preset.initialMemory?.[0]?.address ?? 0x2050);
    }
    toast.add({ title: `Loaded "${preset.name}"`, description: preset.description, type: 'info' });
  };


  // Download Machine Code Hex Dump as .txt file (Replaced WASM download)
  const handleDownloadHex = useCallback(() => {
    if (!compileResult?.hexDump) {
      toast.add({
        title: 'No hex dump available',
        description: 'Please compile or run the program first to generate the hex dump.',
        type: 'warning',
      });
      return;
    }

    const blob = new Blob([compileResult.hexDump], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = currentPreset.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `8085_${sanitizedName}_hex.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.add({
      title: 'Downloaded Hex Dump',
      description: `Saved as 8085_${sanitizedName}_hex.txt`,
      type: 'success',
    });
  }, [compileResult, currentPreset.name]);

  // Handle direct modification of a memory byte by the user
  const handleMemoryByteChange = useCallback((address: number, newValue: number) => {
    const addr = address & 0xFFFF;
    const val = newValue & 0xFF;

    setUserMemoryEdits((prev) => ({
      ...prev,
      [addr]: val,
    }));

    setSimulationResult((prev) => {
      if (!prev) return null;
      const updatedMem = new Uint8Array(prev.memory);
      updatedMem[addr] = val;
      return {
        ...prev,
        memory: updatedMem,
      };
    });

    toast.add({
      title: 'Memory Modified',
      description: `Address 0x${addr.toString(16).toUpperCase().padStart(4, '0')}H updated to 0x${val.toString(16).toUpperCase().padStart(2, '0')}H (${val})`,
      type: 'info',
    });
  }, []);


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground select-none">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold flex items-center gap-1.5">
                8085 Studio
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">IDE</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Assemble · Simulate · Architecture</p>
            </div>
          </Link>
        </div>

        {/* File Explorer Toggle Button */}
        <button
          onClick={handleToggleExplorer}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isExplorerOpen
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'border-border bg-card hover:bg-accent text-muted-foreground'
          }`}
          title="Toggle File Explorer"
        >
          <FolderTree className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">Files</span>
        </button>

        {/* Preset Dropdown */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Program:</span>
          <div className="relative">
            <select
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="appearance-none rounded-md border border-border bg-card pl-3 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PRESET_PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="Landing Page"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            Home
          </Link>
          <Link
            href="/instructions"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="View Usage Instructions & ISA Reference"
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guide</span>
          </Link>
          <button
            onClick={handleCompile}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors active:scale-[0.97]"
          >
            <Hammer className="h-3.5 w-3.5" />
            Compile
          </button>
          <button
            onClick={handleRun}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors active:scale-[0.97]"
            title="Run / Simulate (F9 or Ctrl+Enter)"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Run
          </button>
          {compileResult?.hexDump && (
            <button
              onClick={handleDownloadHex}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              title="Download Hex Dump as a text file"
            >
              <Download className="h-3.5 w-3.5" />
              Hex (.txt)
            </button>
          )}
        </div>
      </header>

      {/* ─── Diagnostics strip ─── */}
      {compileResult && compileResult.diagnostics.length > 0 && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-destructive/50 scrollbar-track-transparent">
          <div className="flex items-center gap-4">
            {compileResult.diagnostics.slice(0, 5).map((d, i) => (
              <span key={i} className="whitespace-nowrap">
                <span className="font-semibold">Ln {d.line}:</span> {d.message}
              </span>
            ))}
            {compileResult.diagnostics.length > 5 && (
              <span className="text-destructive/70">+{compileResult.diagnostics.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Workspace (Resizable Split View) ─── */}
      <div ref={workspaceRef} className="flex-1 flex min-h-0 relative">
        {/* Leftmost: File Explorer (Collapsible & Resizable) */}
        {isExplorerOpen && (
          <>
            <div
              style={{ width: `${explorerWidth}px` }}
              className="shrink-0 h-full overflow-hidden flex flex-col"
            >
              <FileExplorer
                currentFilePath={currentFilePath}
                hasUnsavedChanges={hasUnsavedChanges}
                onSelectFile={handleSelectFile}
                onFileDeleted={handleFileDeleted}
                onFileRenamed={handleFileRenamed}
              />
            </div>
            {/* Explorer Resizer Handle */}
            <div
              onMouseDown={handleExplorerMouseDown}
              className="w-1.5 hover:w-2 bg-border hover:bg-cyan-500/70 cursor-col-resize transition-all shrink-0 select-none group flex items-center justify-center relative z-20"
              title="Drag to resize File Explorer"
            >
              <div className="h-10 w-0.5 bg-muted-foreground/40 group-hover:bg-cyan-200 rounded-full" />
            </div>
          </>
        )}

        {/* Left Panel: Code Editor + Hex Dump (Resizable Width) */}
        <div
          style={{ width: `${editorWidth}%` }}
          className="min-w-70 max-w-[80%] flex flex-col h-full overflow-hidden flex-1"
        >
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card text-xs text-muted-foreground shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleToggleExplorer}
                className={`p-1 rounded border transition-colors shrink-0 ${
                  isExplorerOpen
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-400'
                }`}
                title={isExplorerOpen ? 'Hide File Explorer' : 'Show File Explorer'}
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300 truncate">
                <span className="text-zinc-500 hidden sm:inline">
                  {currentFilePath ? splitPath(currentFilePath).parentPath + '/' : ''}
                </span>
                <span className="font-semibold text-foreground truncate">
                  {currentFilePath ? splitPath(currentFilePath).name : 'Unsaved File'}
                </span>
                {hasUnsavedChanges && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Unsaved changes" />
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveFile}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors shrink-0 ${
                  hasUnsavedChanges
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
                title="Save file (Ctrl+S)"
              >
                <Save className="w-3 h-3" />
                <span>{hasUnsavedChanges ? 'Save *' : 'Saved'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {compileResult && (
                <span className={compileResult.success ? 'text-green-500 font-semibold' : 'text-destructive font-semibold'}>
                  {compileResult.success
                    ? `✓ ${compileResult.machineCode.length}B`
                    : `✗ ${compileResult.diagnostics.filter((d) => d.severity === 'error').length} errors`}
                </span>
              )}
              {compileResult?.hexDump && (
                <span className="text-muted-foreground font-mono text-[11px] hidden md:inline">
                  ORG {compileResult.startAddress.toString(16).toUpperCase()}H
                </span>
              )}
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-0">
            <Monaco8085Editor
              value={code}
              onChange={handleCodeChange}
              diagnostics={compileResult?.diagnostics ?? []}
              activeLine={activeLine}
              onRun={handleRun}
              onSave={handleSaveFile}
            />
          </div>

          {/* Vertical Resizer Handle between Editor and Hex Dump */}
          {compileResult?.hexDump && (
            <div
              onMouseDown={handleVertMouseDown}
              className="h-1.5 hover:h-2 bg-border hover:bg-cyan-500/70 cursor-row-resize transition-all shrink-0 select-none group flex items-center justify-center relative z-10"
              title="Drag up/down to resize Hex Dump"
            >
              <div className="w-10 h-0.5 bg-muted-foreground/40 group-hover:bg-cyan-200 rounded-full" />
            </div>
          )}

          {/* Hex Dump Panel (Resizable Height) */}
          {compileResult?.hexDump && (
            <div
              style={{ height: `${hexHeight}px` }}
              className="border-t border-border bg-card shrink-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950/60 flex flex-col"
            >
              <div className="flex items-center justify-between px-3 py-1 bg-zinc-950/60 border-b border-border text-[11px] font-mono text-zinc-400">
                <span className="font-semibold text-zinc-300">Generated Hex Dump</span>
                <span className="text-zinc-500 text-[10px]">Drag bar above to resize</span>
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono text-muted-foreground leading-relaxed select-text flex-1">
                {compileResult.hexDump}
              </pre>
            </div>
          )}
        </div>

        {/* Horizontal Resizer Handle between Left and Right Panels */}
        <div
          onMouseDown={handleHorizMouseDown}
          className="w-1.5 hover:w-2 bg-border hover:bg-cyan-500/70 cursor-col-resize transition-all shrink-0 select-none group flex items-center justify-center relative z-20"
          title="Drag left/right to resize Editor & Visualizer"
        >
          <div className="h-10 w-0.5 bg-muted-foreground/40 group-hover:bg-cyan-200 rounded-full" />
        </div>

        {/* Right Panel: Visualization & Playback Controls */}
        <div
          style={{ width: `${100 - editorWidth}%` }}
          className="min-w-[320px] flex flex-col h-full overflow-hidden"
        >
          {/* Playback Control Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0">
            <button
              onClick={handleReset}
              disabled={totalSteps === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              title="Reset Program (R)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handlePrevStep}
              disabled={totalSteps === 0 || currentStep === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              title="Previous Step (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleTogglePlay}
              disabled={totalSteps === 0}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button
              onClick={handleNextStep}
              disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              title="Next Step (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(Math.max(0, totalSteps - 1));
              }}
              disabled={totalSteps === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              title="Jump to End"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>

            {/* Step Progress Slider */}
            <input
              type="range"
              min={0}
              max={Math.max(0, totalSteps - 1)}
              value={currentStep}
              disabled={totalSteps === 0}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStep(parseInt(e.target.value, 10));
              }}
              className="flex-1 h-1.5 accent-primary bg-muted rounded-full cursor-pointer disabled:opacity-40 mx-1"
            />

            {/* Step Counter Display */}
            <span className="text-xs font-mono text-muted-foreground min-w-18 text-right tabular-nums">
              {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : '— / —'}
            </span>

            {/* Speed Multiplier Pill Buttons */}
            <div className="flex items-center border border-border rounded-md overflow-hidden ml-1">
              {[0.25,0.5, 1,1.5, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[11px] font-mono transition-colors ${
                    speed === s
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* CPU & Memory Architecture Visualizer */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950/60 hover:scrollbar-thumb-zinc-500 p-3">
            {simulationResult ? (
              <CpuVisualizer
                steps={steps}
                memory={simulationResult.memory}
                currentStep={currentStep}
                memBaseAddress={memBaseAddress}
                onMemBaseChange={setMemBaseAddress}
                onMemoryByteChange={handleMemoryByteChange}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <Cpu className="h-16 w-16 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">No simulation loaded</p>
                  <p className="text-xs mt-1">
                    Write or select a program, then click <strong>Compile</strong> → <strong>Run</strong> to see the CPU in action.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function SimulatorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight text-foreground">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <span className="bg-linear-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              8085 Microprocessor Simulator
            </span>
          </div>
          <span className="rounded bg-cyan-950/80 px-2 py-0.5 font-mono text-[10px] text-cyan-400 font-semibold border border-cyan-800/50 hidden sm:inline">
            v2.0 Turbo
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="Landing Page"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            Home
          </Link>
          <Link
            href="/instructions"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="View Usage Instructions & ISA Reference"
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guide</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground/60">
            <Hammer className="h-3.5 w-3.5" />
            Compile
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/70 text-white px-3.5 py-1.5 text-xs font-semibold">
            <Play className="h-3.5 w-3.5 fill-current" />
            Run
          </div>
        </div>
      </header>

      {/* Main Workspace Skeleton */}
      <div className="flex-1 flex min-h-0 relative bg-zinc-950">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400">Initializing 8085 Environment...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const isMounted = useIsMounted();

  if (!isMounted) {
    return <SimulatorSkeleton />;
  }

  return <SimulatorApp />;
}
