'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpDown,
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
  Radio,
  ShieldCheck,
} from 'lucide-react';
import type { TraceStep, InterruptType } from '@/lib/8085/types';

interface CpuVisualizerProps {
  steps: TraceStep[];
  memory: Uint8Array;
  currentStep: number;
  memBaseAddress: number;
  onMemBaseChange: (a: number) => void;
  onMemoryByteChange?: (address: number, newValue: number) => void;
  /** Callback to trigger a hardware interrupt from the UI */
  onTriggerInterrupt?: (type: InterruptType) => void;
  /** True when the simulation is paused at an infinite loop waiting for an interrupt */
  waitingForInterrupt?: boolean;
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

interface IncDecLatchState {
  type: string;
  action: 'INCREMENT' | 'DECREMENT' | 'LATCH';
  deltaLabel: string;
  targetName: string;
  inputVal: number;
  outputVal: number;
  highByte: number;
  lowByte: number;
  badgeText: string;
  badgeColor: string;
  note: string;
}

function getIncDecLatchState(step: TraceStep): IncDecLatchState {
  const instruction = step.instruction || '';
  const parts = instruction.trim().split(/\s+/);
  const mnemonic = (parts[0] || '').toUpperCase();
  const operand = (parts[1] || '').toUpperCase().replace(/,/g, '');

  // 1. INX rp (16-bit Increment)
  if (mnemonic === 'INX') {
    let target = 'Register Pair';
    let outputVal = 0;
    const rp = operand.charAt(0);
    if (rp === 'B') {
      target = 'Register Pair B-C';
      outputVal = ((step.registers.B << 8) | step.registers.C) & 0xFFFF;
    } else if (rp === 'D') {
      target = 'Register Pair D-E';
      outputVal = ((step.registers.D << 8) | step.registers.E) & 0xFFFF;
    } else if (rp === 'H') {
      target = 'Register Pair H-L';
      outputVal = ((step.registers.H << 8) | step.registers.L) & 0xFFFF;
    } else if (rp === 'S') {
      target = 'Stack Pointer (SP)';
      outputVal = step.registers.SP & 0xFFFF;
    }
    const inputVal = (outputVal - 1) & 0xFFFF;
    return {
      type: 'INX',
      action: 'INCREMENT',
      deltaLabel: '+1',
      targetName: target,
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: `INX ${rp} (+1)`,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      note: 'Hardware Note: Executed via 16-bit Inc/Dec Latch without 8-bit ALU. Status Flags (Z, S, CY, AC, P) are NOT modified.',
    };
  }

  // 2. DCX rp (16-bit Decrement)
  if (mnemonic === 'DCX') {
    let target = 'Register Pair';
    let outputVal = 0;
    const rp = operand.charAt(0);
    if (rp === 'B') {
      target = 'Register Pair B-C';
      outputVal = ((step.registers.B << 8) | step.registers.C) & 0xFFFF;
    } else if (rp === 'D') {
      target = 'Register Pair D-E';
      outputVal = ((step.registers.D << 8) | step.registers.E) & 0xFFFF;
    } else if (rp === 'H') {
      target = 'Register Pair H-L';
      outputVal = ((step.registers.H << 8) | step.registers.L) & 0xFFFF;
    } else if (rp === 'S') {
      target = 'Stack Pointer (SP)';
      outputVal = step.registers.SP & 0xFFFF;
    }
    const inputVal = (outputVal + 1) & 0xFFFF;
    return {
      type: 'DCX',
      action: 'DECREMENT',
      deltaLabel: '-1',
      targetName: target,
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: `DCX ${rp} (-1)`,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      note: 'Hardware Note: Executed via 16-bit Inc/Dec Latch without 8-bit ALU. Condition flags remain completely unchanged.',
    };
  }

  // 3. PUSH rp (SP decremented by 2)
  if (mnemonic === 'PUSH') {
    const outputVal = step.registers.SP & 0xFFFF;
    const inputVal = (outputVal + 2) & 0xFFFF;
    return {
      type: 'PUSH',
      action: 'DECREMENT',
      deltaLabel: '-2',
      targetName: 'Stack Pointer (SP)',
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: 'PUSH (-2)',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      note: 'Stack Push: Decrementer steps SP by 2 to allocate top-of-stack space before writing register pair.',
    };
  }

  // 4. POP rp (SP incremented by 2)
  if (mnemonic === 'POP') {
    const outputVal = step.registers.SP & 0xFFFF;
    const inputVal = (outputVal - 2) & 0xFFFF;
    return {
      type: 'POP',
      action: 'INCREMENT',
      deltaLabel: '+2',
      targetName: 'Stack Pointer (SP)',
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: 'POP (+2)',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      note: 'Stack Pop: Incrementer advances SP by 2 to reclaim stack memory after reading register pair.',
    };
  }

  // 5. CALL / RST
  if (mnemonic.startsWith('CALL') || mnemonic === 'RST' || ['CC', 'CNC', 'CZ', 'CNZ', 'CP', 'CM', 'CPE', 'CPO'].includes(mnemonic)) {
    const outputVal = step.registers.PC & 0xFFFF;
    const inputVal = step.address & 0xFFFF;
    return {
      type: 'CALL',
      action: 'DECREMENT',
      deltaLabel: 'SP-2 / PC',
      targetName: 'SP & Program Counter',
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: 'CALL LATCH',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      note: 'Subroutine Call: SP decremented by 2 for return address, destination latched to PC.',
    };
  }

  // 6. RET
  if (mnemonic.startsWith('RET') || ['RC', 'RNC', 'RZ', 'RNZ', 'RP', 'RM', 'RPE', 'RPO'].includes(mnemonic)) {
    const outputVal = step.registers.PC & 0xFFFF;
    const inputVal = step.address & 0xFFFF;
    return {
      type: 'RET',
      action: 'INCREMENT',
      deltaLabel: 'SP+2 / PC',
      targetName: 'SP & Program Counter',
      inputVal,
      outputVal,
      highByte: (outputVal >> 8) & 0xFF,
      lowByte: outputVal & 0xFF,
      badgeText: 'RET LATCH',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      note: 'Return: SP incremented by 2, popped return address latched into Program Counter.',
    };
  }

  // 7. JMP or branch
  if (mnemonic.startsWith('J') || mnemonic === 'PCHL') {
    const outputVal = step.registers.PC & 0xFFFF;
    const inputVal = step.address & 0xFFFF;
    const isJumped = outputVal !== ((inputVal + (step.bytes?.length || 1)) & 0xFFFF);
    if (isJumped) {
      return {
        type: 'JMP',
        action: 'LATCH',
        deltaLabel: 'JUMP',
        targetName: 'Program Counter (PC)',
        inputVal,
        outputVal,
        highByte: (outputVal >> 8) & 0xFF,
        lowByte: outputVal & 0xFF,
        badgeText: 'PC BRANCH LATCH',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        note: `Branch taken: Target address 0x${toHex(outputVal, 4)}H latched into Program Counter.`,
      };
    }
  }

  // 8. Default: Instruction Fetch (PC advance)
  const byteLen = step.bytes?.length || 1;
  const inputVal = step.address & 0xFFFF;
  const outputVal = (step.address + byteLen) & 0xFFFF;
  return {
    type: 'PC_FETCH',
    action: 'INCREMENT',
    deltaLabel: `+${byteLen}`,
    targetName: 'Program Counter (PC)',
    inputVal,
    outputVal,
    highByte: (outputVal >> 8) & 0xFF,
    lowByte: outputVal & 0xFF,
    badgeText: `FETCH PC (+${byteLen})`,
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    note: `Instruction Fetch: 16-bit address latch stepped PC by ${byteLen} byte${byteLen > 1 ? 's' : ''} to prepare next fetch cycle.`,
  };
}


// ── SIM / RIM Visualizer ──────────────────────────────────────────────────────
const SimRimCard: React.FC<{ step: TraceStep }> = ({ step }) => {
  const mnemonic = (step.instruction || '').trim().split(/\s+/)[0].toUpperCase();
  const isSIM = mnemonic === 'SIM';
  const isRIM = mnemonic === 'RIM';
  const isActive = isSIM || isRIM;

  const is = step.interruptStatus;
  const aVal = step.registers.A;

  // ── SIM byte: A is the operand written by SIM ──
  // D7=SOD  D6=SDE  D5=RST7.5-reset  D4=MSE  D3=M7.5  D2=M6.5  D1=M5.5  D0=—
  const simBits = [
    {
      bit: 7, label: 'SOD',
      desc: 'D7: Serial Output Data — value sent to SOD pin if SDE=1',
      active: isSIM ? !!(aVal & 0x80) : false,
      color: (isSIM && (aVal & 0x80)) ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    },
    {
      bit: 6, label: 'SDE',
      desc: 'D6: SOD Enable — must be 1 to output serial data on SOD pin',
      active: isSIM ? !!(aVal & 0x40) : false,
      color: (isSIM && (aVal & 0x40)) ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    },
    {
      bit: 5, label: 'R7.5',
      desc: 'D5: Reset RST7.5 flip-flop — writing 1 clears the latched RST7.5 pending bit',
      active: isSIM ? !!(aVal & 0x10) : !!(is?.pending7_5),
      color: isSIM
        ? (aVal & 0x10) ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30'
        : is?.pending7_5 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    },
    {
      bit: 4, label: 'MSE',
      desc: 'D4: Mask Set Enable — must be 1 for D3/D2/D1 to actually update the mask bits',
      active: isSIM ? !!(aVal & 0x08) : !!(is?.enabled),
      color: isSIM
        ? (aVal & 0x08) ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30'
        : is?.enabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    },
    {
      bit: 3, label: 'M7.5',
      desc: 'D3: RST7.5 Mask — 1=masked (blocked), 0=enabled',
      active: is?.mask7_5 ?? false,
      color: is?.mask7_5 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      bit: 2, label: 'M6.5',
      desc: 'D2: RST6.5 Mask — 1=masked (blocked), 0=enabled',
      active: is?.mask6_5 ?? false,
      color: is?.mask6_5 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      bit: 1, label: 'M5.5',
      desc: 'D1: RST5.5 Mask — 1=masked (blocked), 0=enabled',
      active: is?.mask5_5 ?? false,
      color: is?.mask5_5 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      bit: 0, label: 'SID',
      desc: 'D0: Serial Input Data — value of SID pin (read via RIM into bit 7 of A)',
      active: false,
      color: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    },
  ];

  // ── RIM byte layout when A has been loaded by RIM ──
  // D7=SID  D6=I7.5  D5=I6.5  D4=I5.5  D3=IE  D2=M7.5  D1=M6.5  D0=M5.5
  const rimBits = [
    { bit: 7, label: 'SID',  desc: 'D7: Serial Input Data pin value',                                    hi: !!(aVal & 0x80), hiColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    { bit: 6, label: 'I7.5', desc: 'D6: RST7.5 pending (flip-flop latched)',                             hi: !!(aVal & 0x40), hiColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { bit: 5, label: 'I6.5', desc: 'D5: RST6.5 pending',                                                 hi: !!(aVal & 0x20), hiColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { bit: 4, label: 'I5.5', desc: 'D4: RST5.5 pending',                                                 hi: !!(aVal & 0x10), hiColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { bit: 3, label: 'IE',   desc: 'D3: Interrupt Enable (INTE flip-flop state)',                        hi: !!(aVal & 0x08), hiColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { bit: 2, label: 'M7.5', desc: 'D2: RST7.5 Mask bit (1=masked)',                                    hi: !!(aVal & 0x04), hiColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
    { bit: 1, label: 'M6.5', desc: 'D1: RST6.5 Mask bit (1=masked)',                                    hi: !!(aVal & 0x02), hiColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
    { bit: 0, label: 'M5.5', desc: 'D0: RST5.5 Mask bit (1=masked)',                                    hi: !!(aVal & 0x01), hiColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
  ];

  const bitsToShow = isRIM ? rimBits.map(b => ({
    bit: b.bit, label: b.label, desc: b.desc,
    color: b.hi ? b.hiColor : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/30',
    value: b.hi,
  })) : simBits.map(b => ({
    bit: b.bit, label: b.label, desc: b.desc,
    color: b.color,
    value: b.active,
  }));

  return (
    <motion.div
      layout
      animate={{
        borderColor: isActive ? (isSIM ? 'rgba(139,92,246,0.5)' : 'rgba(6,182,212,0.5)') : 'rgba(63,63,70,0.8)',
        backgroundColor: isActive ? (isSIM ? 'rgba(139,92,246,0.04)' : 'rgba(6,182,212,0.04)') : 'rgba(9,9,11,0.7)',
      }}
      transition={springTransition}
      className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/70 flex flex-col gap-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={`w-3.5 h-3.5 ${isActive ? (isSIM ? 'text-violet-400' : 'text-cyan-400') : 'text-zinc-500'}`} />
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
            SIM / RIM — Serial &amp; Interrupt Mask
          </span>
        </div>
        <div className="flex items-center gap-1">
          <motion.span
            animate={{
              backgroundColor: isSIM ? 'rgba(139,92,246,0.2)' : 'rgba(39,39,42,0.8)',
              color: isSIM ? '#c4b5fd' : '#71717a',
              borderColor: isSIM ? 'rgba(139,92,246,0.5)' : '#3f3f46',
            }}
            transition={springTransition}
            className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded border uppercase"
          >
            SIM
          </motion.span>
          <motion.span
            animate={{
              backgroundColor: isRIM ? 'rgba(6,182,212,0.2)' : 'rgba(39,39,42,0.8)',
              color: isRIM ? '#67e8f9' : '#71717a',
              borderColor: isRIM ? 'rgba(6,182,212,0.5)' : '#3f3f46',
            }}
            transition={springTransition}
            className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded border uppercase"
          >
            RIM
          </motion.span>
        </div>
      </div>

      {/* Mode label */}
      <div className={`text-[10px] font-mono px-2 py-1 rounded border leading-tight ${
        isSIM ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' :
        isRIM ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' :
        'bg-zinc-900/60 border-zinc-800 text-zinc-500'
      }`}>
        {isSIM
          ? `SIM writing 0x${(step.registers.A).toString(16).toUpperCase().padStart(2,'0')}H → Interrupt Mask Register`
          : isRIM
          ? `RIM read Interrupt Mask → A = 0x${(step.registers.A).toString(16).toUpperCase().padStart(2,'0')}H`
          : 'Interrupt mask register state (execute SIM or RIM to update)'}
      </div>

      {/* Byte grid */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            {isRIM ? 'A ← RIM read (D7→D0)' : 'A → SIM write (D7→D0)'}
          </span>
          <span className="text-[9px] font-mono text-zinc-600">
            0x{(step.registers.A).toString(16).toUpperCase().padStart(2, '0')}H
          </span>
        </div>
        <div className="grid grid-cols-8 gap-0.5">
          {bitsToShow.map(({ bit, label, desc, color, value }) => (
            <motion.div
              key={bit}
              layout
              animate={{ scale: value && isActive ? 1.06 : 1 }}
              transition={springTransition}
              title={desc}
              className={`flex flex-col items-center gap-0.5 px-0.5 py-1.5 rounded border cursor-default select-none ${color}`}
            >
              <span className="text-[8px] font-mono text-zinc-600">D{bit}</span>
              <span className="text-[9px] font-bold font-mono leading-none">{label}</span>
              <span className={`text-[8px] font-black font-mono mt-0.5 ${value ? 'opacity-100' : 'opacity-40'}`}>
                {value ? '1' : '0'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bit-field summary when active */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-[9px] font-mono leading-tight px-2 py-1 rounded border ${
            isSIM ? 'bg-violet-500/8 border-violet-500/20 text-violet-200/80' : 'bg-cyan-500/8 border-cyan-500/20 text-cyan-200/80'
          }`}
        >
          {isSIM ? (
            <>
              {`MSE=${!!(step.registers.A & 0x08) ? 1 : 0} → `}
              {`M7.5=${is?.mask7_5 ? 1 : 0}  M6.5=${is?.mask6_5 ? 1 : 0}  M5.5=${is?.mask5_5 ? 1 : 0}  `}
              {`SDE=${!!(step.registers.A & 0x40) ? 1 : 0} SOD=${!!(step.registers.A & 0x80) ? 1 : 0}`}
            </>
          ) : (
            <>
              {`IE=${!!(step.registers.A & 0x08) ? 1 : 0}  `}
              {`M7.5=${!!(step.registers.A & 0x04) ? 1 : 0}  M6.5=${!!(step.registers.A & 0x02) ? 1 : 0}  M5.5=${!!(step.registers.A & 0x01) ? 1 : 0}  `}
              {`I7.5=${!!(step.registers.A & 0x40) ? 1 : 0}  I6.5=${!!(step.registers.A & 0x20) ? 1 : 0}  I5.5=${!!(step.registers.A & 0x10) ? 1 : 0}  `}
              {`SID=${!!(step.registers.A & 0x80) ? 1 : 0}`}
            </>
          )}
        </motion.div>
      )}

      {/* Static guide when idle */}
      {!isActive && (
        <p className="text-[9px] text-zinc-600 leading-tight">
          <span className="font-mono text-zinc-400">SIM</span>: writes A bits to mask register (D4=MSE gate) ·{' '}
          <span className="font-mono text-zinc-400">RIM</span>: reads mask + pending + INTE + SID into A
        </p>
      )}
    </motion.div>
  );
};

const IncDecLatchCard: React.FC<{ step: TraceStep }> = ({ step }) => {
  const latch = getIncDecLatchState(step);
  const isInc = latch.action === 'INCREMENT';
  const isDec = latch.action === 'DECREMENT';

  return (
    <div className="p-3 bg-zinc-950/70 rounded-lg border border-zinc-800/80 flex flex-col gap-2.5">
      {/* Title & Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            16-Bit Incrementer / Decrementer Address Latch
          </span>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${latch.badgeColor}`}
        >
          {latch.badgeText}
        </span>
      </div>

      {/* 3-Stage Hardware Flow (Input Bus -> Inc/Dec Unit -> 16-bit Address Latch) */}
      <div className="grid grid-cols-11 gap-1.5 items-center bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
        {/* Stage 1: Input from Register Array */}
        <div className="col-span-4 flex flex-col p-2 bg-zinc-950/80 rounded border border-zinc-800/90 text-center">
          <span className="text-[9px] uppercase font-semibold text-zinc-400 truncate" title={latch.targetName}>
            {latch.targetName}
          </span>
          <span className="font-mono text-xs font-bold text-zinc-200 mt-0.5">
            0x{toHex(latch.inputVal, 4)}H
          </span>
          <span className="text-[8px] font-mono text-zinc-500 mt-0.5">16-Bit Input Bus</span>
        </div>

        {/* Stage 2: Dedicated 16-bit Inc/Dec Unit */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <motion.div
            key={`${step.stepIndex}-op`}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={springTransition}
            className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono font-bold text-xs shadow-sm ${
              isInc
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : isDec
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            }`}
          >
            {latch.deltaLabel}
          </motion.div>
          <span className="text-[8px] font-mono text-zinc-400 mt-1 uppercase font-semibold">
            {isInc ? 'Inc Unit' : isDec ? 'Dec Unit' : 'Latch Unit'}
          </span>
        </div>

        {/* Stage 3: Latched Output Address */}
        <div className="col-span-4 flex flex-col p-2 bg-zinc-950/80 rounded border border-amber-500/30 text-center shadow-sm">
          <span className="text-[9px] uppercase font-semibold text-amber-400">
            Address Latch
          </span>
          <motion.span
            key={`${step.stepIndex}-val`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={springTransition}
            className="font-mono text-xs font-black text-amber-300 mt-0.5"
          >
            0x{toHex(latch.outputVal, 4)}H
          </motion.span>
          <span className="text-[8px] font-mono text-amber-500/80 mt-0.5">Latched 16-Bit</span>
        </div>
      </div>

      {/* External Bus Output Split (A15-A8 & AD7-AD0) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/40 rounded border border-zinc-800/80 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-zinc-400 text-[10px] font-sans font-semibold">Address Buffer</span>
            <span className="text-zinc-500 text-[9px]">Pins 19-28 (A15-A8)</span>
          </div>
          <span className="font-bold text-cyan-300">0x{toHex(latch.highByte, 2)}H</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/40 rounded border border-zinc-800/80 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-zinc-400 text-[10px] font-sans font-semibold">Multiplexed Bus</span>
            <span className="text-zinc-500 text-[9px]">Pins 12-19 (AD7-AD0)</span>
          </div>
          <span className="font-bold text-emerald-300">0x{toHex(latch.lowByte, 2)}H</span>
        </div>
      </div>

      {/* Educational Hardware Note */}
      <div className="flex items-start gap-1.5 text-[10px] text-zinc-400 bg-zinc-900/40 px-2 py-1.5 rounded border border-zinc-800/60 leading-tight">
        <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
        <span>{latch.note}</span>
      </div>
    </div>
  );
};

interface InterruptLineDef {
  id: 'TRAP' | 'RST7.5' | 'RST6.5' | 'RST5.5' | 'INTR';
  pin: number;
  pri: number;
  vector: number | null;
  label: string;
  type: 'NMI' | 'Maskable';
  trigger: string;
  mask: 'mask7_5' | 'mask6_5' | 'mask5_5' | null;
  pending: 'pending7_5' | 'pending6_5' | 'pending5_5' | null;
}

const INTERRUPT_LINES: InterruptLineDef[] = [
  { id: 'TRAP',   pin: 6,  pri: 1, vector: 0x0024, label: '0024H', type: 'NMI',      trigger: 'Edge+Level', mask: null,       pending: null },
  { id: 'RST7.5', pin: 7,  pri: 2, vector: 0x003C, label: '003CH', type: 'Maskable', trigger: 'Rising Edge', mask: 'mask7_5', pending: 'pending7_5' },
  { id: 'RST6.5', pin: 8,  pri: 3, vector: 0x0034, label: '0034H', type: 'Maskable', trigger: 'High Level',  mask: 'mask6_5', pending: 'pending6_5' },
  { id: 'RST5.5', pin: 9,  pri: 4, vector: 0x002C, label: '002CH', type: 'Maskable', trigger: 'High Level',  mask: 'mask5_5', pending: 'pending5_5' },
  { id: 'INTR',   pin: 10, pri: 5, vector: null,    label: 'INTA↑', type: 'Maskable', trigger: 'High Level',  mask: null,       pending: null },
];

const HardwareInterruptsCard: React.FC<{
  interruptStatus?: TraceStep['interruptStatus'];
  onMemBaseChange: (addr: number) => void;
  onTriggerInterrupt?: (type: InterruptType) => void;
  waitingForInterrupt?: boolean;
}> = ({ interruptStatus, onMemBaseChange, onTriggerInterrupt, waitingForInterrupt }) => {
  const ie = interruptStatus?.enabled ?? false;
  const [firedLine, setFiredLine] = React.useState<string | null>(null);

  const handleFire = (id: InterruptType) => {
    setFiredLine(id);
    setTimeout(() => setFiredLine(null), 900);
    onTriggerInterrupt?.(id);
  };

  return (
    <div className="flex flex-col gap-2.5 p-3 bg-zinc-950/70 rounded-lg border border-zinc-800/80">

      {/* ── Header + INTE flip-flop pill ── */}
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
            Hardware Interrupt Controller
          </span>
        </div>
        <motion.div
          layout
          animate={{
            backgroundColor: ie ? 'rgba(16,185,129,0.18)' : 'rgba(39,39,42,0.8)',
            borderColor: ie ? '#10b981' : '#3f3f46',
          }}
          transition={springTransition}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold"
        >
          <motion.span animate={{ color: ie ? '#34d399' : '#71717a' }} transition={springTransition}>
            INTE
          </motion.span>
          <motion.div
            animate={{
              backgroundColor: ie ? '#10b981' : '#3f3f46',
              boxShadow: ie ? '0 0 6px 1px rgba(16,185,129,0.5)' : 'none',
            }}
            transition={springTransition}
            className="w-3.5 h-3.5 rounded-sm border border-zinc-600 flex items-center justify-center text-[9px] font-black text-white"
          >
            {ie ? '1' : '0'}
          </motion.div>
          <motion.span animate={{ color: ie ? '#6ee7b7' : '#52525b' }} transition={springTransition}>
            {ie ? 'ENABLED' : 'DISABLED'}
          </motion.span>
        </motion.div>
      </div>

      {/* ── CPU halted / waiting banner ── */}
      {waitingForInterrupt && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-400/50 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-amber-300 leading-tight">CPU Halted — Awaiting Hardware Interrupt</span>
            <span className="text-[10px] text-amber-200/70 leading-tight">
              EI + infinite loop detected. Fire an unmasked pin below to resume.
            </span>
          </div>
          <span className="ml-auto shrink-0 text-[9px] font-black bg-amber-500/25 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
            WAIT
          </span>
        </motion.div>
      )}

      {/* ── Interrupt priority lines ── */}
      <div className="flex flex-col gap-1.5">
        {/* Column headers */}
        <div className="grid grid-cols-[18px_1fr_68px_52px_60px] gap-x-2 px-1 pb-0.5 border-b border-zinc-800/40 items-center">
          <span />
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Signal / Pin</span>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center">Vector</span>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center">Status</span>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center">Action</span>
        </div>

        {INTERRUPT_LINES.map((line) => {
          const isMasked = line.mask && interruptStatus ? interruptStatus[line.mask] : false;
          const isPending = line.pending && interruptStatus ? interruptStatus[line.pending] : false;
          const isNMI = line.type === 'NMI';
          const canFire = isNMI || (ie && !isMasked);
          const isFiring = firedLine === line.id;

          let stateLabel = 'DISABLED';
          let stateDotCls = 'bg-zinc-600';
          let stateTextCls = 'text-zinc-500';
          let rowBgCls = 'bg-zinc-950/40';

          if (isNMI) {
            stateLabel = 'NMI'; stateDotCls = 'bg-rose-500'; stateTextCls = 'text-rose-400'; rowBgCls = 'bg-rose-500/5';
          } else if (isMasked) {
            stateLabel = 'MASKED'; stateDotCls = 'bg-zinc-600'; stateTextCls = 'text-zinc-500';
          } else if (!ie) {
            stateLabel = 'INTE=0'; stateDotCls = 'bg-zinc-600'; stateTextCls = 'text-zinc-500';
          } else if (isPending) {
            stateLabel = 'PENDING'; stateDotCls = 'bg-amber-400 animate-pulse'; stateTextCls = 'text-amber-400'; rowBgCls = 'bg-amber-500/8';
          } else {
            stateLabel = 'READY'; stateDotCls = 'bg-emerald-500'; stateTextCls = 'text-emerald-400';
          }

          return (
            <motion.div
              key={line.id}
              layout
              animate={{
                backgroundColor: isFiring ? 'rgba(251,191,36,0.12)' : undefined,
                borderColor: isFiring ? 'rgba(251,191,36,0.45)' : undefined,
              }}
              transition={{ duration: 0.35 }}
              className={`grid grid-cols-[18px_1fr_68px_52px_60px] gap-x-2 px-2 py-2 rounded-lg border border-zinc-800/40 items-center ${rowBgCls} transition-colors`}
            >
              {/* Priority badge */}
              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                isNMI
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : canFire
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800/80 text-zinc-600 border border-zinc-700/50'
              }`}>
                {line.pri}
              </span>

              {/* Signal name + pin + trigger metadata */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stateDotCls}`} />
                  <span className={`text-[12px] font-bold font-mono ${isNMI ? 'text-rose-300' : canFire ? 'text-zinc-100' : 'text-zinc-500'}`}>
                    {line.id}
                  </span>
                  {isNMI && (
                    <span className="text-[8px] font-bold px-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">NMI</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[9px] text-zinc-600 font-mono">Pin {line.pin}</span>
                  <span className="text-[9px] text-zinc-700">·</span>
                  <span className="text-[9px] text-zinc-500 font-mono">{line.trigger}</span>
                  {line.mask && (
                    <span className={`text-[9px] font-mono font-bold ${isMasked ? 'text-rose-400' : 'text-zinc-600'}`}>
                      M={isMasked ? '1' : '0'}
                    </span>
                  )}
                  {line.pending && (
                    <span className={`text-[9px] font-mono font-bold ${isPending ? 'text-amber-400' : 'text-zinc-700'}`}>
                      P={isPending ? '1' : '0'}
                    </span>
                  )}
                </div>
              </div>

              {/* Vector address — clickable to jump memory view */}
              <div className="flex items-center justify-center">
                {line.vector !== null ? (
                  <button
                    type="button"
                    onClick={() => onMemBaseChange(line.vector!)}
                    className="text-[10px] font-mono font-bold text-cyan-400 hover:text-cyan-200 hover:underline transition-colors"
                    title={`Jump memory view to ISR at ${line.label}`}
                  >
                    {line.label}
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">{line.label}</span>
                )}
              </div>

              {/* Status label */}
              <div className="flex items-center justify-center">
                <span className={`text-[9px] font-bold font-mono ${stateTextCls}`}>{stateLabel}</span>
              </div>

              {/* Fire button */}
              <div className="flex items-center justify-center">
                <motion.button
                  type="button"
                  onClick={() => handleFire(line.id as InterruptType)}
                  disabled={!canFire && !isNMI}
                  whileTap={canFire || isNMI ? { scale: 0.88 } : undefined}
                  animate={isFiring ? { scale: [1, 1.18, 1] } : {}}
                  transition={{ duration: 0.35 }}
                  className={`w-full py-1 px-1.5 rounded-md text-[10px] font-bold font-mono border flex items-center justify-center gap-0.5 transition-all ${
                    isFiring
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.55)]'
                      : canFire || isNMI
                      ? waitingForInterrupt
                        ? 'bg-amber-500/90 text-zinc-950 border-amber-400 hover:bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.35)] cursor-pointer animate-pulse'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-violet-600/80 hover:border-violet-500 hover:text-white hover:shadow-[0_0_6px_rgba(139,92,246,0.4)] cursor-pointer'
                      : 'bg-zinc-900/60 text-zinc-700 border-zinc-800/60 cursor-not-allowed opacity-40'
                  }`}
                  title={
                    canFire || isNMI
                      ? `Fire hardware interrupt on Pin ${line.pin} (${line.id})`
                      : 'Blocked: interrupt masked or INTE=0'
                  }
                >
                  {isFiring ? '✓ ACK' : '⚡ Fire'}
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── SIM / RIM register bit layout ── */}
      <div className="flex flex-col gap-1 bg-zinc-900/50 rounded-lg border border-zinc-800/50 px-2.5 py-2">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
          SIM / RIM — Interrupt Mask Register (D7 → D0)
        </span>
        <div className="grid grid-cols-8 gap-0.5">
          {[
            { bit: 7, label: 'SOD',  cls: 'text-zinc-400', bg: 'bg-zinc-800/60', title: 'D7: Serial Output Data' },
            { bit: 6, label: 'SDE',  cls: 'text-zinc-400', bg: 'bg-zinc-800/60', title: 'D6: SOD Enable' },
            { bit: 5, label: 'R7.5', cls: interruptStatus?.pending7_5 ? 'text-amber-400 font-bold' : 'text-zinc-400', bg: interruptStatus?.pending7_5 ? 'bg-amber-500/15' : 'bg-zinc-800/60', title: 'D5: RST7.5 pending flip-flop (RIM read)' },
            { bit: 4, label: 'MSE',  cls: 'text-zinc-400', bg: 'bg-zinc-800/60', title: 'D4: Mask Set Enable — must be 1 to write mask bits' },
            { bit: 3, label: 'M7.5', cls: interruptStatus?.mask7_5 ? 'text-rose-400 font-bold' : 'text-emerald-400', bg: interruptStatus?.mask7_5 ? 'bg-rose-500/15' : 'bg-emerald-500/10', title: 'D3: RST7.5 Mask (1=masked)' },
            { bit: 2, label: 'M6.5', cls: interruptStatus?.mask6_5 ? 'text-rose-400 font-bold' : 'text-emerald-400', bg: interruptStatus?.mask6_5 ? 'bg-rose-500/15' : 'bg-emerald-500/10', title: 'D2: RST6.5 Mask (1=masked)' },
            { bit: 1, label: 'M5.5', cls: interruptStatus?.mask5_5 ? 'text-rose-400 font-bold' : 'text-emerald-400', bg: interruptStatus?.mask5_5 ? 'bg-rose-500/15' : 'bg-emerald-500/10', title: 'D1: RST5.5 Mask (1=masked)' },
            { bit: 0, label: 'SID',  cls: 'text-zinc-400', bg: 'bg-zinc-800/60', title: 'D0: Serial Input Data (RIM read)' },
          ].map(({ bit, label, cls, bg, title }) => (
            <div key={bit} className={`flex flex-col items-center gap-0.5 px-0.5 py-1 rounded border border-zinc-700/30 ${bg}`} title={title}>
              <span className="text-[8px] font-mono text-zinc-600">D{bit}</span>
              <span className={`text-[9px] font-bold font-mono ${cls}`}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-zinc-600 mt-0.5 leading-tight">
          <span className="font-mono text-zinc-400">SIM</span> sets mask bits ·{' '}
          <span className="font-mono text-zinc-400">RIM</span> reads SID + pending ·{' '}
          <span className="font-mono text-zinc-400">EI</span>/<span className="font-mono text-zinc-400">DI</span> control INTE globally
        </p>
      </div>
    </div>
  );
};

export const CpuVisualizer: React.FC<CpuVisualizerProps> = ({
  steps,
  memory,
  currentStep,
  memBaseAddress,
  onMemBaseChange,
  onMemoryByteChange,
  onTriggerInterrupt,
  waitingForInterrupt,
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* ─── Left Box: ALU & Logic Operations Center (5 cols) ─── */}
        <div className="lg:col-span-5 flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-3.5 shadow-sm h-full">
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

          {/* 16-bit Incrementer / Decrementer Address Latch */}
          <IncDecLatchCard step={step} />

          {/* SIM / RIM — Serial & Interrupt Mask Visualizer */}
          <SimRimCard step={step} />
        </div>

        {/* ─── Right Box: Registers & Internal Bus (7 cols) ─── */}
        <div className="lg:col-span-7 flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/30 p-3.5 shadow-sm h-full">
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

          {/* 5. 8085 Hardware Interrupt Controller */}
          <HardwareInterruptsCard
            interruptStatus={step.interruptStatus}
            onMemBaseChange={onMemBaseChange}
            onTriggerInterrupt={onTriggerInterrupt}
            waitingForInterrupt={waitingForInterrupt}
          />
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
