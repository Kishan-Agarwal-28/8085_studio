'use client';

import React from 'react';
import { motion } from 'motion/react';
import { StatusFlags } from '@/lib/8085/types';

interface FlagRegisterProps {
  flags: StatusFlags;
}

export const FlagRegister: React.FC<FlagRegisterProps> = ({ flags }) => {
  const springTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  };

  const flagList = [
    { key: 's', label: 'S (Sign)', bit: 7, value: flags.s, desc: 'Set if bit 7 of result is 1 (negative)' },
    { key: 'z', label: 'Z (Zero)', bit: 6, value: flags.z, desc: 'Set if operation result is zero' },
    { key: 'ac', label: 'AC (Aux Carry)', bit: 4, value: flags.ac, desc: 'Carry from bit 3 to 4 (BCD math)' },
    { key: 'p', label: 'P (Parity)', bit: 2, value: flags.p, desc: 'Set if even number of 1-bits' },
    { key: 'cy', label: 'CY (Carry)', bit: 0, value: flags.cy, desc: 'Set if carry/borrow occurs' },
  ];

  // Compute PSW lower byte (Flags byte in 8085 PSW format: S Z 0 AC 0 P 1 CY)
  let flagByte = flags.cy ? 1 : 0;
  flagByte |= 1 << 1; // fixed 1
  flagByte |= (flags.p ? 1 : 0) << 2;
  flagByte |= (flags.ac ? 1 : 0) << 4;
  flagByte |= (flags.z ? 1 : 0) << 6;
  flagByte |= (flags.s ? 1 : 0) << 7;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Flag Register (F)
          </h3>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-amber-400">
            PSW Byte: 0x{flagByte.toString(16).padStart(2, '0').toUpperCase()}
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Binary: {flagByte.toString(2).padStart(8, '0')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {flagList.map((f) => {
          const isSet = f.value;
          return (
            <motion.div
              key={f.key}
              layout
              animate={{
                scale: isSet ? 1.05 : 1.0,
                y: isSet ? -4 : 0,
                backgroundColor: isSet ? '#f59e0b' : '#27272a',
              }}
              transition={springTransition}
              className="flex flex-col justify-between rounded-lg p-2.5 border border-zinc-700/50 shadow-sm"
              title={f.desc}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSet ? 'text-zinc-950' : 'text-zinc-300'}`}>
                  {f.label}
                </span>
                <span className={`text-[10px] font-mono ${isSet ? 'text-zinc-900 font-semibold' : 'text-zinc-500'}`}>
                  Bit {f.bit}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1.5">
                <span className={`font-mono text-xl font-black ${isSet ? 'text-zinc-950' : 'text-zinc-500'}`}>
                  {isSet ? '1' : '0'}
                </span>
                <span className={`text-[10px] font-semibold uppercase ${isSet ? 'text-zinc-950' : 'text-zinc-600'}`}>
                  {isSet ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
