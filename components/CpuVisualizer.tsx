'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Cpu,
  MemoryStick,
  Binary,
  Zap,
  ChevronLeft,
  ChevronRight,
  Scale,
  Activity,
  Layers,
  Edit3,
  CornerDownLeft,
} from 'lucide-react';
import type { TraceStep } from '@/lib/8085/types';

interface CpuVisualizerProps {
  steps: TraceStep[];
  memory: Uint8Array;
  currentStep: number;
  memBaseAddress: number;
  onMemBaseChange: (a: number) => void;
  onMemoryByteChange?: (address: number, newValue: number) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const toHex = (val: number, pad = 2) => (val ?? 0).toString(16).toUpperCase().padStart(pad, '0');

interface RegisterBoxProps {
  name: string;
  subLabel?: string;
  value: number;
  is16Bit?: boolean;
  className?: string;
  isTemp?: boolean;
  isActive?: boolean;
  activeRegisters?: string[];
}

const RegisterBox: React.FC<RegisterBoxProps> = ({
  name,
  subLabel,
  value,
  is16Bit = false,
  className = '',
  isTemp = false,
  isActive: propIsActive,
  activeRegisters = [],
}) => {
  const regKey = name.split(' ')[0];
  const isActive = propIsActive ?? activeRegisters.includes(regKey);
  return (
    <motion.div
    layout
    className={`flex flex-col justify-between p-2.5 rounded-lg border border-zinc-800 transition-shadow ${
      isTemp ? 'bg-zinc-900/60 border-dashed border-zinc-700/80' : 'bg-zinc-900/90'
    } ${isActive ? 'shadow-md shadow-amber-500/20' : ''} ${className}`}
    initial={false}
    animate={{
      scale: isActive ? 1.05 : 1,
      y: isActive ? -4 : 0,
      backgroundColor: isActive ? '#f59e0b' : isTemp ? '#1c1917' : '#27272a',
      color: isActive ? '#09090b' : '#fafafa',
      borderColor: isActive ? '#f59e0b' : '#3f3f46',
    }}
    transition={springTransition}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold tracking-tight">{name}</span>
      {subLabel && (
        <span
          className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded ${
            isActive ? 'bg-zinc-950/20 text-zinc-900 font-semibold' : 'text-zinc-500 bg-zinc-950'
          }`}
        >
          {subLabel}
        </span>
      )}
    </div>
    <div className="flex items-baseline justify-between mt-1.5">
      <span className="font-mono text-base font-black">
        {toHex(value, is16Bit ? 4 : 2)}H
      </span>
      <span className={`font-mono text-[10px] ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
        {value}
      </span>
    </div>
  </motion.div>
  );
};

interface FlagToggleProps {
  name: string;
  value: boolean;
  desc: string;
}

const FlagToggle: React.FC<FlagToggleProps> = ({ name, value, desc }) => (
  <div className="flex flex-col items-center justify-center gap-1" title={desc}>
    <span className="text-[10px] text-zinc-400 font-bold">{name}</span>
    <motion.div
      layout
      className="w-7 h-7 rounded-md border flex items-center justify-center text-xs font-mono font-bold shadow-sm"
      animate={{
        backgroundColor: value ? '#10b981' : '#27272a',
        color: value ? '#ffffff' : '#71717a',
        borderColor: value ? '#059669' : '#3f3f46',
        scale: value ? 1.08 : 1,
      }}
      transition={springTransition}
    >
      {value ? '1' : '0'}
    </motion.div>
  </div>
);

export const CpuVisualizer: React.FC<CpuVisualizerProps> = ({
  steps,
  memory,
  currentStep,
  memBaseAddress,
  onMemBaseChange,
  onMemoryByteChange,
}) => {
  // Direct Memory Jump State
  const [jumpInput, setJumpInput] = useState(toHex(memBaseAddress, 4));
  const [prevMemBaseAddress, setPrevMemBaseAddress] = useState(memBaseAddress);
  if (memBaseAddress !== prevMemBaseAddress) {
    setPrevMemBaseAddress(memBaseAddress);
    setJumpInput(toHex(memBaseAddress, 4));
  }

  // Memory Cell Editing State
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [cellInputVal, setCellInputVal] = useState<string>('');

  // Auto-follow active memory address during step/playback if outside visible range
  const currentStepData = steps[currentStep];
  useEffect(() => {
    if (currentStepData?.activeMemoryAddresses && currentStepData.activeMemoryAddresses.length > 0) {
      const target = currentStepData.activeMemoryAddresses[0];
      if (target < memBaseAddress || target >= memBaseAddress + 16) {
        onMemBaseChange(target & ~0x0F);
      }
    }
  }, [currentStep, currentStepData, memBaseAddress, onMemBaseChange]);

  const handleApplyJump = () => {
    const cleaned = jumpInput.trim().replace(/^0x/i, '').replace(/h$/i, '');
    const parsed = parseInt(cleaned, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFF) {
      onMemBaseChange(parsed);
    } else {
      setJumpInput(toHex(memBaseAddress, 4));
    }
  };

  const handleStartCellEdit = (addr: number, currentVal: number) => {
    setEditingAddr(addr);
    setCellInputVal(toHex(currentVal, 2));
  };

  const handleSaveCellEdit = (addr: number) => {
    if (editingAddr === null) return;
    const cleaned = cellInputVal.trim().replace(/^0x/i, '').replace(/h$/i, '');
    const parsed = parseInt(cleaned, 16);
    if (!isNaN(parsed) && parsed >= 0) {
      const byteVal = parsed & 0xFF;
      onMemoryByteChange?.(addr, byteVal);
    }
    setEditingAddr(null);
  };
  const step = steps[currentStep] || steps[steps.length - 1];

  if (!step) {
    return (
      <div className="p-6 bg-zinc-950 text-zinc-400 rounded-xl border border-zinc-800 text-center">
        No execution data available. Click &quot;Run&quot; to begin simulation.
      </div>
    );
  }

  const {
    instruction,
    bytes,
    description,
    registers,
    flags,
    activeRegisters,
    activeMemoryAddresses,
    dataTransfer,
    aluOperation,
    pointerL,
    pointerR,
  } = step;

  // Determine Instruction Category
  let category = 'Control';
  let badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const mnemonic = instruction.split(' ')[0].toUpperCase();
  if (['MOV', 'MVI', 'LXI', 'LDA', 'STA', 'LHLD', 'SHLD', 'LDAX', 'STAX', 'XCHG'].includes(mnemonic)) {
    category = 'Data Transfer';
    badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  } else if (['ADD', 'ADC', 'ADI', 'ACI', 'SUB', 'SBB', 'SUI', 'SBI', 'INR', 'INX', 'DCR', 'DCX', 'DAD', 'DAA'].includes(mnemonic)) {
    category = 'Arithmetic';
    badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (['ANA', 'ANI', 'ORA', 'ORI', 'XRA', 'XRI', 'CMP', 'CPI', 'RLC', 'RRC', 'RAL', 'RAR', 'CMA', 'CMC', 'STC'].includes(mnemonic)) {
    category = 'Logical & Compare';
    badgeColor = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  } else if (['JMP', 'JC', 'JNC', 'JZ', 'JNZ', 'JP', 'JM', 'JPE', 'JPO', 'CALL', 'CC', 'CNC', 'CZ', 'CNZ', 'CP', 'CM', 'CPE', 'CPO', 'RET', 'RC', 'RNC', 'RZ', 'RNZ', 'RP', 'RM', 'RPE', 'RPO', 'PCHL', 'RST'].includes(mnemonic)) {
    category = 'Branch / Flow';
    badgeColor = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  } else if (['PUSH', 'POP', 'XTHL', 'SPHL'].includes(mnemonic)) {
    category = 'Stack';
    badgeColor = 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  }


  return (
    <div className="w-full bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800/80 overflow-hidden flex flex-col shadow-2xl space-y-4 p-4">
      {/* ─── 1. TOP: Instruction Header ─── */}
      <div className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h2 className="text-2xl font-bold font-mono text-amber-400 tracking-wider">
              {instruction || 'NOP'}
            </h2>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${badgeColor}`}>
              {category}
            </span>
          </div>
          <p className="text-zinc-300 text-xs sm:text-sm flex items-center gap-2 leading-relaxed">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            {description}
          </p>
        </div>

        {/* Instruction Machine Bytes */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-[10px] font-mono text-zinc-500 uppercase mr-1">Bytes:</span>
          {bytes.map((b, i) => (
            <div
              key={i}
              className="px-2.5 py-1 bg-zinc-900 rounded border border-zinc-700 font-mono text-xs font-bold text-amber-300 shadow-inner"
            >
              {toHex(b)}H
            </div>
          ))}
        </div>
      </div>

      {/* ─── 2. MIDDLE: Interactive CPU Subsystem ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ─── Left Box: ALU & Logic Operations Center (5 cols) ─── */}
        <div className="lg:col-span-5 flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                ALU &amp; Logic Operations
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Accumulator + TEMP</span>
          </div>

          {/* Accumulator (A) and Temporary (TEMP) Register Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Accumulator Card */}
            <RegisterBox
              name="A (Accumulator)"
              subLabel="ALU In 1"
              value={registers.A}
              activeRegisters={activeRegisters}
              className="border-cyan-500/30"
            />
            {/* Temporary Register (TEMP) Card */}
            <RegisterBox
              name="TEMP Register"
              subLabel="ALU In 2"
              value={registers.TEMP}
              activeRegisters={activeRegisters}
              isTemp
              className="border-amber-500/30"
            />
          </div>

          {/* Dedicated ALU Processing Unit Visualizer */}
          <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
                  {aluOperation ? aluOperation.name : 'Arithmetic Logic Unit (ALU)'}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  aluOperation
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {aluOperation ? 'CALCULATING' : 'IDLE'}
              </span>
            </div>

            {/* ALU Live Formula & Outcome Display */}
            {aluOperation ? (
              <div className="flex flex-col gap-1.5 mt-1 bg-zinc-950/80 p-2.5 rounded border border-zinc-800">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-zinc-400">
                    A (0x{toHex(aluOperation.operandA)}) {aluOperation.operatorSymbol} TEMP (0x{toHex(aluOperation.operandB)})
                  </span>
                  <span className="font-bold text-amber-400">
                    Result: 0x{toHex(aluOperation.result)}H
                  </span>
                </div>

                {aluOperation.comparisonResult && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold text-zinc-400">Comparison:</span>
                    <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                      {aluOperation.comparisonResult}
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-zinc-300 leading-snug mt-1 italic">
                  {aluOperation.explanation}
                </p>
              </div>
            ) : (
              <div className="text-[11px] text-zinc-500 italic p-2 text-center">
                Waiting for arithmetic / logical instruction (ADD, SUB, CMP, ANA, etc.)
              </div>
            )}
          </div>

          {/* Status Flags (PSW: S, Z, AC, P, CY) connected to ALU */}
          <div className="p-3 bg-zinc-950/70 rounded-lg border border-zinc-800/80 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Status Flags (Flag Register - PSW)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                CY={flags.cy ? '1' : '0'} Z={flags.z ? '1' : '0'} S={flags.s ? '1' : '0'}
              </span>
            </div>
            <div className="flex items-center justify-between px-1">
              <FlagToggle name="S" value={flags.s} desc="Sign Flag: bit 7 of result is 1" />
              <FlagToggle name="Z" value={flags.z} desc="Zero Flag: result equals 0" />
              <FlagToggle name="AC" value={flags.ac} desc="Auxiliary Carry: carry from bit 3 to 4" />
              <FlagToggle name="P" value={flags.p} desc="Parity Flag: even number of 1-bits" />
              <FlagToggle name="CY" value={flags.cy} desc="Carry Flag: arithmetic carry or borrow" />
            </div>
          </div>
        </div>

        {/* ─── Right Box: Registers & Internal Bus (7 cols) ─── */}
        <div className="lg:col-span-7 flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Register Array &amp; Internal Bus
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">8085 Working Registers</span>
          </div>

          {/* 1. Internal Temporary Registers (W - Z) */}
          <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                Temporary Register Pair (W - Z)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                16-bit W-Z: 0x{toHex(registers.W, 2)}{toHex(registers.Z, 2)}H
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <RegisterBox
                name="W"
                subLabel="Temp High Byte"
                value={registers.W}
                activeRegisters={activeRegisters}
                isTemp
              />
              <RegisterBox
                name="Z"
                subLabel="Temp Low Byte"
                value={registers.Z}
                activeRegisters={activeRegisters}
                isTemp
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Internal CPU registers used to hold 16-bit address offsets and intermediate operands.
            </p>
          </div>

          {/* 2. General Purpose Register Pairs (BC, DE, HL) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* B-C Pair */}
            <div className="flex flex-col gap-1.5 p-2 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-bold text-zinc-300">B-C Pair</span>
                <span>0x{toHex(registers.B, 2)}{toHex(registers.C, 2)}H</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <RegisterBox name="B" value={registers.B} activeRegisters={activeRegisters} />
                <RegisterBox name="C" value={registers.C} activeRegisters={activeRegisters} />
              </div>
            </div>

            {/* D-E Pair (R Pointer) */}
            <div className="flex flex-col gap-1.5 p-2 bg-zinc-950/60 rounded-lg border border-purple-500/30">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-bold text-purple-300">D-E (R Pointer)</span>
                <span className="text-zinc-400">0x{toHex(registers.D, 2)}{toHex(registers.E, 2)}H</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <RegisterBox name="D" value={registers.D} activeRegisters={activeRegisters} />
                <RegisterBox name="E" value={registers.E} activeRegisters={activeRegisters} />
              </div>
            </div>

            {/* H-L Pair (L Pointer / M) */}
            <div
              className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${
                activeRegisters.includes('M') || activeRegisters.includes('H') || activeRegisters.includes('L')
                  ? 'bg-zinc-950/90 border-cyan-400 ring-1 ring-cyan-500/40'
                  : 'bg-zinc-950/60 border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-bold text-cyan-300">H-L Pair (M Pointer)</span>
                <span className="text-zinc-400">0x{toHex(registers.H, 2)}{toHex(registers.L, 2)}H</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <RegisterBox name="H" value={registers.H} activeRegisters={activeRegisters} />
                <RegisterBox name="L" value={registers.L} activeRegisters={activeRegisters} />
              </div>

              {/* Virtual Memory Register M [HL] Indicator */}
              <div
                className={`flex items-center justify-between mt-1 px-2 py-1 rounded border text-xs font-mono transition-all ${
                  activeRegisters.includes('M')
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-sm ring-1 ring-amber-400'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">M [HL]:</span>
                  <span className="text-[10px] text-zinc-500">
                    0x{toHex(((registers.H << 8) | registers.L) & 0xFFFF, 4)}H
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-amber-300">
                    {toHex(memory[((registers.H << 8) | registers.L) & 0xFFFF] || 0, 2)}H
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    ({memory[((registers.H << 8) | registers.L) & 0xFFFF] || 0})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Special Registers (PC, SP) */}
          <div className="grid grid-cols-2 gap-2">
            <RegisterBox
              name="Program Counter (PC)"
              subLabel="16-bit Code Pointer"
              value={registers.PC}
              activeRegisters={activeRegisters}
              is16Bit
            />
            <RegisterBox
              name="Stack Pointer (SP)"
              subLabel="16-bit Stack Top"
              value={registers.SP}
              activeRegisters={activeRegisters}
              is16Bit
            />
          </div>

          {/* 4. Active Bus Data Transfer Banner */}
          <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-semibold text-zinc-300">Data Bus:</span>
            </div>

            {dataTransfer ? (
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-zinc-300 font-bold">{dataTransfer.sourceName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-amber-300 font-bold">{dataTransfer.destinationName}</span>
                <span className="rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-amber-300 text-[11px] font-bold">
                  0x{toHex(dataTransfer.value)}H
                </span>
              </div>
            ) : (
              <span className="text-xs text-zinc-500 italic">No active bus transfer</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. BOTTOM: Memory & Array Visualizer Strip ─── */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Memory &amp; Array Strip
            </h3>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              (Click any cell to edit byte)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Segment Jump Shortcuts */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Code', addr: 0x2000 },
                { label: 'Array', addr: 0x2050 },
                { label: 'Dest', addr: 0x2060 },
                { label: 'Stack', addr: 0x20e0 },
              ].map((seg) => (
                <button
                  key={seg.label}
                  onClick={() => onMemBaseChange(seg.addr)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                    memBaseAddress === seg.addr
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {seg.label} ({toHex(seg.addr, 4)}H)
                </button>
              ))}
            </div>

            {/* Direct Address Jump Form & Nav Buttons */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => onMemBaseChange(Math.max(0, memBaseAddress - 16))}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 transition"
                title="Previous 16 bytes"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-700/80">
                <Binary className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-mono text-zinc-500">0x</span>
                <input
                  type="text"
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyJump();
                    }
                  }}
                  onBlur={handleApplyJump}
                  className="w-14 bg-transparent font-mono text-xs font-bold text-amber-300 outline-none uppercase"
                  placeholder="2050"
                  title="Type hex address and press Enter to jump"
                />
                <button
                  type="button"
                  onClick={handleApplyJump}
                  className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
                  title="Jump to address (Enter)"
                >
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => onMemBaseChange(Math.min(0xfff0, memBaseAddress + 16))}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 transition"
                title="Next 16 bytes"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Memory Cells Strip with Animated L & R Pointers */}
        <div className="relative overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50 hover:scrollbar-thumb-zinc-500 pb-4 pt-4 select-none">
          <div className="flex gap-1.5 min-w-max relative px-2">
            {/* Animated Pointer 'L' (HL) */}
            {pointerL !== undefined && pointerL >= memBaseAddress && pointerL < memBaseAddress + 16 && (
              <motion.div
                initial={false}
                animate={{ x: (pointerL - memBaseAddress) * 46 + 6 }}
                transition={springTransition}
                className="absolute -top-7 left-0 flex flex-col items-center justify-center w-9 pointer-events-none z-10"
              >
                <div className="px-1.5 py-0.5 bg-cyan-500 text-zinc-950 text-[10px] font-black rounded shadow">
                  L (HL)
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-500" />
              </motion.div>
            )}

            {/* Animated Pointer 'R' (DE) */}
            {pointerR !== undefined && pointerR >= memBaseAddress && pointerR < memBaseAddress + 16 && (
              <motion.div
                initial={false}
                animate={{ x: (pointerR - memBaseAddress) * 46 + 6 }}
                transition={springTransition}
                className="absolute -top-7 left-0 flex flex-col items-center justify-center w-9 pointer-events-none z-10"
              >
                <div className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-black rounded shadow">
                  R (DE)
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-purple-500" />
              </motion.div>
            )}

            {/* 16 Contiguous Memory Cells with Layout Prop */}
            {Array.from({ length: 16 }).map((_, i) => {
              const addr = memBaseAddress + i;
              const val = memory[addr] || 0;
              const isActive = activeMemoryAddresses.includes(addr);
              const isPointerL = pointerL === addr;
              const isPointerR = pointerR === addr;
              const isEditing = editingAddr === addr;

              return (
                <motion.div
                  key={addr}
                  layout
                  className="flex flex-col items-center w-10 shrink-0"
                  animate={{
                    scale: isActive ? 1.05 : 1,
                    y: isActive ? -4 : 0,
                  }}
                  transition={springTransition}
                >
                  <motion.div
                    onClick={() => !isEditing && handleStartCellEdit(addr, val)}
                    title={isEditing ? 'Editing byte' : `Address 0x${toHex(addr, 4)}H = 0x${toHex(val, 2)}H (${val}). Click to edit.`}
                    className={`w-full aspect-square flex items-center justify-center rounded-lg border font-mono text-sm font-bold shadow-sm transition-colors relative group cursor-pointer ${
                      isPointerL && isPointerR
                        ? 'ring-2 ring-purple-400 border-purple-400'
                        : isPointerL
                        ? 'ring-2 ring-cyan-400 border-cyan-400'
                        : isPointerR
                        ? 'ring-2 ring-pink-400 border-pink-400'
                        : 'border-zinc-800 hover:border-amber-400/70'
                    }`}
                    animate={{
                      backgroundColor: isActive ? '#f59e0b' : '#27272a',
                      color: isActive ? '#09090b' : '#fafafa',
                      borderColor: isActive ? '#f59e0b' : undefined,
                    }}
                    transition={springTransition}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        maxLength={2}
                        value={cellInputVal}
                        onChange={(e) => setCellInputVal(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCellEdit(addr);
                          if (e.key === 'Escape') setEditingAddr(null);
                        }}
                        onBlur={() => handleSaveCellEdit(addr)}
                        className="w-full h-full text-center font-mono text-xs font-black bg-amber-400 text-zinc-950 rounded-lg outline-none ring-2 ring-amber-300 uppercase"
                      />
                    ) : (
                      <>
                        <span>{toHex(val)}</span>
                        <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="w-2.5 h-2.5 text-amber-400" />
                        </div>
                      </>
                    )}
                  </motion.div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1 truncate max-w-full">
                    {toHex(addr, 4)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
