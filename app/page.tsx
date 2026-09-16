'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
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
} from 'lucide-react';

const Monaco8085Editor = dynamic(
  () => import('@/components/Monaco8085Editor').then((m) => m.Monaco8085Editor),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950 animate-pulse rounded-lg" /> }
);

const CpuVisualizer = dynamic(
  () => import('@/components/CpuVisualizer').then((m) => m.CpuVisualizer),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950 animate-pulse rounded-lg" /> }
);

export default function Home() {
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_PROGRAMS[0].id);
  const [code, setCode] = useState(PRESET_PROGRAMS[0].code);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [memBaseAddress, setMemBaseAddress] = useState(0x2050);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPreset = useMemo<PresetProgram>(
    () => PRESET_PROGRAMS.find((p) => p.id === selectedPresetId) || PRESET_PROGRAMS[0],
    [selectedPresetId]
  );

  // Register service worker on mount
  useEffect(() => {
    WorkerClient.registerServiceWorker();
  }, []);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); handleTogglePlay(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); handleNextStep(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); handlePrevStep(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });

  const handleSelectPreset = (id: string) => {
    const preset = PRESET_PROGRAMS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setCode(preset.code);
    setCompileResult(null);
    setSimulationResult(null);
    setCurrentStep(0);
    setIsPlaying(false);
    setMemBaseAddress(preset.initialMemory?.[0]?.address ?? 0x2050);
    toast.add({ title: `Loaded "${preset.name}"`, description: preset.description, type: 'info' });
  };

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
        description: `${result.machineCode.length} bytes generated. ${result.wasmBinary ? `WASM module: ${result.wasmBinary.length} bytes.` : ''} Click "Run" to simulate.`,
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
    // Compile first
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

    const sim = WorkerClient.simulate(comp, currentPreset.initialMemory);
    setSimulationResult(sim);
    setCurrentStep(0);
    setMemBaseAddress(currentPreset.initialMemory?.[0]?.address ?? 0x2050);

    if (sim.success && sim.steps.length > 0) {
      toast.add({
        title: 'Simulation Ready',
        description: `${sim.steps.length} steps recorded (${sim.totalCycles} T-states). Use playback controls or press Space to auto-play.`,
        type: 'success',
      });
    } else {
      toast.add({
        title: 'Simulation Warning',
        description: sim.error || 'No instructions were executed. Check your code.',
        type: 'warning',
      });
    }
  }, [code, currentPreset.initialMemory]);

  const handleDownloadWasm = useCallback(() => {
    if (!compileResult?.wasmBinary) return;
    const bytes = new Uint8Array(compileResult.wasmBinary);
    const blob = new Blob([bytes], { type: 'application/wasm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'program.wasm'; a.click();
    URL.revokeObjectURL(url);
    toast.add({ title: 'Downloaded program.wasm', type: 'success' });
  }, [compileResult]);

  // Playback helpers
  const steps = simulationResult?.steps ?? [];
  const totalSteps = steps.length;
  const activeStep: TraceStep | undefined = totalSteps > 0 && currentStep < totalSteps ? steps[currentStep] : undefined;
  const activeLine = activeStep?.line;

  const handleTogglePlay = () => {
    if (totalSteps === 0) return;
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  };
  const handleNextStep = () => { setIsPlaying(false); setCurrentStep((s) => Math.min(s + 1, totalSteps - 1)); };
  const handlePrevStep = () => { setIsPlaying(false); setCurrentStep((s) => Math.max(s - 1, 0)); };
  const handleReset = () => { setIsPlaying(false); setCurrentStep(0); };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">8085 Simulator</h1>
            <p className="text-[11px] text-muted-foreground">Assemble · WASM Compile · Visualize</p>
          </div>
        </div>

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
          <button
            onClick={handleCompile}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors active:scale-[0.97]"
          >
            <Hammer className="h-3.5 w-3.5" />
            Compile
          </button>
          <button
            onClick={handleRun}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors active:scale-[0.97]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Run
          </button>
          {compileResult?.wasmBinary && (
            <button
              onClick={handleDownloadWasm}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              title="Download .wasm binary"
            >
              <Download className="h-3.5 w-3.5" />
              .wasm
            </button>
          )}
        </div>
      </header>

      {/* ─── Diagnostics strip ─── */}
      {compileResult && compileResult.diagnostics.length > 0 && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive shrink-0 overflow-x-auto">
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

      {/* ─── Main workspace ─── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Code Editor */}
        <div className="w-[45%] min-w-[300px] flex flex-col border-r border-border">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card text-xs text-muted-foreground shrink-0">
            <span className="font-medium text-foreground">Assembly Editor</span>
            <div className="flex items-center gap-3">
              {compileResult && (
                <span className={compileResult.success ? 'text-green-500' : 'text-destructive'}>
                  {compileResult.success
                    ? `✓ ${compileResult.machineCode.length}B`
                    : `✗ ${compileResult.diagnostics.filter((d) => d.severity === 'error').length} errors`}
                </span>
              )}
              {compileResult?.hexDump && (
                <span className="text-muted-foreground font-mono">
                  ORG {compileResult.startAddress.toString(16).toUpperCase()}H
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Monaco8085Editor
              value={code}
              onChange={setCode}
              diagnostics={compileResult?.diagnostics ?? []}
              activeLine={activeLine}
            />
          </div>
          {/* Hex dump panel */}
          {compileResult?.hexDump && (
            <div className="border-t border-border bg-card shrink-0 max-h-32 overflow-y-auto">
              <pre className="px-3 py-2 text-[11px] font-mono text-muted-foreground leading-relaxed select-text">
                {compileResult.hexDump}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Visualization */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Playback bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0">
            <button onClick={handleReset} disabled={totalSteps === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors" title="Reset (R)">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button onClick={handlePrevStep} disabled={totalSteps === 0 || currentStep === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors" title="Previous (←)">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={handleTogglePlay} disabled={totalSteps === 0}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors" title="Play/Pause (Space)">
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={handleNextStep} disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors" title="Next (→)">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => { setIsPlaying(false); setCurrentStep(Math.max(0, totalSteps - 1)); }} disabled={totalSteps === 0}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-40 transition-colors" title="Jump to End">
              <ChevronsRight className="h-4 w-4" />
            </button>

            {/* Slider */}
            <input
              type="range" min={0} max={Math.max(0, totalSteps - 1)} value={currentStep}
              disabled={totalSteps === 0}
              onChange={(e) => { setIsPlaying(false); setCurrentStep(parseInt(e.target.value)); }}
              className="flex-1 h-1.5 accent-primary bg-muted rounded-full cursor-pointer disabled:opacity-40 mx-1"
            />

            {/* Step counter */}
            <span className="text-xs font-mono text-muted-foreground min-w-[4.5rem] text-right tabular-nums">
              {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : '— / —'}
            </span>

            {/* Speed */}
            <div className="flex items-center border border-border rounded-md overflow-hidden ml-1">
              {[0.5, 1, 2, 4].map((s) => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[11px] font-mono transition-colors ${speed === s ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent text-muted-foreground'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* CPU Visualizer */}
          <div className="flex-1 overflow-y-auto p-3">
            {simulationResult ? (
              <CpuVisualizer
                steps={steps}
                memory={simulationResult.memory}
                currentStep={currentStep}
                memBaseAddress={memBaseAddress}
                onMemBaseChange={setMemBaseAddress}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <Cpu className="h-16 w-16 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">No simulation loaded</p>
                  <p className="text-xs mt-1">Write or select a program, then click <strong>Compile</strong> → <strong>Run</strong> to see the CPU in action.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
