'use client';

import React from 'react';
import { CompileResult } from '@/lib/8085/types';
import { Binary, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface WasmHexViewerProps {
  compileResult?: CompileResult;
  totalCycles?: number;
}

export const WasmHexViewer: React.FC<WasmHexViewerProps> = ({
  compileResult,
  totalCycles = 0,
}) => {
  const handleDownloadWasm = () => {
    if (!compileResult?.wasmBinary) return;
    const blob = new Blob([compileResult.wasmBinary as unknown as BlobPart], { type: 'application/wasm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program_8085.wasm';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBin = () => {
    if (!compileResult?.machineCode) return;
    const blob = new Blob([compileResult.machineCode as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program_8085.bin';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <div className="flex items-center gap-2">
          <Binary className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            WASM &amp; Machine Code Output
          </h3>
        </div>

        {compileResult?.success ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Compilation Succeeded</span>
          </div>
        ) : compileResult ? (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Errors Found</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">Awaiting compilation</span>
        )}
      </div>

      {compileResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">Start Address</span>
            <span className="text-zinc-200 font-bold">
              0x{compileResult.startAddress.toString(16).toUpperCase()}H
            </span>
          </div>
          <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">Binary Size</span>
            <span className="text-zinc-200 font-bold">{compileResult.machineCode.length} bytes</span>
          </div>
          <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">WASM Module</span>
            <span className="text-amber-400 font-bold">
              {compileResult.wasmBinary ? `${compileResult.wasmBinary.length} bytes` : 'N/A'}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-800">
            <span className="text-zinc-500 block text-[10px]">Total T-States</span>
            <span className="text-zinc-200 font-bold">{totalCycles} Cycles</span>
          </div>
        </div>
      )}

      {/* Hex Dump Code Box */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Hex Dump &amp; Assembly Disassembly
          </span>
          <div className="flex items-center gap-2">
            {compileResult?.wasmBinary && (
              <button
                onClick={handleDownloadWasm}
                className="flex items-center gap-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono transition"
              >
                <Download className="h-3 w-3" />
                <span>Download .wasm</span>
              </button>
            )}
            {compileResult?.machineCode && (
              <button
                onClick={handleDownloadBin}
                className="flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-2 py-0.5 text-[11px] font-mono transition"
              >
                <Download className="h-3 w-3" />
                <span>Download .bin</span>
              </button>
            )}
          </div>
        </div>

        <pre className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950/60 hover:scrollbar-thumb-zinc-500 rounded-lg bg-black/90 p-3 font-mono text-xs text-emerald-400 border border-zinc-850 select-text leading-relaxed">
          {compileResult?.hexDump || '; Compile your code to view the opcode hex dump'}
        </pre>
      </div>

      {/* Symbol Table */}
      {compileResult && Object.keys(compileResult.labels).length > 0 && (
        <div className="flex flex-col gap-1 border-t border-zinc-850 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Resolved Symbols &amp; Labels
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {Object.entries(compileResult.labels).map(([label, addr]) => (
              <span
                key={label}
                className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300"
              >
                <span className="text-purple-400 font-bold">{label}:</span>{' '}
                <span className="text-amber-400">0x{addr.toString(16).toUpperCase()}H</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
