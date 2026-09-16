'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  FastForward,
} from 'lucide-react';

interface PlaybackControlsProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onReset: () => void;
  onJumpToStep: (step: number) => void;
  onChangeSpeed: (speed: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onReset,
  onJumpToStep,
  onChangeSpeed,
}) => {
  // Keyboard navigation hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onNextStep();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onPrevStep();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onNextStep, onPrevStep, onReset]);

  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      {/* Step Timeline / Scrubber */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-zinc-400 w-12 text-right">
          {totalSteps > 0 ? currentStep + 1 : 0}
        </span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStep}
            disabled={totalSteps === 0}
            onChange={(e) => onJumpToStep(parseInt(e.target.value, 10))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500 transition hover:bg-zinc-700 disabled:opacity-50"
          />
        </div>
        <span className="font-mono text-xs text-zinc-500 w-12">
          {totalSteps}
        </span>
      </div>

      {/* Button Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-850">
        <div className="flex items-center gap-1.5">
          {/* Reset */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onReset}
            disabled={totalSteps === 0 || currentStep === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            title="Reset to Step 0 (R)"
          >
            <RotateCcw className="h-4 w-4" />
          </motion.button>

          {/* Previous Step */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onPrevStep}
            disabled={totalSteps === 0 || currentStep === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            title="Previous Step (Left Arrow)"
          >
            <SkipBack className="h-3.5 w-3.5" />
            <span>Prev</span>
          </motion.button>

          {/* Play / Pause Toggle */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onTogglePlay}
            disabled={totalSteps === 0}
            className={`flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold shadow-md transition disabled:opacity-40 ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                : 'bg-zinc-100 text-zinc-900 hover:bg-white'
            }`}
            title="Toggle Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Play</span>
              </>
            )}
          </motion.button>

          {/* Next Step */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onNextStep}
            disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            title="Next Step (Right Arrow)"
          >
            <span>Next</span>
            <SkipForward className="h-3.5 w-3.5" />
          </motion.button>

          {/* Jump to End */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onJumpToStep(Math.max(0, totalSteps - 1))}
            disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            title="Jump to End"
          >
            <FastForward className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase px-1.5">Speed</span>
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`rounded px-2 py-0.5 font-mono text-xs transition ${
                speed === s
                  ? 'bg-amber-500 font-bold text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
