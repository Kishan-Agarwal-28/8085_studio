'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TraceStep, RegisterState } from '@/lib/8085/types';
import { StepDescription } from './StepDescription';
import { PlaybackControls } from './PlaybackControls';
import { RegisterBank } from './RegisterBank';
import { FlagRegister } from './FlagRegister';
import { MemoryView } from './MemoryView';
import { DataFlowOverlay } from './DataFlowOverlay';

interface AlgorithmVisualizerProps {
  steps: TraceStep[];
  memory: Uint8Array;
  currentStep: number;
  onStepChange: (stepIndex: number | ((prev: number) => number)) => void;
  baseAddress?: number;
}

export const AlgorithmVisualizer: React.FC<AlgorithmVisualizerProps> = ({
  steps,
  memory,
  currentStep,
  onStepChange,
  baseAddress = 0x2050,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [viewBaseAddress, setViewBaseAddress] = useState<number>(baseAddress);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync base address when preset changes
  useEffect(() => {
    setViewBaseAddress(baseAddress);
  }, [baseAddress]);

  // Current active step snapshot
  const activeStep = steps.length > 0 && currentStep < steps.length ? steps[currentStep] : undefined;

  // Handle Play / Pause interval
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(100, Math.floor(650 / speed));
      timerRef.current = setInterval(() => {
        onStepChange((prev: number) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, speed, steps.length, onStepChange]);

  const handleTogglePlay = () => {
    if (steps.length === 0) return;
    if (currentStep >= steps.length - 1) {
      // Loop or restart from step 0
      onStepChange(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleNextStep = () => {
    setIsPlaying(false);
    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    setIsPlaying(false);
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    onStepChange(0);
  };

  const handleJumpToStep = (step: number) => {
    setIsPlaying(false);
    const clamped = Math.max(0, Math.min(steps.length - 1, step));
    onStepChange(clamped);
  };

  const currentRegisters: RegisterState = activeStep?.registers || {
    A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, W: 0, Z: 0, TEMP: 0, PC: 0x2000, SP: 0xFFFF,
  };

  const currentFlags = activeStep?.flags || {
    s: false, z: false, ac: false, p: false, cy: false,
  };

  const activeRegisters = activeStep?.activeRegisters || [];
  const activeMemoryAddresses = activeStep?.activeMemoryAddresses || [];

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* 1. Step Description with Fade + translateY animation */}
      <StepDescription
        currentStep={currentStep}
        step={activeStep}
        totalSteps={steps.length}
      />

      {/* 2. Live Data Movement Token Overlay */}
      {activeStep?.dataTransfer && (
        <DataFlowOverlay
          dataTransfer={activeStep.dataTransfer}
          currentStep={currentStep}
        />
      )}

      {/* 3. Playback Controls with Spring Response */}
      <PlaybackControls
        currentStep={currentStep}
        totalSteps={steps.length}
        isPlaying={isPlaying}
        speed={speed}
        onTogglePlay={handleTogglePlay}
        onNextStep={handleNextStep}
        onPrevStep={handlePrevStep}
        onReset={handleReset}
        onJumpToStep={handleJumpToStep}
        onChangeSpeed={setSpeed}
      />

      {/* 4. Registers with Gold Highlight & Spring Physics */}
      <RegisterBank
        registers={currentRegisters}
        activeRegisters={activeRegisters}
      />

      {/* 5. Flag Register */}
      <FlagRegister flags={currentFlags} />

      {/* 6. Memory View with Layout Projections and L & R Markers */}
      <MemoryView
        memory={memory}
        activeAddresses={activeMemoryAddresses}
        pointerL={activeStep?.pointerL}
        pointerR={activeStep?.pointerR}
        baseAddress={viewBaseAddress}
        viewSize={10}
        onSelectBaseAddress={setViewBaseAddress}
      />
    </div>
  );
};
