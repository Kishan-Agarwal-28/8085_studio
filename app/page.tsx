'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Play,
  BookOpen,
  ArrowRight,
  Zap,
  Code2,
  Terminal,
  Database,
  Sparkles,
  FolderTree,
  ExternalLink,
  ChevronRight,
  Activity,
  Award,
  Sliders,
} from 'lucide-react';
import { PRESET_PROGRAMS } from '@/lib/8085/presets';

export default function LandingPage() {
  const [activeCodeTab, setActiveCodeTab] = useState<'sample' | 'ghost'>('sample');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {/* ─── Top Navbar ─── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-sm shadow-emerald-500/10">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-zinc-100">8085 Studio</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">v1.0</span>
              </div>
              <p className="text-[11px] text-zinc-400">Next-Gen 8085 Microprocessor IDE</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
            <a href="#benchmarks" className="hover:text-zinc-100 transition-colors">Silicon Benchmarks</a>
            <a href="#presets" className="hover:text-zinc-100 transition-colors">Presets</a>
            <Link href="/instructions" className="hover:text-zinc-100 transition-colors">Manual & ISA</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/instructions"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md hover:bg-zinc-900 transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2 text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Launch Simulator
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-zinc-900 bg-linear-to-b from-zinc-900/30 via-zinc-950 to-zinc-950">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Copy & Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="h-3.5 w-3.5" />
                Cycle-Accurate Microprocessor Simulation & Bus Visualizer
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-100 leading-tight">
                Master the Intel 8085 in Real Silicon Fidelity
              </h1>

              <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
                An advanced two-pass assembler, cycle-accurate virtual CPU, and live data-bus visualizer designed for students, computer scientists, and retro-computing purists. Complete with all 10 undocumented ghost opcodes and authentic ALU physics.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/simulator"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-3.5 text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Launch Free Simulator
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
                <Link
                  href="/instructions"
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold px-5 py-3.5 text-sm transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                  Usage Guide & ISA Reference
                </Link>
              </div>

              {/* Key Metrics / Badges */}
              <div className="grid grid-cols-3 gap-4 pt-6 max-w-lg mx-auto lg:mx-0 border-t border-zinc-900">
                <div>
                  <div className="text-xl font-bold font-mono text-emerald-400">246 + 10</div>
                  <div className="text-[11px] text-zinc-500">Standard + Ghost Opcodes</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-cyan-400">100%</div>
                  <div className="text-[11px] text-zinc-500">Silicon Anomaly Fidelity</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-amber-400">64 KB</div>
                  <div className="text-[11px] text-zinc-500">Full Linear Address Space</div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Architectural Visualizer Preview */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl p-5 space-y-4 relative overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono text-zinc-400 ml-2">8085-cpu-core</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    <Activity className="h-3 w-3 animate-pulse" />
                    CYCLE: 48 T-STATES
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setActiveCodeTab('sample')}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono transition-colors ${
                      activeCodeTab === 'sample'
                        ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    bubble_sort.asm
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('ghost')}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono transition-colors ${
                      activeCodeTab === 'ghost'
                        ? 'bg-zinc-800 text-purple-400 border border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    undocumented_ghost.asm
                  </button>
                </div>

                {/* Code Window */}
                <pre className="p-3.5 rounded-lg bg-zinc-950/90 font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-850 h-36 leading-relaxed">
                  {activeCodeTab === 'sample' ? (
                    <>
                      <span className="text-zinc-500">; Two-Pointer Array Traversal</span>{'\n'}
                      <span className="text-emerald-400">LXI H, 2050H</span>  <span className="text-zinc-500">; Pointer L [HL]</span>{'\n'}
                      <span className="text-cyan-400">LXI D, 2051H</span>  <span className="text-zinc-500">; Pointer R [DE]</span>{'\n'}
                      <span className="text-amber-400">MOV A, M</span>      <span className="text-zinc-500">; Load left element</span>{'\n'}
                      <span className="text-purple-400">LDAX D</span>        <span className="text-zinc-500">; Load right element</span>{'\n'}
                      <span className="text-emerald-400">CMP M</span>         <span className="text-zinc-500">; Compare values</span>
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-500">; Undocumented 8085 Ghost Opcodes</span>{'\n'}
                      <span className="text-emerald-400">LXI H, 1000H</span>{'\n'}
                      <span className="text-cyan-400">LXI B, 0001H</span>{'\n'}
                      <span className="text-purple-400 font-bold">DSUB</span>          <span className="text-zinc-500">; HL = HL - BC (0x08)</span>{'\n'}
                      <span className="text-purple-400 font-bold">ARHL</span>          <span className="text-zinc-500">; Shift HL right arith (0x10)</span>{'\n'}
                      <span className="text-purple-400 font-bold">SHLX</span>          <span className="text-zinc-500">; Store HL at [DE] (0xD9)</span>
                    </>
                  )}
                </pre>

                {/* Registers Matrix Preview */}
                <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs">
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">A (ACC)</span>
                    <span className="text-emerald-400 font-bold">0x42</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">B-C</span>
                    <span className="text-cyan-400 font-bold">0x0001</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">H-L</span>
                    <span className="text-amber-400 font-bold">0x0FFF</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">SP</span>
                    <span className="text-zinc-300 font-bold">0x20FF</span>
                  </div>
                </div>

                {/* Flags Preview */}
                <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono">
                  <span className="text-zinc-500">PSW FLAGS:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">S:0</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">Z:1</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">AC:1</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">P:1</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">CY:0</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 font-bold">V:0</span>
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    href="/simulator"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 text-xs transition-colors"
                  >
                    Open Live Interactive Studio
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Silicon Benchmarks & Scorecard ─── */}
      <section id="benchmarks" className="py-16 border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Award className="h-3.5 w-3.5" />
              Verified Silicon Test Suites
            </div>
            <h2 className="text-3xl font-extrabold text-zinc-100">
              Tested Beyond Standard Calculators
            </h2>
            <p className="text-sm text-zinc-400">
              Most 8085 simulators calculate like high-level language interpreters. 8085 Studio replicates the physical logic gates of the Intel die, passing all industry torture test suites.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-center">
              <div className="text-2xl font-black font-mono text-emerald-400">0xFF</div>
              <h3 className="font-semibold text-xs text-zinc-200">Suites 1–3: Torture Test</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Rotates & carry, DAA decimal adjust, parity, signed flag transitions.
              </p>
              <div className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/40 py-0.5 rounded">PASSED</div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-center">
              <div className="text-2xl font-black font-mono text-cyan-400">0xCC</div>
              <h3 className="font-semibold text-xs text-zinc-200">Suite 4: Quirks & SMC</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Self-modifying code, PSW hijacking, and RST 1 vector jumps.
              </p>
              <div className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 py-0.5 rounded">PASSED</div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-center">
              <div className="text-2xl font-black font-mono text-blue-400">0x99</div>
              <h3 className="font-semibold text-xs text-zinc-200">Suite 5: Final Boss</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                EI, DI, IE flip-flop latching, SIM serial output, and RIM read mask.
              </p>
              <div className="text-[10px] font-mono text-blue-400/80 bg-blue-950/40 py-0.5 rounded">PASSED</div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-center">
              <div className="text-2xl font-black font-mono text-amber-400">0x77</div>
              <h3 className="font-semibold text-xs text-zinc-200">Suite 6: Silicon Anomalies</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                2&apos;s complement SUB A (AC=1), ANA bit-3 OR quirk, and DCR carry-out.
              </p>
              <div className="text-[10px] font-mono text-amber-400/80 bg-amber-950/40 py-0.5 rounded">PASSED</div>
            </div>

            <div className="border border-purple-800/40 bg-purple-950/10 rounded-xl p-4 space-y-2 text-center">
              <div className="text-2xl font-black font-mono text-purple-400">0x88</div>
              <h3 className="font-semibold text-xs text-purple-200">Suite 7: Ghost Opcodes</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                God Tier: 16-bit DSUB, ARHL shift, RDEL rotate, and SHLX/LHLX.
              </p>
              <div className="text-[10px] font-mono text-purple-400 bg-purple-900/40 py-0.5 rounded">GOD TIER</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Core Features Section ─── */}
      <section id="features" className="py-20 border-b border-zinc-900 bg-linear-to-b from-zinc-950 via-zinc-900/20 to-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="h-3.5 w-3.5" />
              Engineered for Deep Learning
            </div>
            <h2 className="text-3xl font-extrabold text-zinc-100">
              Everything Needed to Master Assembly
            </h2>
            <p className="text-sm text-zinc-400">
              From two-pass assembler diagnostics to animated silicon bus logic, every component was designed for clarity and speed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">Two-Pass Intelligent Assembler</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Full support for labels, symbol arithmetic, and tolerant notations (<code className="text-zinc-300">MOV A, [HL]</code>, <code className="text-zinc-300">MOV [2050H], A</code>). Instant line-by-line syntax error diagnostics and machine code generator.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">Animated Bus & Data Flow</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Watch data traverse the internal bus in real-time. Highlights source and destination registers, memory address lines, stack pointers, and ALU operations with animated particles.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">All 10 Ghost Opcodes</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Replicate undocumented 8085 silicon opcodes including <code className="text-purple-300">DSUB</code> (16-bit subtract), <code className="text-purple-300">ARHL</code>, <code className="text-purple-300">RDEL</code>, <code className="text-purple-300">SHLX</code>, <code className="text-purple-300">LHLX</code>, and <code className="text-purple-300">RSTV</code>.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FolderTree className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">Virtual File System & Auto-Save</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Organize projects with nested folders and files in local storage. Automatic 10-second debounced auto-save prevents lost work during intense coding sessions.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">64KB Linear Hex Inspector</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Explore the entire address space (0000H - FFFFH). Click any byte to modify memory directly. Live step memory deltas highlight writes and stack modifications in distinct colors.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Sliders className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-zinc-100">Two-Pointer Algorithm Visualizer</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Automatically detects Left (<code className="text-amber-300">HL</code>) and Right (<code className="text-cyan-300">DE</code>) pointers as your code operates on arrays, helping visualize sorting, searching, and comparisons.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Algorithm Presets Showcase ─── */}
      <section id="presets" className="py-20 border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="h-3.5 w-3.5" />
              Built-In Program Presets
            </div>
            <h2 className="text-3xl font-extrabold text-zinc-100">
              Pre-loaded with Real-World Algorithms
            </h2>
            <p className="text-sm text-zinc-400">
              Jump straight into running classic microcode programs with pre-configured memory arrays and data pointers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRESET_PROGRAMS.map((preset) => (
              <div
                key={preset.id}
                className="bg-zinc-900/50 border border-zinc-800 hover:border-emerald-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {preset.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      8085 ASM
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-500">
                    RAM @ {preset.initialMemory?.[0]?.address.toString(16).toUpperCase().padStart(4, '0')}H
                  </span>
                  <Link
                    href="/simulator"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Simulate
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA Banner ─── */}
      <section className="py-20 bg-linear-to-b from-zinc-950 to-zinc-900/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 tracking-tight">
            Start Simulating 8085 Microcode Today
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            No installations, no emulators to build. 8085 Studio runs entirely in your browser with high performance WebAssembly speeds, offline support, and complete documentation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-7 py-4 text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="h-4 w-4 fill-current" />
              Launch 8085 Simulator
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
            <Link
              href="/instructions"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold px-6 py-4 text-sm transition-colors"
            >
              <BookOpen className="h-4 w-4 text-cyan-400" />
              Read Usage Manual
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950 py-10 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-zinc-300">8085 Studio</span>
            <span>— Cycle-accurate Intel 8085 Microprocessor Environment</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/simulator" className="hover:text-zinc-300 transition-colors">Simulator</Link>
            <Link href="/instructions" className="hover:text-zinc-300 transition-colors">Usage Instructions</Link>
            <Link href="/instructions#isa" className="hover:text-zinc-300 transition-colors">Opcode Table</Link>
            <Link href="/instructions#silicon-quirks" className="hover:text-zinc-300 transition-colors">Silicon Quirks</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
