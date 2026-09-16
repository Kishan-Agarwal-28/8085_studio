'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Cpu, MemoryStick, Binary, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TraceStep } from '@/lib/8085/types';

interface CpuVisualizerProps {
  steps: TraceStep[];
  memory: Uint8Array;
  currentStep: number;
  memBaseAddress: number;
  onMemBaseChange: (a: number) => void;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const toHex = (val: number, pad = 2) => val.toString(16).toUpperCase().padStart(pad, '0');

export const CpuVisualizer: React.FC<CpuVisualizerProps> = ({
  steps,
  memory,
  currentStep,
  memBaseAddress,
  onMemBaseChange
}) => {
  const step = steps[currentStep] || steps[steps.length - 1];
  
  if (!step) {
    return (
      <div className="p-4 bg-zinc-950 text-zinc-400 rounded-lg border border-zinc-800">
        No execution data available.
      </div>
    );
  }

  const { instruction, bytes, description, registers, flags, activeRegisters, activeMemoryAddresses, dataTransfer, pointerL, pointerR } = step;

  // Determine Instruction Category
  let category = 'Control';
  let badgeColor = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  
  const mnemonic = instruction.split(' ')[0].toUpperCase();
  if (['MOV', 'MVI', 'LXI', 'LDA', 'STA', 'LHLD', 'SHLD', 'LDAX', 'STAX', 'XCHG'].includes(mnemonic)) {
    category = 'Data Transfer';
    badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  } else if (['ADD', 'ADC', 'ADI', 'ACI', 'SUB', 'SBB', 'SUI', 'SBI', 'INR', 'INX', 'DCR', 'DCX', 'DAD', 'DAA'].includes(mnemonic)) {
    category = 'Arithmetic';
    badgeColor = 'bg-green-500/20 text-green-400 border-green-500/30';
  } else if (['ANA', 'ANI', 'ORA', 'ORI', 'XRA', 'XRI', 'CMP', 'CPI', 'RLC', 'RRC', 'RAL', 'RAR', 'CMA', 'CMC', 'STC'].includes(mnemonic)) {
    category = 'Logical';
    badgeColor = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  } else if (['JMP', 'JC', 'JNC', 'JZ', 'JNZ', 'JP', 'JM', 'JPE', 'JPO', 'CALL', 'CC', 'CNC', 'CZ', 'CNZ', 'CP', 'CM', 'CPE', 'CPO', 'RET', 'RC', 'RNC', 'RZ', 'RNZ', 'RP', 'RM', 'RPE', 'RPO', 'PCHL', 'RST'].includes(mnemonic)) {
    category = 'Branch';
    badgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  } else if (['PUSH', 'POP', 'XTHL', 'SPHL'].includes(mnemonic)) {
    category = 'Stack';
    badgeColor = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  }

  const RegisterBox = ({ name, value, is16Bit = false, className = "" }: { name: string, value: number, is16Bit?: boolean, className?: string }) => {
    const isActive = activeRegisters.includes(name.split(' ')[0]);
    
    return (
      <motion.div
        className={`flex flex-col items-center justify-center p-3 rounded-md border border-zinc-800 ${className}`}
        initial={false}
        animate={{
          scale: isActive ? 1.05 : 1,
          y: isActive ? -4 : 0,
          backgroundColor: isActive ? '#f59e0b' : '#27272a',
          color: isActive ? '#000000' : '#ffffff'
        }}
        transition={springTransition}
      >
        <span className="text-xs font-bold opacity-80 mb-1">{name}</span>
        <span className="font-mono text-lg">{toHex(value, is16Bit ? 4 : 2)}H</span>
      </motion.div>
    );
  };

  const FlagToggle = ({ name, value }: { name: string, value: boolean }) => (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[10px] text-zinc-500 font-bold mb-1">{name}</span>
      <motion.div 
        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono font-bold`}
        animate={{
          backgroundColor: value ? '#10b981' : '#27272a',
          color: value ? '#ffffff' : '#71717a',
          borderColor: value ? '#10b981' : '#3f3f46'
        }}
        transition={springTransition}
      >
        {value ? '1' : '0'}
      </motion.div>
    </div>
  );

  return (
    <div className="w-full bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 overflow-hidden flex flex-col shadow-2xl">
      
      {/* Top Section: Instruction Details */}
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold font-mono tracking-wider">{instruction || 'NOP'}</h2>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
              {category}
            </span>
          </div>
          <p className="text-zinc-400 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {description}
          </p>
        </div>
        <div className="flex gap-2">
          {bytes.map((b, i) => (
            <div key={i} className="px-3 py-2 bg-zinc-900 rounded border border-zinc-700 font-mono text-lg text-amber-400 shadow-inner">
              {toHex(b)}
            </div>
          ))}
        </div>
      </div>

      {/* Middle Section: CPU Registers and Flags */}
      <div className="p-6 relative">
        <h3 className="text-sm font-semibold text-zinc-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Internal Registers
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Registers Grid */}
          <div className="md:col-span-8 flex flex-col gap-4">
            <RegisterBox name="A (Accumulator)" value={registers.A} className="w-full" />
            
            <div className="grid grid-cols-2 gap-4">
              <RegisterBox name="B" value={registers.B} />
              <RegisterBox name="C" value={registers.C} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <RegisterBox name="D" value={registers.D} />
              <RegisterBox name="E" value={registers.E} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <RegisterBox name="H" value={registers.H} />
              <RegisterBox name="L" value={registers.L} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
              <RegisterBox name="PC" value={registers.PC} is16Bit />
              <RegisterBox name="SP" value={registers.SP} is16Bit />
            </div>
          </div>

          {/* Flags and Data Flow */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-500 mb-4 text-center">STATUS FLAGS</h4>
              <div className="flex justify-between px-2">
                <FlagToggle name="S" value={flags.s} />
                <FlagToggle name="Z" value={flags.z} />
                <FlagToggle name="AC" value={flags.ac} />
                <FlagToggle name="P" value={flags.p} />
                <FlagToggle name="CY" value={flags.cy} />
              </div>
            </div>

            {/* Data Flow Indicator */}
            <div className="flex-grow flex items-center justify-center min-h-[120px] p-4 bg-zinc-900/20 rounded-xl border border-zinc-800/50 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {dataTransfer ? (
                  <motion.div 
                    key={step.stepIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center gap-2 w-full"
                  >
                    <span className="text-xs text-zinc-400 font-mono font-bold tracking-wider uppercase">
                      {dataTransfer.sourceName}
                    </span>
                    <div className="relative w-full flex items-center my-1">
                      <div className="h-px bg-zinc-700 w-full relative">
                        <motion.div 
                          className="absolute w-2 h-2 bg-amber-400 rounded-full -top-[3.5px] shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                          initial={{ left: '0%' }}
                          animate={{ left: '100%' }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 absolute right-0 -mr-1 bg-zinc-950 rounded-full" />
                    </div>
                    <span className="text-xs text-zinc-400 font-mono font-bold tracking-wider uppercase">
                      {dataTransfer.destinationName}
                    </span>
                    <div className="mt-1 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-amber-300 font-mono text-sm shadow-inner">
                      {toHex(dataTransfer.value, 2)}H
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-zinc-600 text-xs italic"
                  >
                    No data transfer
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Memory Strip Visualizer */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-semibold text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
            <MemoryStick className="w-4 h-4" /> Memory Segment
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => onMemBaseChange(Math.max(0, memBaseAddress - 16))}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 bg-zinc-950 rounded border border-zinc-800 font-mono text-sm text-zinc-300 flex items-center gap-2">
              <Binary className="w-3 h-3" />
              {toHex(memBaseAddress, 4)}H
            </div>
            <button 
              onClick={() => onMemBaseChange(Math.min(0xFFF0, memBaseAddress + 16))}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative pb-2 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1 min-w-max relative px-4">
            
            {/* Animated Pointers */}
            {pointerL !== undefined && pointerL >= memBaseAddress && pointerL < memBaseAddress + 16 && (
              <motion.div
                className="absolute -top-7 left-0 flex flex-col items-center justify-center w-8 -ml-4"
                animate={{ x: (pointerL - memBaseAddress) * 44 + 36 }} // w-10 = 40px + gap-1 = 4px -> 44px step. 16px (px-4) + 20px (half cell) = 36px
                transition={springTransition}
                style={{ zIndex: 10 }}
              >
                <div className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded shadow mb-1">HL</div>
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-500"></div>
              </motion.div>
            )}
            
            {pointerR !== undefined && pointerR >= memBaseAddress && pointerR < memBaseAddress + 16 && (
              <motion.div
                className="absolute -top-7 left-0 flex flex-col items-center justify-center w-8 -ml-4"
                animate={{ x: (pointerR - memBaseAddress) * 44 + 36 }}
                transition={springTransition}
                style={{ zIndex: 10 }}
              >
                <div className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded shadow mb-1">DE</div>
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-purple-500"></div>
              </motion.div>
            )}

            {/* Memory Cells */}
            {Array.from({ length: 16 }).map((_, i) => {
              const addr = memBaseAddress + i;
              const val = memory[addr] || 0;
              const isActive = activeMemoryAddresses.includes(addr);

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
                    className="w-full aspect-square flex items-center justify-center rounded border font-mono text-sm shadow-sm"
                    animate={{
                      backgroundColor: isActive ? '#f59e0b' : '#27272a',
                      color: isActive ? '#000000' : '#ffffff',
                      borderColor: isActive ? '#f59e0b' : '#3f3f46'
                    }}
                    transition={springTransition}
                  >
                    {toHex(val)}
                  </motion.div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-2 truncate max-w-full">
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
