import { CompileResult, SimulationResult, TraceStep } from './8085/types';
import { Assembler8085 } from './8085/assembler';
import { WasmCompiler8085 } from './8085/wasm-compiler';
import { CPU8085 } from './8085/cpu';

export class WorkerClient {
  private static swRegistered = false;
  private static worker: Worker | null = null;

  public static registerServiceWorker(): void {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !this.swRegistered) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[8085 SW] Service worker registered with scope:', reg.scope);
          this.swRegistered = true;
        })
        .catch((err) => {
          console.warn('[8085 SW] Service worker registration error:', err);
        });
    }
  }

  /**
   * Step 1: Compile 8085 source code
   * Checks syntax errors, generates symbol table, machine code, and WebAssembly (.wasm) binary.
   */
  public static compile(source: string): CompileResult {
    const assembler = new Assembler8085();
    const result = assembler.assemble(source);

    if (result.success && result.machineCode.length > 0) {
      try {
        const wasm = WasmCompiler8085.compile(result.machineCode, result.startAddress);
        result.wasmBinary = wasm;
      } catch (e) {
        console.error('WASM compilation failed:', e);
      }
    }

    return result;
  }

  /**
   * Step 2: Run simulation and generate micro-step trace
   */
  public static simulate(
    compileResult: CompileResult,
    initialMemory?: { address: number; values: number[] }[],
    maxSteps = 3000
  ): SimulationResult {
    const cpu = new CPU8085();

    // 1. Load initial memory if any (e.g. array data)
    if (initialMemory) {
      for (const block of initialMemory) {
        for (let i = 0; i < block.values.length; i++) {
          cpu.memory[(block.address + i) & 0xFFFF] = block.values[i];
        }
      }
    }

    // 2. Load compiled program
    cpu.loadProgram(compileResult.startAddress, compileResult.machineCode);

    // 3. Simulate and collect all execution steps
    const steps: TraceStep[] = cpu.simulate(compileResult.addressLineMap, maxSteps);

    return {
      success: true,
      steps,
      totalCycles: cpu.getCycles(),
      finalRegisters: cpu.getRegisterState(),
      finalFlags: cpu.getFlags(),
      memory: new Uint8Array(cpu.memory),
    };
  }
}
