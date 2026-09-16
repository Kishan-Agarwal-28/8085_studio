'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DataTransferEvent } from '@/lib/8085/types';
import { ArrowRight, MoveRight, Sparkles } from 'lucide-react';

interface DataFlowOverlayProps {
  dataTransfer?: DataTransferEvent;
  currentStep: number;
}

export const DataFlowOverlay: React.FC<DataFlowOverlayProps> = ({
  dataTransfer,
  currentStep,
}) => {
  const springTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  };

  if (!dataTransfer || dataTransfer.sourceType === 'none') {
    return null;
  }

  const hexVal = `0x${dataTransfer.value.toString(16).padStart(2, '0').toUpperCase()}H`;
  const binVal = dataTransfer.value.toString(2).padStart(8, '0');

  // Determine transfer category
  let categoryLabel = 'Data Transfer';
  let badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  if (dataTransfer.sourceType === 'register' && dataTransfer.destinationType === 'register') {
    categoryLabel = 'Register ➔ Register Transfer';
    badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  } else if (dataTransfer.sourceType === 'memory' || dataTransfer.sourceName.includes('M')) {
    categoryLabel = 'Memory Read ➔ Register';
    badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  } else if (dataTransfer.destinationType === 'memory' || dataTransfer.destinationName.includes('M')) {
    categoryLabel = 'Register Write ➔ Memory';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  } else if (dataTransfer.sourceType === 'immediate') {
    categoryLabel = 'Immediate Load ➔ Register';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  } else if (dataTransfer.sourceType === 'stack' || dataTransfer.destinationType === 'stack') {
    categoryLabel = 'Stack Operation (Push / Pop)';
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 p-3.5 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Active Bus &amp; Data Motion
          </span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium ${badgeColor}`}>
          {categoryLabel}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={springTransition}
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          {/* Source Node */}
          <div className="flex-1 flex items-center gap-3 w-full sm:w-auto bg-zinc-900/90 rounded-lg p-2.5 border border-zinc-700/60 shadow-inner">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-xs font-mono font-bold text-zinc-300">
              SRC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-100">
                {dataTransfer.sourceName}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Type: {dataTransfer.sourceType.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Animated Traveling Data Packet */}
          <div className="flex items-center gap-2 px-3 py-1">
            <ArrowRight className="h-4 w-4 text-zinc-600 hidden sm:block" />

            <motion.div
              layout
              initial={{ scale: 0.8, x: -15 }}
              animate={{ scale: 1.05, x: 0 }}
              transition={springTransition}
              className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-zinc-950 font-black shadow-lg shadow-amber-500/20"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono tracking-wide">{hexVal}</span>
                <span className="text-[11px] font-mono opacity-80">({dataTransfer.value})</span>
              </div>
              <span className="font-mono text-[9px] opacity-75">{binVal}</span>
            </motion.div>

            <MoveRight className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>

          {/* Destination Node */}
          <div className="flex-1 flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto bg-zinc-900/90 rounded-lg p-2.5 border border-amber-500/40 shadow-inner">
            <div className="flex flex-col sm:text-right">
              <span className="text-xs font-bold text-amber-300">
                {dataTransfer.destinationName}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Type: {dataTransfer.destinationType.toUpperCase()}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/20 text-xs font-mono font-bold text-amber-400 border border-amber-500/30">
              DST
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
