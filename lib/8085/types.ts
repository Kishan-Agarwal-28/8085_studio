export type Register8 = 'A' | 'B' | 'C' | 'D' | 'E' | 'H' | 'L' | 'M';
export type Register16 = 'B' | 'D' | 'H' | 'SP' | 'PSW';

export interface StatusFlags {
  s: boolean;  // Sign flag (bit 7)
  z: boolean;  // Zero flag (bit 6)
  ac: boolean; // Auxiliary Carry (bit 4)
  p: boolean;  // Parity (bit 2)
  cy: boolean; // Carry (bit 0)
}

export interface RegisterState {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  H: number;
  L: number;
  W: number;    // Internal Temporary Register W (high byte)
  Z: number;    // Internal Temporary Register Z (low byte)
  TEMP: number; // ALU Temporary Register (second operand)
  PC: number;
  SP: number;
}

export interface AluOperation {
  type: 'CMP' | 'ADD' | 'SUB' | 'ANA' | 'XRA' | 'ORA' | 'INR' | 'DCR' | 'ROT' | 'DAA' | 'CMA';
  name: string;
  operatorSymbol: string;
  operandA: number;
  operandB: number;
  operandBName: string;
  result: number;
  comparisonResult?: string;
  flagsAffected: ('S' | 'Z' | 'AC' | 'P' | 'CY')[];
  explanation: string;
}

export interface DataTransferEvent {
  sourceType: 'register' | 'memory' | 'immediate' | 'stack' | 'io' | 'alu' | 'none';
  sourceName: string;
  sourceAddress?: number;
  destinationType: 'register' | 'memory' | 'stack' | 'io' | 'none';
  destinationName: string;
  destinationAddress?: number;
  value: number;
}

export interface TraceStep {
  stepIndex: number;
  cycle: number;
  address: number;
  line: number;
  instruction: string;
  bytes: number[];
  registers: RegisterState;
  flags: StatusFlags;
  description: string;
  dataTransfer?: DataTransferEvent;
  aluOperation?: AluOperation;
  // Pointers for algorithm visualizer (e.g. array two-pointer algorithms)
  pointerL?: number; // memory address or array index
  pointerR?: number; // memory address or array index
  activeRegisters: string[];
  activeMemoryAddresses: number[];
  memoryDelta?: { address: number; oldValue: number; newValue: number }[];
  isHalt?: boolean;
}

export interface CompileDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface CompileResult {
  success: boolean;
  diagnostics: CompileDiagnostic[];
  machineCode: Uint8Array;
  startAddress: number;
  labels: Record<string, number>;
  lineAddressMap: Map<number, number>; // line -> address
  addressLineMap: Map<number, number>; // address -> line
  hexDump: string;
  wasmBinary?: Uint8Array;
}

export interface SimulationResult {
  success: boolean;
  steps: TraceStep[];
  error?: string;
  totalCycles: number;
  finalRegisters: RegisterState;
  finalFlags: StatusFlags;
  memory: Uint8Array;
}
