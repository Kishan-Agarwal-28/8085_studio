'use client';

import React from 'react';
import { motion } from 'motion/react';
import { RegisterState } from '@/lib/8085/types';

interface RegisterBankProps {
  registers: RegisterState;
  activeRegisters: string[];
}

export const RegisterBank: React.FC<RegisterBankProps> = ({
  registers,
  activeRegisters,
}) => {
  // Spring transition per user specs: stiffness 300, damping 30
  const springTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  };

  const regPairs = [
    {
      pairName: 'B-C Pair',
      val16: ((registers.B << 8) | registers.C).toString(16).padStart(4, '0').toUpperCase(),
      items: [
        { name: 'B', value: registers.B },
        { name: 'C', value: registers.C },
      ],
    },
    {
      pairName: 'D-E Pair (R Pointer)',
      val16: ((registers.D << 8) | registers.E).toString(16).padStart(4, '0').toUpperCase(),
      items: [
        { name: 'D', value: registers.D },
        { name: 'E', value: registers.E },
      ],
    },
    {
      pairName: 'H-L Pair (L Pointer / M)',
      val16: ((registers.H << 8) | registers.L).toString(16).padStart(4, '0').toUpperCase(),
      items: [
        { name: 'H', value: registers.H },
        { name: 'L', value: registers.L },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Internal Registers
        </h3>
        <span className="text-[11px] font-mono text-zinc-500">8085 8-Bit Architecture</span>
      </div>

      {/* Row 1: Accumulator (A) and Special Registers (PC, SP) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Accumulator Card */}
        {(() => {
          const isActive = activeRegisters.includes('A');
          return (
            <motion.div
              layout
              animate={{
                scale: isActive ? 1.05 : 1.0,
                y: isActive ? -4 : 0,
                backgroundColor: isActive ? '#f59e0b' : '#27272a',
              }}
              transition={springTransition}
              className="flex flex-col justify-between rounded-xl p-3 border border-zinc-700/60 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isActive ? 'text-zinc-950' : 'text-amber-400'}`}>
                  Accumulator (A)
                </span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
                  8-bit AL-Reg
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className={`font-mono text-2xl font-black ${isActive ? 'text-zinc-950' : 'text-white'}`}>
                  0x{registers.A.toString(16).padStart(2, '0').toUpperCase()}
                </span>
                <span className={`font-mono text-xs ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {registers.A} dec
                </span>
              </div>
              {/* Binary bits */}
              <div className="mt-2 flex gap-1 justify-between font-mono text-[10px]">
                {Array.from({ length: 8 }).map((_, i) => {
                  const bit = (registers.A >> (7 - i)) & 1;
                  return (
                    <span
                      key={i}
                      className={`flex h-4 w-4 items-center justify-center rounded font-bold ${
                        isActive
                          ? bit === 1
                            ? 'bg-zinc-950 text-amber-300'
                            : 'bg-zinc-900/40 text-zinc-800'
                          : bit === 1
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-600'
                      }`}
                    >
                      {bit}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {/* Program Counter (PC) */}
        {(() => {
          const isActive = activeRegisters.includes('PC');
          return (
            <motion.div
              layout
              animate={{
                scale: isActive ? 1.05 : 1.0,
                y: isActive ? -4 : 0,
                backgroundColor: isActive ? '#f59e0b' : '#27272a',
              }}
              transition={springTransition}
              className="flex flex-col justify-between rounded-xl p-3 border border-zinc-700/60 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isActive ? 'text-zinc-950' : 'text-cyan-400'}`}>
                  Program Counter (PC)
                </span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  16-bit
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className={`font-mono text-2xl font-black ${isActive ? 'text-zinc-950' : 'text-white'}`}>
                  0x{registers.PC.toString(16).padStart(4, '0').toUpperCase()}
                </span>
                <span className={`font-mono text-xs ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {registers.PC} dec
                </span>
              </div>
              <div className={`mt-2 text-[10px] font-mono ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`}>
                Current Instruction Pointer
              </div>
            </motion.div>
          );
        })()}

        {/* Stack Pointer (SP) */}
        {(() => {
          const isActive = activeRegisters.includes('SP');
          return (
            <motion.div
              layout
              animate={{
                scale: isActive ? 1.05 : 1.0,
                y: isActive ? -4 : 0,
                backgroundColor: isActive ? '#f59e0b' : '#27272a',
              }}
              transition={springTransition}
              className="flex flex-col justify-between rounded-xl p-3 border border-zinc-700/60 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${isActive ? 'text-zinc-950' : 'text-emerald-400'}`}>
                  Stack Pointer (SP)
                </span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  16-bit
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className={`font-mono text-2xl font-black ${isActive ? 'text-zinc-950' : 'text-white'}`}>
                  0x{registers.SP.toString(16).padStart(4, '0').toUpperCase()}
                </span>
                <span className={`font-mono text-xs ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {registers.SP} dec
                </span>
              </div>
              <div className={`mt-2 text-[10px] font-mono ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`}>
                Stack Top Memory Address
              </div>
            </motion.div>
          );
        })()}
      </div>

      {/* Row 2: General Purpose Register Pairs (BC, DE, HL) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {regPairs.map((pair) => (
          <div
            key={pair.pairName}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-zinc-800/80 pb-1">
              <span className="font-semibold text-zinc-300">{pair.pairName}</span>
              <span className="text-zinc-500">Pair: 0x{pair.val16}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {pair.items.map((r) => {
                const isActive = activeRegisters.includes(r.name);
                return (
                  <motion.div
                    key={r.name}
                    layout
                    animate={{
                      scale: isActive ? 1.05 : 1.0,
                      y: isActive ? -4 : 0,
                      backgroundColor: isActive ? '#f59e0b' : '#27272a',
                    }}
                    transition={springTransition}
                    className="flex flex-col justify-between rounded-lg p-2.5 border border-zinc-700/50 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isActive ? 'text-zinc-950' : 'text-amber-400'}`}>
                        Reg {r.name}
                      </span>
                      <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        8-bit
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1.5">
                      <span className={`font-mono text-lg font-bold ${isActive ? 'text-zinc-950' : 'text-white'}`}>
                        0x{r.value.toString(16).padStart(2, '0').toUpperCase()}
                      </span>
                      <span className={`font-mono text-[11px] ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {r.value}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
