'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, Layers, MapPin } from 'lucide-react';

interface MemoryViewProps {
  memory: Uint8Array;
  activeAddresses: number[];
  pointerL?: number; // e.g. from HL
  pointerR?: number; // e.g. from DE
  baseAddress?: number; // e.g. 0x2050
  viewSize?: number; // e.g. 10 or 16 elements
  onSelectBaseAddress?: (addr: number) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  memory,
  activeAddresses,
  pointerL,
  pointerR,
  baseAddress = 0x2050,
  viewSize = 10,
  onSelectBaseAddress,
}) => {
  // Spring transition per user specs: stiffness 300, damping 30
  const springTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  };

  // Generate array cells for the viewed segment
  const cells = useMemo(() => {
    const list: { address: number; value: number; index: number }[] = [];
    for (let i = 0; i < viewSize; i++) {
      const addr = (baseAddress + i) & 0xFFFF;
      list.push({
        address: addr,
        value: memory[addr] || 0,
        index: i,
      });
    }
    return list;
  }, [memory, baseAddress, viewSize]);

  // Calculate pointer indices relative to current base address
  const lIndex = pointerL !== undefined && pointerL >= baseAddress && pointerL < baseAddress + viewSize
    ? pointerL - baseAddress
    : null;

  const rIndex = pointerR !== undefined && pointerR >= baseAddress && pointerR < baseAddress + viewSize
    ? pointerR - baseAddress
    : null;

  // Preset segments for quick navigation
  const segments = [
    { label: 'Array (2050H)', addr: 0x2050 },
    { label: 'Dest (2060H)', addr: 0x2060 },
    { label: 'Code (2000H)', addr: 0x2000 },
    { label: 'Stack (20E0H)', addr: 0x20e0 },
  ];

  // Width in pixels of each memory cell + gap for translateX calculations
  // Each cell is roughly 76px wide, with 8px gap => stride = 84px
  const cellStride = 88; // 80px cell + 8px gap

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      {/* Header with segment selection */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-850 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Memory &amp; Array Visualizer
          </h3>
          <span className="font-mono text-xs text-zinc-500">
            Base: 0x{baseAddress.toString(16).padStart(4, '0').toUpperCase()}H
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {segments.map((seg) => (
            <button
              key={seg.label}
              onClick={() => onSelectBaseAddress?.(seg.addr)}
              className={`rounded-md px-2.5 py-1 text-xs font-mono transition ${
                baseAddress === seg.addr
                  ? 'bg-amber-500 font-bold text-zinc-950'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pointer Track and Array View Area */}
      <div className="relative overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50 hover:scrollbar-thumb-zinc-500 pb-4 pt-8 px-2 select-none">
        {/* Pointer Markers Track (L & R Markers) */}
        <div className="absolute top-1 left-2 h-7 w-full pointer-events-none">
          {/* 'L' Pointer Marker */}
          {lIndex !== null && (
            <motion.div
              initial={false}
              animate={{
                x: lIndex * cellStride + 14,
              }}
              transition={springTransition}
              className="absolute flex flex-col items-center"
            >
              <div className="flex items-center gap-1 rounded-md bg-cyan-500 px-2 py-0.5 text-[11px] font-black text-zinc-950 shadow-md">
                <MapPin className="h-3 w-3" />
                <span>L (HL)</span>
              </div>
              <ArrowDown className="h-3.5 w-3.5 text-cyan-400 -mt-0.5 animate-bounce" />
            </motion.div>
          )}

          {/* 'R' Pointer Marker */}
          {rIndex !== null && (
            <motion.div
              initial={false}
              animate={{
                x: rIndex * cellStride + 36,
              }}
              transition={springTransition}
              className="absolute flex flex-col items-center"
            >
              <div className="flex items-center gap-1 rounded-md bg-pink-500 px-2 py-0.5 text-[11px] font-black text-white shadow-md">
                <MapPin className="h-3 w-3" />
                <span>R (DE)</span>
              </div>
              <ArrowDown className="h-3.5 w-3.5 text-pink-400 -mt-0.5 animate-bounce" />
            </motion.div>
          )}
        </div>

        {/* Array Elements with layout prop (FLIP technique) */}
        <div className="flex items-center gap-2 min-w-max">
          {cells.map((cell) => {
            const isActive = activeAddresses.includes(cell.address);
            const isPointerL = pointerL === cell.address;
            const isPointerR = pointerR === cell.address;

            return (
              <motion.div
                key={cell.address}
                layout
                animate={{
                  scale: isActive ? 1.05 : 1.0,
                  y: isActive ? -4 : 0,
                  backgroundColor: isActive ? '#f59e0b' : '#27272a',
                }}
                transition={springTransition}
                className={`flex flex-col items-center justify-between rounded-xl p-2.5 shadow-md border w-20 h-24 ${
                  isPointerL && isPointerR
                    ? 'ring-2 ring-purple-400 border-purple-400'
                    : isPointerL
                    ? 'ring-2 ring-cyan-400 border-cyan-400'
                    : isPointerR
                    ? 'ring-2 ring-pink-400 border-pink-400'
                    : 'border-zinc-700/60'
                }`}
              >
                {/* Cell Address Header */}
                <div className="flex flex-col items-center">
                  <span className={`font-mono text-[10px] font-semibold ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`}>
                    0x{cell.address.toString(16).toUpperCase()}
                  </span>
                  <span className={`text-[9px] font-mono ${isActive ? 'text-zinc-800' : 'text-zinc-500'}`}>
                    [{cell.index}]
                  </span>
                </div>

                {/* Cell Byte Value */}
                <div className="flex flex-col items-center my-auto">
                  <span className={`font-mono text-xl font-black ${isActive ? 'text-zinc-950' : 'text-white'}`}>
                    {cell.value.toString(16).padStart(2, '0').toUpperCase()}H
                  </span>
                  <span className={`font-mono text-[10px] ${isActive ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    {cell.value}
                  </span>
                </div>

                {/* Bottom Pointer Tags */}
                <div className="flex items-center gap-1">
                  {isPointerL && (
                    <span className="rounded bg-cyan-400/30 text-cyan-200 px-1 py-0.2 text-[8px] font-bold">
                      L
                    </span>
                  )}
                  {isPointerR && (
                    <span className="rounded bg-pink-400/30 text-pink-200 px-1 py-0.2 text-[8px] font-bold">
                      R
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend & Pointer Status Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-850 pt-2 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span>Pointer L: {pointerL ? `0x${pointerL.toString(16).toUpperCase()}H` : 'None'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
            <span>Pointer R: {pointerR ? `0x${pointerR.toString(16).toUpperCase()}H` : 'None'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-amber-500" /> Active
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-zinc-700" /> Neutral
          </span>
        </div>
      </div>
    </div>
  );
};
