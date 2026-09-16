'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TraceStep } from '@/lib/8085/types';
import { ArrowRight, Cpu, Zap, Database } from 'lucide-react';

interface StepDescriptionProps {
  currentStep: number;
  step?: TraceStep;
  totalSteps: number;
}

export const StepDescription: React.FC<StepDescriptionProps> = ({
  currentStep,
  step,
  totalSteps,
}) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Execution Step
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-amber-400">
            {totalSteps > 0 ? currentStep + 1 : 0} / {totalSteps}
          </span>
        </div>

        {step && (
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-zinc-500">
              PC: <span className="text-zinc-300">0x{step.address.toString(16).padStart(4, '0').toUpperCase()}H</span>
            </span>
            <span className="text-zinc-500">
              Cycles: <span className="text-amber-400">+{step.cycle}</span>
            </span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="space-y-2"
        >
          {step ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-500/20 px-2.5 py-1 font-mono text-sm font-bold text-amber-300 border border-amber-500/30">
                  {step.instruction}
                </span>

                <span className="font-mono text-xs text-zinc-500">
                  [{step.bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}]
                </span>

                {step.dataTransfer && (
                  <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-3 py-0.5 text-xs font-mono text-zinc-300">
                    <Database className="h-3 w-3 text-amber-400" />
                    <span>{step.dataTransfer.sourceName}</span>
                    <ArrowRight className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-300 font-semibold">{step.dataTransfer.destinationName}</span>
                    <span className="text-zinc-500 ml-1">
                      (val: 0x{step.dataTransfer.value.toString(16).padStart(2, '0').toUpperCase()})
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-zinc-200">
                {step.description}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Zap className="h-4 w-4" />
              <span>Ready. Click &quot;Run&quot; or step forward to start simulation.</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
