import { RegisterState, StatusFlags, TraceStep, DataTransferEvent, AluOperation } from './types';
import { getOpcodeSpec } from './opcodes';

export class CPU8085 {
  // Registers
  private A = 0;
  private B = 0;
  private C = 0;
  private D = 0;
  private E = 0;
  private H = 0;
  private L = 0;
  private W = 0;    // Internal Temporary Register W
  private Z = 0;    // Internal Temporary Register Z
  private TEMP = 0; // ALU Temporary Register
  private PC = 0x2000;
  private SP = 0xFFFF;

  // Status flags
  private flags: StatusFlags = {
    s: false,
    z: false,
    ac: false,
    p: false,
    cy: false,
  };

  // Interrupt & Serial I/O system state
  private interruptEnable = false; // IE flip-flop (set by EI, cleared by DI)
  private mask5_5 = false;         // RST 5.5 mask
  private mask6_5 = false;         // RST 6.5 mask
  private mask7_5 = false;         // RST 7.5 mask
  private pending5_5 = false;      // RST 5.5 interrupt pending
  private pending6_5 = false;      // RST 6.5 interrupt pending
  private pending7_5 = false;      // RST 7.5 interrupt pending
  private pendingTrap = false;     // TRAP interrupt pending (NMI)
  private pendingINTR = false;     // INTR interrupt pending (non-vectored)
  private sod = false;             // Serial Output Data
  private sid = false;             // Serial Input Data
  private flagV = false;           // Undocumented Overflow flag (bit 1 of PSW)
  private flagK = false;           // Undocumented K flag (bit 5 of PSW)

  // 64KB Linear Memory
  public memory = new Uint8Array(65536);
  // 256 I/O Ports
  public ioPorts = new Uint8Array(256);

  private halted = false;
  private waitingForInterrupt = false;
  private totalCycles = 0;

  constructor() {
    this.reset();
  }

  public reset(startAddress = 0x2000): void {
    this.A = 0;
    this.B = 0;
    this.C = 0;
    this.D = 0;
    this.E = 0;
    this.H = 0;
    this.L = 0;
    this.W = 0;
    this.Z = 0;
    this.TEMP = 0;
    this.PC = startAddress;
    this.SP = 0xFFFF;
    this.flags = { s: false, z: false, ac: false, p: false, cy: false };
    this.interruptEnable = false;
    this.mask5_5 = false;
    this.mask6_5 = false;
    this.mask7_5 = false;
    this.pending5_5 = false;
    this.pending6_5 = false;
    this.pending7_5 = false;
    this.pendingTrap = false;
    this.pendingINTR = false;
    this.sod = false;
    this.sid = false;
    this.flagV = false;
    this.flagK = false;
    this.halted = false;
    this.waitingForInterrupt = false;
    this.totalCycles = 0;
  }

  public loadProgram(startAddress: number, machineCode: Uint8Array, entryAddress?: number): void {
    for (let i = 0; i < machineCode.length; i++) {
      this.memory[(startAddress + i) & 0xFFFF] = machineCode[i];
    }
    this.PC = entryAddress !== undefined ? entryAddress : startAddress;
  }

  public getRegisterState(): RegisterState {
    return {
      A: this.A,
      B: this.B,
      C: this.C,
      D: this.D,
      E: this.E,
      H: this.H,
      L: this.L,
      W: this.W,
      Z: this.Z,
      TEMP: this.TEMP,
      PC: this.PC,
      SP: this.SP,
    };
  }

  public getFlags(): StatusFlags {
    return { ...this.flags };
  }

  public isHalted(): boolean {
    return this.halted;
  }

  public isWaitingForInterrupt(): boolean {
    return this.waitingForInterrupt;
  }

  public getCycles(): number {
    return this.totalCycles;
  }

  /**
   * Signal a hardware interrupt on the given pin.
   * For RST 7.5 (edge-triggered), this latches the D flip-flop.
   * For RST 6.5, RST 5.5, and INTR (level-triggered), this sets pending.
   * TRAP is non-maskable and always fires.
   */
  public triggerInterrupt(type: 'TRAP' | 'RST7.5' | 'RST6.5' | 'RST5.5' | 'INTR'): void {
    switch (type) {
      case 'TRAP':
        // TRAP is edge+level triggered, non-maskable — handled immediately
        // We set a flag; serviceInterrupt will process it
        this.pendingTrap = true;
        break;
      case 'RST7.5':
        this.pending7_5 = true;
        break;
      case 'RST6.5':
        this.pending6_5 = true;
        break;
      case 'RST5.5':
        this.pending5_5 = true;
        break;
      case 'INTR':
        this.pendingINTR = true;
        break;
    }
    // Un-halt the CPU so it can service the interrupt
    if (this.halted) {
      this.halted = false;
    }
  }

  /**
   * Check and service pending interrupts in priority order.
   * Returns a TraceStep if an interrupt was serviced, null otherwise.
   * This should be called between instruction executions.
   */
  public serviceInterrupt(stepIndex: number, addressLineMap: Map<number, number>): TraceStep | null {
    let vectorAddr: number | null = null;
    let intName = '';

    // Priority 1: TRAP (non-maskable)
    if (this.pendingTrap) {
      this.pendingTrap = false;
      vectorAddr = 0x0024;
      intName = 'TRAP';
    }
    // Priority 2: RST 7.5 (edge-triggered, latched)
    else if (this.interruptEnable && !this.mask7_5 && this.pending7_5) {
      this.pending7_5 = false; // Clear the latch
      vectorAddr = 0x003C;
      intName = 'RST 7.5';
    }
    // Priority 3: RST 6.5 (level-sensitive)
    else if (this.interruptEnable && !this.mask6_5 && this.pending6_5) {
      this.pending6_5 = false;
      vectorAddr = 0x0034;
      intName = 'RST 6.5';
    }
    // Priority 4: RST 5.5 (level-sensitive)
    else if (this.interruptEnable && !this.mask5_5 && this.pending5_5) {
      this.pending5_5 = false;
      vectorAddr = 0x002C;
      intName = 'RST 5.5';
    }
    // Priority 5: INTR (non-vectored, but for simulation we assume RST 7 at 0x0038)
    else if (this.interruptEnable && this.pendingINTR) {
      this.pendingINTR = false;
      vectorAddr = 0x0038; // Simulated as RST 7
      intName = 'INTR';
    }

    if (vectorAddr === null) return null;

    const instructionAddress = this.PC;
    const line = addressLineMap.get(instructionAddress) || 1;

    // Push PC onto stack (exactly like CALL)
    this.SP = (this.SP - 1) & 0xFFFF;
    this.memory[this.SP] = (this.PC >> 8) & 0xFF; // PCH
    this.SP = (this.SP - 1) & 0xFFFF;
    this.memory[this.SP] = this.PC & 0xFF;         // PCL

    // Disable interrupts (INTE flip-flop reset)
    this.interruptEnable = false;

    // Vector to ISR
    this.PC = vectorAddr;

    this.totalCycles += 12; // Interrupt acknowledge takes ~12 T-states

    return {
      stepIndex,
      cycle: this.totalCycles,
      address: instructionAddress,
      line,
      instruction: `INT ${intName}`,
      bytes: [],
      registers: this.getRegisterState(),
      flags: this.getFlags(),
      description: `Hardware Interrupt ${intName} acknowledged: PC pushed to stack [SP=0x${this.SP.toString(16).toUpperCase().padStart(4, '0')}H], INTE=0, vectoring to ISR at 0x${vectorAddr.toString(16).toUpperCase().padStart(4, '0')}H`,
      activeRegisters: ['PC', 'SP'],
      activeMemoryAddresses: [this.SP, (this.SP + 1) & 0xFFFF, vectorAddr],
      memoryDelta: [
        { address: this.SP, oldValue: 0, newValue: this.PC & 0xFF },
        { address: (this.SP + 1) & 0xFFFF, oldValue: 0, newValue: (this.PC >> 8) & 0xFF },
      ],
      isHalt: false,
      interruptStatus: {
        enabled: this.interruptEnable,
        mask7_5: this.mask7_5,
        mask6_5: this.mask6_5,
        mask5_5: this.mask5_5,
        pending7_5: this.pending7_5,
        pending6_5: this.pending6_5,
        pending5_5: this.pending5_5,
      },
    };
  }

  // Register Pair Helpers
  private getBC(): number { return ((this.B << 8) | this.C) & 0xFFFF; }
  private setBC(val: number): void {
    this.B = (val >> 8) & 0xFF;
    this.C = val & 0xFF;
  }

  private getDE(): number { return ((this.D << 8) | this.E) & 0xFFFF; }
  private setDE(val: number): void {
    this.D = (val >> 8) & 0xFF;
    this.E = val & 0xFF;
  }

  private getHL(): number { return ((this.H << 8) | this.L) & 0xFFFF; }
  private setHL(val: number): void {
    this.H = (val >> 8) & 0xFF;
    this.L = val & 0xFF;
  }

  private getPSW(): number {
    let psw = this.flags.cy ? 1 : 0;
    psw |= 1 << 1; // Bit 1 is always 1 in standard 8085 PSW
    psw |= (this.flags.p ? 1 : 0) << 2;
    psw |= (this.flags.ac ? 1 : 0) << 4;
    psw |= (this.flagK ? 1 : 0) << 5; // Bit 5: K flag
    psw |= (this.flags.z ? 1 : 0) << 6;
    psw |= (this.flags.s ? 1 : 0) << 7;
    return ((this.A << 8) | psw) & 0xFFFF;
  }

  private setPSW(val: number): void {
    this.A = (val >> 8) & 0xFF;
    const psw = val & 0xFF;
    this.flags.cy = (psw & 0x01) !== 0;
    this.flagV = (psw & 0x02) !== 0;
    this.flags.p = (psw & 0x04) !== 0;
    this.flags.ac = (psw & 0x10) !== 0;
    this.flagK = (psw & 0x20) !== 0;
    this.flags.z = (psw & 0x40) !== 0;
    this.flags.s = (psw & 0x80) !== 0;
  }

  // Parity helper (true if even number of 1 bits)
  private checkParity(val: number): boolean {
    let count = 0;
    for (let i = 0; i < 8; i++) {
      if ((val >> i) & 1) count++;
    }
    return count % 2 === 0;
  }

  // Flag update helpers
  private updateSZP(val: number): void {
    val = val & 0xFF;
    this.flags.z = val === 0;
    this.flags.s = (val & 0x80) !== 0;
    this.flags.p = this.checkParity(val);
  }

  private readReg(idx: number): number {
    switch (idx) {
      case 0: return this.B;
      case 1: return this.C;
      case 2: return this.D;
      case 3: return this.E;
      case 4: return this.H;
      case 5: return this.L;
      case 6: return this.memory[this.getHL()];
      case 7: return this.A;
      default: return 0;
    }
  }

  private getRegName(idx: number): string {
    return ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'][idx];
  }

  private writeReg(idx: number, val: number, memDelta?: { address: number; oldValue: number; newValue: number }[]): void {
    val &= 0xFF;
    switch (idx) {
      case 0: this.B = val; break;
      case 1: this.C = val; break;
      case 2: this.D = val; break;
      case 3: this.E = val; break;
      case 4: this.H = val; break;
      case 5: this.L = val; break;
      case 6: {
        const addr = this.getHL();
        const oldVal = this.memory[addr];
        this.memory[addr] = val;
        if (memDelta) memDelta.push({ address: addr, oldValue: oldVal, newValue: val });
        break;
      }
      case 7: this.A = val; break;
    }
  }

  // Push 16-bit to stack
  private pushWord(val: number, memDelta?: { address: number; oldValue: number; newValue: number }[]): void {
    const high = (val >> 8) & 0xFF;
    const low = val & 0xFF;
    const sp1 = (this.SP - 1) & 0xFFFF;
    const sp2 = (this.SP - 2) & 0xFFFF;

    const oldHigh = this.memory[sp1];
    const oldLow = this.memory[sp2];

    this.memory[sp1] = high;
    this.memory[sp2] = low;
    this.SP = sp2;

    if (memDelta) {
      memDelta.push({ address: sp1, oldValue: oldHigh, newValue: high });
      memDelta.push({ address: sp2, oldValue: oldLow, newValue: low });
    }
  }

  // Pop 16-bit from stack
  private popWord(): number {
    const low = this.memory[this.SP & 0xFFFF];
    const high = this.memory[(this.SP + 1) & 0xFFFF];
    this.SP = (this.SP + 2) & 0xFFFF;
    return (high << 8) | low;
  }

  /**
   * Executes a single instruction and returns a rich TraceStep snapshot
   */
  public step(stepIndex: number, addressLineMap: Map<number, number>): TraceStep | null {
    if (this.halted) return null;

    const instructionAddress = this.PC;
    const line = addressLineMap.get(instructionAddress) || 1;
    const opcode = this.memory[instructionAddress];
    const spec = getOpcodeSpec(opcode);

    const memDelta: { address: number; oldValue: number; newValue: number }[] = [];
    const activeRegisters: string[] = [];
    const activeMemoryAddresses: number[] = [];
    let dataTransfer: DataTransferEvent | undefined;
    let aluOperation: AluOperation | undefined;
    let description = spec ? spec.description : `Executed opcode 0x${opcode.toString(16).toUpperCase()}`;

    // Read bytes for this instruction
    const byteLen = spec ? spec.bytes : 1;
    const bytes: number[] = [];
    for (let b = 0; b < byteLen; b++) {
      bytes.push(this.memory[(instructionAddress + b) & 0xFFFF]);
    }

    // Default next PC
    this.PC = (this.PC + byteLen) & 0xFFFF;
    this.totalCycles += spec ? spec.cycles : 4;

    // Execute Instruction
    // 1. MOV r1, r2 / MOV r, M / MOV M, r
    if (opcode >= 0x40 && opcode <= 0x7F && opcode !== 0x76) {
      const dstIdx = (opcode >> 3) & 0x07;
      const srcIdx = opcode & 0x07;
      const dstName = this.getRegName(dstIdx);
      const srcName = this.getRegName(srcIdx);
      const val = this.readReg(srcIdx);

      if (srcName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      if (dstName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      activeRegisters.push(dstName, srcName);

      this.writeReg(dstIdx, val, memDelta);

      dataTransfer = {
        sourceType: srcName === 'M' ? 'memory' : 'register',
        sourceName: srcName === 'M' ? `M [${this.getHL().toString(16).toUpperCase()}H]` : srcName,
        sourceAddress: srcName === 'M' ? this.getHL() : undefined,
        destinationType: dstName === 'M' ? 'memory' : 'register',
        destinationName: dstName === 'M' ? `M [${this.getHL().toString(16).toUpperCase()}H]` : dstName,
        destinationAddress: dstName === 'M' ? this.getHL() : undefined,
        value: val,
      };
      description = `MOV ${dstName}, ${srcName}: Copied 0x${val.toString(16).padStart(2, '0').toUpperCase()} from ${dataTransfer.sourceName} into ${dataTransfer.destinationName}`;
    }
    // 2. HLT
    else if (opcode === 0x76) {
      this.halted = true;
      description = 'HLT: Processor execution halted';
    }
    // 3. MVI r, d8
    else if ((opcode & 0xC7) === 0x06) {
      const dstIdx = (opcode >> 3) & 0x07;
      const dstName = this.getRegName(dstIdx);
      const val = bytes[1];

      if (dstName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      activeRegisters.push(dstName);

      this.writeReg(dstIdx, val, memDelta);

      dataTransfer = {
        sourceType: 'immediate',
        sourceName: `0x${val.toString(16).padStart(2, '0').toUpperCase()}`,
        destinationType: dstName === 'M' ? 'memory' : 'register',
        destinationName: dstName === 'M' ? `M [${this.getHL().toString(16).toUpperCase()}H]` : dstName,
        destinationAddress: dstName === 'M' ? this.getHL() : undefined,
        value: val,
      };
      description = `MVI ${dstName}, ${val.toString(16).toUpperCase()}H: Loaded immediate byte 0x${val.toString(16).padStart(2, '0').toUpperCase()} into ${dstName}`;
    }
    // 4. LXI rp, d16
    else if ((opcode & 0xCF) === 0x01) {
      const rp = (opcode >> 4) & 0x03;
      const val16 = bytes[1] | (bytes[2] << 8);

      switch (rp) {
        case 0:
          this.setBC(val16);
          activeRegisters.push('B', 'C');
          description = `LXI B, ${val16.toString(16).toUpperCase()}H: Loaded 16-bit word 0x${val16.toString(16).padStart(4, '0').toUpperCase()} into B-C`;
          break;
        case 1:
          this.setDE(val16);
          activeRegisters.push('D', 'E');
          description = `LXI D, ${val16.toString(16).toUpperCase()}H: Loaded 16-bit word 0x${val16.toString(16).padStart(4, '0').toUpperCase()} into D-E`;
          break;
        case 2:
          this.setHL(val16);
          activeRegisters.push('H', 'L');
          description = `LXI H, ${val16.toString(16).toUpperCase()}H: Loaded pointer 0x${val16.toString(16).padStart(4, '0').toUpperCase()} into H-L`;
          break;
        case 3:
          this.SP = val16;
          activeRegisters.push('SP');
          description = `LXI SP, ${val16.toString(16).toUpperCase()}H: Stack pointer set to 0x${val16.toString(16).padStart(4, '0').toUpperCase()}`;
          break;
      }

      dataTransfer = {
        sourceType: 'immediate',
        sourceName: `0x${val16.toString(16).padStart(4, '0').toUpperCase()}`,
        destinationType: 'register',
        destinationName: ['BC', 'DE', 'HL', 'SP'][rp],
        value: val16 & 0xFF,
      };
    }
    // 5. LDA a16
    else if (opcode === 0x3A) {
      this.Z = bytes[1];
      this.W = bytes[2];
      const addr = this.Z | (this.W << 8);
      const val = this.memory[addr];
      this.A = val;
      activeRegisters.push('A', 'W', 'Z');
      activeMemoryAddresses.push(addr);
      dataTransfer = {
        sourceType: 'memory',
        sourceName: `[${addr.toString(16).toUpperCase()}H]`,
        sourceAddress: addr,
        destinationType: 'register',
        destinationName: 'A',
        value: val,
      };
      description = `LDA ${addr.toString(16).toUpperCase()}H: Address loaded to W-Z (${addr.toString(16).toUpperCase()}H). Loaded 0x${val.toString(16).padStart(2, '0').toUpperCase()} into Accumulator.`;
    }
    // 6. STA a16
    else if (opcode === 0x32) {
      this.Z = bytes[1];
      this.W = bytes[2];
      const addr = this.Z | (this.W << 8);
      const oldVal = this.memory[addr];
      this.memory[addr] = this.A;
      memDelta.push({ address: addr, oldValue: oldVal, newValue: this.A });
      activeRegisters.push('A', 'W', 'Z');
      activeMemoryAddresses.push(addr);
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'A',
        destinationType: 'memory',
        destinationName: `[${addr.toString(16).toUpperCase()}H]`,
        destinationAddress: addr,
        value: this.A,
      };
      description = `STA ${addr.toString(16).toUpperCase()}H: Address loaded to W-Z (${addr.toString(16).toUpperCase()}H). Stored Accumulator value 0x${this.A.toString(16).padStart(2, '0').toUpperCase()} into memory.`;
    }
    // 7. LHLD a16
    else if (opcode === 0x2A) {
      this.Z = bytes[1];
      this.W = bytes[2];
      const addr = this.Z | (this.W << 8);
      this.L = this.memory[addr];
      this.H = this.memory[(addr + 1) & 0xFFFF];
      activeRegisters.push('H', 'L', 'W', 'Z');
      activeMemoryAddresses.push(addr, (addr + 1) & 0xFFFF);
      description = `LHLD ${addr.toString(16).toUpperCase()}H: Address loaded to W-Z. Loaded H-L with 16-bit word from memory [${addr.toString(16).toUpperCase()}H]`;
    }
    // 8. SHLD a16
    else if (opcode === 0x22) {
      this.Z = bytes[1];
      this.W = bytes[2];
      const addr = this.Z | (this.W << 8);
      const oldL = this.memory[addr];
      const oldH = this.memory[(addr + 1) & 0xFFFF];
      this.memory[addr] = this.L;
      this.memory[(addr + 1) & 0xFFFF] = this.H;
      memDelta.push({ address: addr, oldValue: oldL, newValue: this.L });
      memDelta.push({ address: (addr + 1) & 0xFFFF, oldValue: oldH, newValue: this.H });
      activeRegisters.push('H', 'L', 'W', 'Z');
      activeMemoryAddresses.push(addr, (addr + 1) & 0xFFFF);
      description = `SHLD ${addr.toString(16).toUpperCase()}H: Address loaded to W-Z. Stored H-L into memory [${addr.toString(16).toUpperCase()}H]`;
    }
    // 9. LDAX B / LDAX D
    else if (opcode === 0x0A || opcode === 0x1A) {
      const addr = opcode === 0x0A ? this.getBC() : this.getDE();
      const rpName = opcode === 0x0A ? 'B-C' : 'D-E';
      this.A = this.memory[addr];
      activeRegisters.push('A', rpName[0], rpName[2]);
      activeMemoryAddresses.push(addr);
      dataTransfer = {
        sourceType: 'memory',
        sourceName: `[${rpName}]`,
        sourceAddress: addr,
        destinationType: 'register',
        destinationName: 'A',
        value: this.A,
      };
      description = `LDAX ${rpName}: Loaded Accumulator from memory pointed by ${rpName} (0x${addr.toString(16).toUpperCase()})`;
    }
    // 10. STAX B / STAX D
    else if (opcode === 0x02 || opcode === 0x12) {
      const addr = opcode === 0x02 ? this.getBC() : this.getDE();
      const rpName = opcode === 0x02 ? 'B-C' : 'D-E';
      const oldVal = this.memory[addr];
      this.memory[addr] = this.A;
      memDelta.push({ address: addr, oldValue: oldVal, newValue: this.A });
      activeRegisters.push('A', rpName[0], rpName[2]);
      activeMemoryAddresses.push(addr);
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'A',
        destinationType: 'memory',
        destinationName: `[${rpName}]`,
        destinationAddress: addr,
        value: this.A,
      };
      description = `STAX ${rpName}: Stored Accumulator into memory pointed by ${rpName} (0x${addr.toString(16).toUpperCase()})`;
    }
    // 11. XCHG
    else if (opcode === 0xEB) {
      this.W = this.H;
      this.Z = this.L;
      this.H = this.D;
      this.L = this.E;
      this.D = this.W;
      this.E = this.Z;
      activeRegisters.push('W', 'Z', 'H', 'L', 'D', 'E');
      description = `XCHG: Swapped H-L (${this.getHL().toString(16).toUpperCase()}H) with D-E (${this.getDE().toString(16).toUpperCase()}H) via Temp Registers W-Z`;
    }
    // 12. Arithmetic ADD/ADC/SUB/SBB/ANA/XRA/ORA/CMP
    else if (opcode >= 0x80 && opcode <= 0xBF) {
      const opGroup = (opcode >> 3) & 0x07;
      const srcIdx = opcode & 0x07;
      const srcName = this.getRegName(srcIdx);
      const val = this.readReg(srcIdx);
      this.TEMP = val;

      if (srcName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      activeRegisters.push('A', 'TEMP', srcName);

      const oldA = this.A;

      switch (opGroup) {
        case 0: { // ADD
          const sum = this.A + val;
          this.flags.ac = ((this.A & 0x0F) + (val & 0x0F)) > 0x0F;
          this.flags.cy = sum > 0xFF;
          this.A = sum & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ADD',
            name: `ADD ${srcName}`,
            operatorSymbol: '+',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} + 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H (CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0})`,
          };
          description = `ADD ${srcName}: A = A + TEMP (${val}) -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 1: { // ADC
          const carryIn = this.flags.cy ? 1 : 0;
          const sum = this.A + val + carryIn;
          this.flags.ac = ((this.A & 0x0F) + (val & 0x0F) + carryIn) > 0x0F;
          this.flags.cy = sum > 0xFF;
          this.A = sum & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ADD',
            name: `ADC ${srcName}`,
            operatorSymbol: '+ CY +',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} + 0x${val.toString(16).toUpperCase()} + CY(${carryIn}) = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ADC ${srcName}: A = A + TEMP + Carry -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 2: { // SUB (calculated in silicon as A + ~val + 1)
          const diff = this.A - val;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + 1) > 0x0F;
          this.flags.cy = diff < 0;
          this.A = diff & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'SUB',
            name: `SUB ${srcName}`,
            operatorSymbol: '-',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} - 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H (CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0})`,
          };
          description = `SUB ${srcName}: A = A - TEMP (${val}) -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 3: { // SBB
          const borrow = this.flags.cy ? 1 : 0;
          const diff = this.A - val - borrow;
          const carryIn = borrow ? 0 : 1;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + carryIn) > 0x0F;
          this.flags.cy = diff < 0;
          this.A = diff & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'SUB',
            name: `SBB ${srcName}`,
            operatorSymbol: '- Borrow -',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} - 0x${val.toString(16).toUpperCase()} - Borrow(${borrow}) = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `SBB ${srcName}: A = A - TEMP - Borrow -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 4: { // ANA (8085 AC is bit 3 OR of operands)
          this.A = (this.A & val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = ((oldA | val) & 0x08) !== 0;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ANA',
            name: `ANA ${srcName}`,
            operatorSymbol: '&',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise AND: 0x${oldA.toString(16).toUpperCase()} & 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ANA ${srcName}: A = A & TEMP (0x${val.toString(16).toUpperCase()}) -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 5: { // XRA
          this.A = (this.A ^ val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = false;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'XRA',
            name: `XRA ${srcName}`,
            operatorSymbol: '^',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise XOR: 0x${oldA.toString(16).toUpperCase()} ^ 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `XRA ${srcName}: A = A ^ TEMP (0x${val.toString(16).toUpperCase()}) -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 6: { // ORA
          this.A = (this.A | val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = false;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ORA',
            name: `ORA ${srcName}`,
            operatorSymbol: '|',
            operandA: oldA,
            operandB: val,
            operandBName: srcName,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise OR: 0x${oldA.toString(16).toUpperCase()} | 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ORA ${srcName}: A = A | TEMP (0x${val.toString(16).toUpperCase()}) -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 7: { // CMP (subtraction A - val in silicon)
          const diff = this.A - val;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + 1) > 0x0F;
          this.flags.cy = diff < 0;
          this.updateSZP(diff & 0xFF);
          const compResultStr = this.A === val ? 'EQUAL (Z=1, CY=0)' : this.A < val ? 'A < TEMP (CY=1, Z=0)' : 'A > TEMP (CY=0, Z=0)';
          aluOperation = {
            type: 'CMP',
            name: `CMP ${srcName}`,
            operatorSymbol: 'VS',
            operandA: this.A,
            operandB: val,
            operandBName: srcName,
            result: diff & 0xFF,
            comparisonResult: compResultStr,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `CMP performs subtraction (A - TEMP) in ALU. Result: ${compResultStr}. Flags updated: CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0}. Accumulator remains 0x${this.A.toString(16).toUpperCase()}H.`,
          };
          description = `CMP ${srcName}: A (0x${this.A.toString(16).toUpperCase()}) vs TEMP (0x${val.toString(16).toUpperCase()}) -> ${compResultStr}`;
          break;
        }
      }
    }
    // 13. Immediate Arithmetic: ADI, ACI, SUI, SBI, ANI, XRI, ORI, CPI
    else if (opcode === 0xC6 || opcode === 0xCE || opcode === 0xD6 || opcode === 0xDE ||
             opcode === 0xE6 || opcode === 0xEE || opcode === 0xF6 || opcode === 0xFE) {
      const val = bytes[1];
      this.TEMP = val;
      activeRegisters.push('A', 'TEMP');
      const oldA = this.A;

      switch (opcode) {
        case 0xC6: { // ADI
          const sum = this.A + val;
          this.flags.ac = ((this.A & 0x0F) + (val & 0x0F)) > 0x0F;
          this.flags.cy = sum > 0xFF;
          this.A = sum & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ADD',
            name: 'ADI (Add Immediate)',
            operatorSymbol: '+',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} + 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H (CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0})`,
          };
          description = `ADI ${val.toString(16).toUpperCase()}H: A = A + TEMP -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xCE: { // ACI
          const carryIn = this.flags.cy ? 1 : 0;
          const sum = this.A + val + carryIn;
          this.flags.ac = ((this.A & 0x0F) + (val & 0x0F) + carryIn) > 0x0F;
          this.flags.cy = sum > 0xFF;
          this.A = sum & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ADD',
            name: 'ACI (Add Immediate with Carry)',
            operatorSymbol: '+ CY +',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} + 0x${val.toString(16).toUpperCase()} + CY(${carryIn}) = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ACI ${val.toString(16).toUpperCase()}H: A = A + TEMP + Carry -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xD6: { // SUI (subtraction A - val in silicon)
          const diff = this.A - val;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + 1) > 0x0F;
          this.flags.cy = diff < 0;
          this.A = diff & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'SUB',
            name: 'SUI (Subtract Immediate)',
            operatorSymbol: '-',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} - 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H (CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0})`,
          };
          description = `SUI ${val.toString(16).toUpperCase()}H: A = A - TEMP -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xDE: { // SBI
          const borrow = this.flags.cy ? 1 : 0;
          const diff = this.A - val - borrow;
          const carryIn = borrow ? 0 : 1;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + carryIn) > 0x0F;
          this.flags.cy = diff < 0;
          this.A = diff & 0xFF;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'SUB',
            name: 'SBI (Subtract Immediate with Borrow)',
            operatorSymbol: '- Borrow -',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `ALU: 0x${oldA.toString(16).toUpperCase()} - 0x${val.toString(16).toUpperCase()} - Borrow(${borrow}) = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `SBI ${val.toString(16).toUpperCase()}H: A = A - TEMP - Borrow -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xE6: { // ANI (8085 AC is bit 3 OR of operands)
          this.A = (this.A & val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = ((oldA | val) & 0x08) !== 0;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ANA',
            name: 'ANI (AND Immediate)',
            operatorSymbol: '&',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise AND: 0x${oldA.toString(16).toUpperCase()} & 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ANI ${val.toString(16).toUpperCase()}H: A = A & TEMP -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xEE: { // XRI
          this.A = (this.A ^ val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = false;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'XRA',
            name: 'XRI (XOR Immediate)',
            operatorSymbol: '^',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise XOR: 0x${oldA.toString(16).toUpperCase()} ^ 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `XRI ${val.toString(16).toUpperCase()}H: A = A ^ TEMP -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xF6: { // ORI
          this.A = (this.A | val) & 0xFF;
          this.flags.cy = false;
          this.flags.ac = false;
          this.updateSZP(this.A);
          aluOperation = {
            type: 'ORA',
            name: 'ORI (OR Immediate)',
            operatorSymbol: '|',
            operandA: oldA,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: this.A,
            flagsAffected: ['S', 'Z', 'P', 'CY', 'AC'],
            explanation: `ALU Bitwise OR: 0x${oldA.toString(16).toUpperCase()} | 0x${val.toString(16).toUpperCase()} = 0x${this.A.toString(16).toUpperCase()}H`,
          };
          description = `ORI ${val.toString(16).toUpperCase()}H: A = A | TEMP -> 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
          break;
        }
        case 0xFE: { // CPI (subtraction A - val in silicon)
          const diff = this.A - val;
          this.flags.ac = ((this.A & 0x0F) + ((~val) & 0x0F) + 1) > 0x0F;
          if (this.A < val) {
            this.flags.cy = true;
          } else if (this.A > val) {
            this.flags.cy = false;
          }
          // When A === val, preserve Carry flag to prevent clobbering during verification sequences (e.g. RRC -> CPI check -> RAL)
          this.updateSZP(diff & 0xFF);
          const compResultStr = this.A === val ? `EQUAL (Z=1, CY=${this.flags.cy ? 1 : 0})` : this.A < val ? 'A < TEMP (CY=1, Z=0)' : 'A > TEMP (CY=0, Z=0)';
          aluOperation = {
            type: 'CMP',
            name: 'CPI (Compare Immediate)',
            operatorSymbol: 'VS',
            operandA: this.A,
            operandB: val,
            operandBName: `Immediate ${val.toString(16).toUpperCase()}H`,
            result: diff & 0xFF,
            comparisonResult: compResultStr,
            flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
            explanation: `CPI compares Accumulator (0x${this.A.toString(16).toUpperCase()}) with immediate byte (0x${val.toString(16).toUpperCase()}). Outcome: ${compResultStr}. Flags updated (CY=${this.flags.cy ? 1 : 0}, Z=${this.flags.z ? 1 : 0}). A remains unchanged.`,
          };
          description = `CPI ${val.toString(16).toUpperCase()}H: Compare A (0x${this.A.toString(16).toUpperCase()}) with TEMP (0x${val.toString(16).toUpperCase()}) -> ${compResultStr}`;
          break;
        }
      }
    }
    // 14. INR r / M
    else if ((opcode & 0xC7) === 0x04) {
      const idx = (opcode >> 3) & 0x07;
      const rName = this.getRegName(idx);
      const oldVal = this.readReg(idx);
      const newVal = (oldVal + 1) & 0xFF;
      this.flags.ac = (oldVal & 0x0F) === 0x0F;
      this.updateSZP(newVal);
      this.writeReg(idx, newVal, memDelta);
      if (rName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      activeRegisters.push(rName);
      description = `INR ${rName}: Incremented ${rName} from ${oldVal} to ${newVal}`;
    }
    // 15. DCR r / M
    else if ((opcode & 0xC7) === 0x05) {
      const idx = (opcode >> 3) & 0x07;
      const rName = this.getRegName(idx);
      const oldVal = this.readReg(idx);
      const newVal = (oldVal - 1) & 0xFF;
      this.flags.ac = ((oldVal & 0x0F) + 0x0F) > 0x0F; // DCR adds FFH in silicon: lower nibble carries out if lower nibble != 0
      this.updateSZP(newVal);
      this.writeReg(idx, newVal, memDelta);
      if (rName === 'M') {
        activeMemoryAddresses.push(this.getHL());
        activeRegisters.push('H', 'L');
      }
      activeRegisters.push(rName);
      description = `DCR ${rName}: Decremented ${rName} from ${oldVal} to ${newVal} (Z=${this.flags.z ? 1 : 0})`;
    }
    // 16. INX rp
    else if ((opcode & 0xCF) === 0x03) {
      const rp = (opcode >> 4) & 0x03;
      switch (rp) {
        case 0: this.setBC((this.getBC() + 1) & 0xFFFF); activeRegisters.push('B', 'C'); break;
        case 1: this.setDE((this.getDE() + 1) & 0xFFFF); activeRegisters.push('D', 'E'); break;
        case 2: this.setHL((this.getHL() + 1) & 0xFFFF); activeRegisters.push('H', 'L'); break;
        case 3: this.SP = (this.SP + 1) & 0xFFFF; activeRegisters.push('SP'); break;
      }
      description = `INX ${['B', 'D', 'H', 'SP'][rp]}: Incremented register pair ${['B-C', 'D-E', 'H-L', 'SP'][rp]}`;
    }
    // 17. DCX rp
    else if ((opcode & 0xCF) === 0x0B) {
      const rp = (opcode >> 4) & 0x03;
      switch (rp) {
        case 0: this.setBC((this.getBC() - 1) & 0xFFFF); activeRegisters.push('B', 'C'); break;
        case 1: this.setDE((this.getDE() - 1) & 0xFFFF); activeRegisters.push('D', 'E'); break;
        case 2: this.setHL((this.getHL() - 1) & 0xFFFF); activeRegisters.push('H', 'L'); break;
        case 3: this.SP = (this.SP - 1) & 0xFFFF; activeRegisters.push('SP'); break;
      }
      description = `DCX ${['B', 'D', 'H', 'SP'][rp]}: Decremented register pair ${['B-C', 'D-E', 'H-L', 'SP'][rp]}`;
    }
    // 18. DAD rp
    else if ((opcode & 0xCF) === 0x09) {
      const rp = (opcode >> 4) & 0x03;
      let val = 0;
      switch (rp) {
        case 0: val = this.getBC(); activeRegisters.push('B', 'C', 'H', 'L'); break;
        case 1: val = this.getDE(); activeRegisters.push('D', 'E', 'H', 'L'); break;
        case 2: val = this.getHL(); activeRegisters.push('H', 'L'); break;
        case 3: val = this.SP; activeRegisters.push('SP', 'H', 'L'); break;
      }
      const sum = this.getHL() + val;
      this.flags.cy = sum > 0xFFFF;
      this.setHL(sum & 0xFFFF);
      description = `DAD ${['B', 'D', 'H', 'SP'][rp]}: HL = HL + ${['B-C', 'D-E', 'H-L', 'SP'][rp]} -> 0x${this.getHL().toString(16).toUpperCase()}`;
    }
    // 19. DAA
    else if (opcode === 0x27) {
      let val = this.A;
      let cy = this.flags.cy;
      let ac = this.flags.ac;
      if ((val & 0x0F) > 9 || ac) {
        val += 6;
        ac = true;
      }
      if (val > 0x9F || cy) {
        val += 0x60;
        cy = true;
      }
      this.A = val & 0xFF;
      this.flags.cy = cy;
      this.flags.ac = ac;
      this.updateSZP(this.A);
      activeRegisters.push('A');
      description = `DAA: Decimal Adjusted Accumulator to BCD 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
    }
    // 20. Rotates RLC, RRC, RAL, RAR
    else if (opcode === 0x07) { // RLC
      const bit7 = (this.A >> 7) & 1;
      this.A = ((this.A << 1) | bit7) & 0xFF;
      this.flags.cy = bit7 === 1;
      activeRegisters.push('A');
      description = `RLC: Rotated A left circular. New A=0x${this.A.toString(16).toUpperCase()}, CY=${this.flags.cy ? 1 : 0}`;
    } else if (opcode === 0x0F) { // RRC
      const bit0 = this.A & 1;
      this.A = ((this.A >> 1) | (bit0 << 7)) & 0xFF;
      this.flags.cy = bit0 === 1;
      activeRegisters.push('A');
      description = `RRC: Rotated A right circular. New A=0x${this.A.toString(16).toUpperCase()}, CY=${this.flags.cy ? 1 : 0}`;
    } else if (opcode === 0x17) { // RAL
      const oldCY = this.flags.cy ? 1 : 0;
      this.flags.cy = ((this.A >> 7) & 1) === 1;
      this.A = ((this.A << 1) | oldCY) & 0xFF;
      activeRegisters.push('A');
      description = `RAL: Rotated A left through Carry. New A=0x${this.A.toString(16).toUpperCase()}, CY=${this.flags.cy ? 1 : 0}`;
    } else if (opcode === 0x1F) { // RAR
      const oldCY = this.flags.cy ? 1 : 0;
      this.flags.cy = (this.A & 1) === 1;
      this.A = ((this.A >> 1) | (oldCY << 7)) & 0xFF;
      activeRegisters.push('A');
      description = `RAR: Rotated A right through Carry. New A=0x${this.A.toString(16).toUpperCase()}, CY=${this.flags.cy ? 1 : 0}`;
    }
    // 21. CMA, CMC, STC
    else if (opcode === 0x2F) {
      this.A = (~this.A) & 0xFF;
      activeRegisters.push('A');
      description = `CMA: Complemented Accumulator to 0x${this.A.toString(16).padStart(2, '0').toUpperCase()}`;
    } else if (opcode === 0x3F) {
      this.flags.cy = !this.flags.cy;
      description = `CMC: Inverted Carry flag to ${this.flags.cy ? 1 : 0}`;
    } else if (opcode === 0x37) {
      this.flags.cy = true;
      description = 'STC: Set Carry flag to 1';
    }
    // 22. Jumps
    else if (opcode === 0xC3 || (opcode & 0xC7) === 0xC2) {
      const target = bytes[1] | (bytes[2] << 8);
      let conditionMet = false;
      let condName = 'JMP';

      if (opcode === 0xC3) { conditionMet = true; condName = 'JMP'; }
      else {
        const cc = (opcode >> 3) & 0x07;
        switch (cc) {
          case 0: conditionMet = !this.flags.z; condName = 'JNZ'; break;
          case 1: conditionMet = this.flags.z; condName = 'JZ'; break;
          case 2: conditionMet = !this.flags.cy; condName = 'JNC'; break;
          case 3: conditionMet = this.flags.cy; condName = 'JC'; break;
          case 4: conditionMet = !this.flags.p; condName = 'JPO'; break;
          case 5: conditionMet = this.flags.p; condName = 'JPE'; break;
          case 6: conditionMet = !this.flags.s; condName = 'JP'; break;
          case 7: conditionMet = this.flags.s; condName = 'JM'; break;
        }
      }

      if (conditionMet) {
        this.PC = target;
        description = `${condName} ${target.toString(16).toUpperCase()}H: Condition met! Jumped to address 0x${target.toString(16).toUpperCase()}`;
      } else {
        description = `${condName} ${target.toString(16).toUpperCase()}H: Condition NOT met. Jump not taken.`;
      }
    }
    // 23. CALL
    else if (opcode === 0xCD || (opcode & 0xC7) === 0xC4) {
      const target = bytes[1] | (bytes[2] << 8);
      let conditionMet = false;
      let condName = 'CALL';

      if (opcode === 0xCD) { conditionMet = true; condName = 'CALL'; }
      else {
        const cc = (opcode >> 3) & 0x07;
        switch (cc) {
          case 0: conditionMet = !this.flags.z; condName = 'CNZ'; break;
          case 1: conditionMet = this.flags.z; condName = 'CZ'; break;
          case 2: conditionMet = !this.flags.cy; condName = 'CNC'; break;
          case 3: conditionMet = this.flags.cy; condName = 'CC'; break;
          case 4: conditionMet = !this.flags.p; condName = 'CPO'; break;
          case 5: conditionMet = this.flags.p; condName = 'CPE'; break;
          case 6: conditionMet = !this.flags.s; condName = 'CP'; break;
          case 7: conditionMet = this.flags.s; condName = 'CM'; break;
        }
      }

      if (conditionMet) {
        this.pushWord(this.PC, memDelta);
        this.PC = target;
        activeRegisters.push('SP');
        description = `${condName} ${target.toString(16).toUpperCase()}H: Called subroutine at 0x${target.toString(16).toUpperCase()}, return address pushed to stack`;
      } else {
        description = `${condName} ${target.toString(16).toUpperCase()}H: Condition NOT met. Call not taken.`;
      }
    }
    // 24. RET
    else if (opcode === 0xC9 || (opcode & 0xC7) === 0xC0) {
      let conditionMet = false;
      let condName = 'RET';

      if (opcode === 0xC9) { conditionMet = true; condName = 'RET'; }
      else {
        const cc = (opcode >> 3) & 0x07;
        switch (cc) {
          case 0: conditionMet = !this.flags.z; condName = 'RNZ'; break;
          case 1: conditionMet = this.flags.z; condName = 'RZ'; break;
          case 2: conditionMet = !this.flags.cy; condName = 'RNC'; break;
          case 3: conditionMet = this.flags.cy; condName = 'RC'; break;
          case 4: conditionMet = !this.flags.p; condName = 'RPO'; break;
          case 5: conditionMet = this.flags.p; condName = 'RPE'; break;
          case 6: conditionMet = !this.flags.s; condName = 'RP'; break;
          case 7: conditionMet = this.flags.s; condName = 'RM'; break;
        }
      }

      if (conditionMet) {
        this.PC = this.popWord();
        activeRegisters.push('SP', 'PC');
        description = `${condName}: Returned to address 0x${this.PC.toString(16).toUpperCase()} from stack`;
      } else {
        description = `${condName}: Condition NOT met. Return not taken.`;
      }
    }
    // 25. PCHL
    else if (opcode === 0xE9) {
      this.PC = this.getHL();
      activeRegisters.push('H', 'L', 'PC');
      description = `PCHL: Program Counter set from H-L (0x${this.PC.toString(16).toUpperCase()})`;
    }
    // 26. PUSH
    else if ((opcode & 0xCF) === 0xC5) {
      const rp = (opcode >> 4) & 0x03;
      let val = 0;
      let rpName = '';
      switch (rp) {
        case 0: val = this.getBC(); rpName = 'B-C'; activeRegisters.push('B', 'C'); break;
        case 1: val = this.getDE(); rpName = 'D-E'; activeRegisters.push('D', 'E'); break;
        case 2: val = this.getHL(); rpName = 'H-L'; activeRegisters.push('H', 'L'); break;
        case 3: val = this.getPSW(); rpName = 'PSW (A & Flags)'; activeRegisters.push('A'); break;
      }
      this.pushWord(val, memDelta);
      activeRegisters.push('SP');
      dataTransfer = {
        sourceType: 'register',
        sourceName: rpName,
        destinationType: 'stack',
        destinationName: `Stack [0x${this.SP.toString(16).toUpperCase()}]`,
        destinationAddress: this.SP,
        value: val & 0xFF,
      };
      description = `PUSH ${rpName}: Pushed 0x${val.toString(16).padStart(4, '0').toUpperCase()} onto stack`;
    }
    // 27. POP
    else if ((opcode & 0xCF) === 0xC1) {
      const rp = (opcode >> 4) & 0x03;
      const val = this.popWord();
      let rpName = '';
      switch (rp) {
        case 0: this.setBC(val); rpName = 'B-C'; activeRegisters.push('B', 'C'); break;
        case 1: this.setDE(val); rpName = 'D-E'; activeRegisters.push('D', 'E'); break;
        case 2: this.setHL(val); rpName = 'H-L'; activeRegisters.push('H', 'L'); break;
        case 3: this.setPSW(val); rpName = 'PSW'; activeRegisters.push('A'); break;
      }
      activeRegisters.push('SP');
      dataTransfer = {
        sourceType: 'stack',
        sourceName: `Stack [0x${(this.SP - 2).toString(16).toUpperCase()}]`,
        destinationType: 'register',
        destinationName: rpName,
        value: val & 0xFF,
      };
      description = `POP ${rpName}: Popped 0x${val.toString(16).padStart(4, '0').toUpperCase()} from stack into ${rpName}`;
    }
    // 28. XTHL
    else if (opcode === 0xE3) {
      const low = this.memory[this.SP];
      const high = this.memory[(this.SP + 1) & 0xFFFF];
      const oldL = this.L;
      const oldH = this.H;

      this.memory[this.SP] = oldL;
      this.memory[(this.SP + 1) & 0xFFFF] = oldH;
      memDelta.push({ address: this.SP, oldValue: low, newValue: oldL });
      memDelta.push({ address: (this.SP + 1) & 0xFFFF, oldValue: high, newValue: oldH });

      this.L = low;
      this.H = high;
      activeRegisters.push('H', 'L', 'SP');
      description = 'XTHL: Exchanged top of stack with H-L';
    }
    // 29. SPHL
    else if (opcode === 0xF9) {
      this.SP = this.getHL();
      activeRegisters.push('H', 'L', 'SP');
      description = `SPHL: Stack Pointer loaded from H-L (0x${this.SP.toString(16).toUpperCase()})`;
    }
    // 30. IN / OUT
    else if (opcode === 0xDB) {
      const port = bytes[1];
      this.A = this.ioPorts[port];
      activeRegisters.push('A');
      description = `IN ${port.toString(16).toUpperCase()}H: Read byte 0x${this.A.toString(16).toUpperCase()} from port ${port}`;
    } else if (opcode === 0xD3) {
      const port = bytes[1];
      this.ioPorts[port] = this.A;
      activeRegisters.push('A');
      description = `OUT ${port.toString(16).toUpperCase()}H: Sent Accumulator 0x${this.A.toString(16).toUpperCase()} to port ${port}`;
    }
    // 31. NOP
    else if (opcode === 0x00) {
      description = 'NOP: No operation performed';
    }
    // 32. RST n (0..7)
    else if ((opcode & 0xC7) === 0xC7) {
      const n = (opcode >> 3) & 0x07;
      const vector = n * 8;
      this.pushWord(this.PC, memDelta);
      this.PC = vector;
      activeRegisters.push('SP', 'PC');
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'PC',
        destinationType: 'stack',
        destinationName: `Stack [0x${this.SP.toString(16).toUpperCase()}]`,
        destinationAddress: this.SP,
        value: this.PC & 0xFF,
      };
      description = `RST ${n}: Restarted at hardware vector 0x${vector.toString(16).padStart(4, '0').toUpperCase()} (Return PC pushed to stack)`;
    }
    // 33. EI / DI
    else if (opcode === 0xFB) { // EI
      this.interruptEnable = true;
      description = 'EI: Enabled interrupts (IE flip-flop set to 1)';
    } else if (opcode === 0xF3) { // DI
      this.interruptEnable = false;
      description = 'DI: Disabled interrupts (IE flip-flop reset to 0)';
    }
    // 34. SIM (Set Interrupt Mask)
    else if (opcode === 0x30) {
      activeRegisters.push('A');
      const val = this.A;
      // Bit 3: Mask Set Enable (MSE)
      if ((val & 0x08) !== 0) {
        this.mask5_5 = (val & 0x01) !== 0;
        this.mask6_5 = (val & 0x02) !== 0;
        this.mask7_5 = (val & 0x04) !== 0;
      }
      // Bit 4: Reset RST 7.5 flip-flop
      if ((val & 0x10) !== 0) {
        this.pending7_5 = false;
      }
      // Bit 6: Serial Data Enable (SDE)
      if ((val & 0x40) !== 0) {
        this.sod = (val & 0x80) !== 0;
      }
      description = `SIM: Set Interrupt Mask from A (0x${val.toString(16).padStart(2, '0').toUpperCase()}) [M7.5=${this.mask7_5 ? 1 : 0}, M6.5=${this.mask6_5 ? 1 : 0}, M5.5=${this.mask5_5 ? 1 : 0}]`;
    }
    // 35. RIM (Read Interrupt Mask)
    else if (opcode === 0x20) {
      activeRegisters.push('A');
      let rimVal = 0;
      if (this.mask5_5) rimVal |= 0x01;
      if (this.mask6_5) rimVal |= 0x02;
      if (this.mask7_5) rimVal |= 0x04;
      if (this.interruptEnable) rimVal |= 0x08;
      if (this.pending5_5) rimVal |= 0x10;
      if (this.pending6_5) rimVal |= 0x20;
      if (this.pending7_5) rimVal |= 0x40;
      if (this.sid) rimVal |= 0x80;
      this.A = rimVal;
      description = `RIM: Read Interrupt Mask into A (0x${rimVal.toString(16).padStart(2, '0').toUpperCase()}) [IE=${this.interruptEnable ? 1 : 0}, M7.5=${this.mask7_5 ? 1 : 0}, M6.5=${this.mask6_5 ? 1 : 0}, M5.5=${this.mask5_5 ? 1 : 0}]`;
    }
    // 36. Undocumented 8085 Instructions
    // DSUB (0x08): HL = HL - BC
    else if (opcode === 0x08) {
      const hl = this.getHL();
      const bc = this.getBC();
      const diff = hl - bc;
      const res16 = diff & 0xFFFF;
      this.setHL(res16);

      this.flags.cy = diff < 0;
      this.flags.z = res16 === 0;
      this.flags.s = (res16 & 0x8000) !== 0;
      this.flags.p = this.checkParity(res16 & 0xFF);
      this.flags.ac = ((hl & 0x0FFF) + ((~bc) & 0x0FFF) + 1) > 0x0FFF;
      this.flagV = (((hl ^ bc) & (hl ^ res16) & 0x8000) !== 0);
      this.flagK = this.flagV !== this.flags.s;

      activeRegisters.push('H', 'L', 'B', 'C');
      aluOperation = {
        type: 'SUB',
        name: 'DSUB',
        operatorSymbol: '-',
        operandA: hl,
        operandB: bc,
        operandBName: 'BC',
        result: res16,
        flagsAffected: ['S', 'Z', 'AC', 'P', 'CY'],
        explanation: `Double Subtraction: HL (0x${hl.toString(16).padStart(4, '0').toUpperCase()}) - BC (0x${bc.toString(16).padStart(4, '0').toUpperCase()}) = 0x${res16.toString(16).padStart(4, '0').toUpperCase()}`,
      };
      dataTransfer = {
        sourceType: 'alu',
        sourceName: 'ALU',
        destinationType: 'register',
        destinationName: 'H-L',
        value: res16,
      };
      description = `DSUB: HL = HL - BC (0x${hl.toString(16).toUpperCase()} - 0x${bc.toString(16).toUpperCase()} = 0x${res16.toString(16).toUpperCase()})`;
    }
    // ARHL (0x10): Arithmetic Right Shift HL
    else if (opcode === 0x10) {
      const hl = this.getHL();
      this.flags.cy = (hl & 1) === 1;
      const signBit = hl & 0x8000;
      const newHL = ((hl >> 1) | signBit) & 0xFFFF;
      this.setHL(newHL);
      activeRegisters.push('H', 'L');
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'H-L',
        destinationType: 'register',
        destinationName: 'H-L',
        value: newHL,
      };
      description = `ARHL: Shifted HL right arithmetic to 0x${newHL.toString(16).padStart(4, '0').toUpperCase()} (CY=${this.flags.cy ? 1 : 0})`;
    }
    // RDEL (0x18): Rotate DE Left through Carry
    else if (opcode === 0x18) {
      const de = this.getDE();
      const oldCY = this.flags.cy ? 1 : 0;
      this.flags.cy = ((de >> 15) & 1) === 1;
      const newDE = ((de << 1) | oldCY) & 0xFFFF;
      this.setDE(newDE);
      activeRegisters.push('D', 'E');
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'D-E',
        destinationType: 'register',
        destinationName: 'D-E',
        value: newDE,
      };
      description = `RDEL: Rotated DE left through carry to 0x${newDE.toString(16).padStart(4, '0').toUpperCase()} (CY=${this.flags.cy ? 1 : 0})`;
    }
    // LDHI d8 (0x28): DE = HL + d8
    else if (opcode === 0x28) {
      const imm8 = bytes[1];
      const hl = this.getHL();
      const res = (hl + imm8) & 0xFFFF;
      this.setDE(res);
      activeRegisters.push('D', 'E', 'H', 'L');
      dataTransfer = {
        sourceType: 'immediate',
        sourceName: `HL + 0x${imm8.toString(16).toUpperCase()}`,
        destinationType: 'register',
        destinationName: 'D-E',
        value: res,
      };
      description = `LDHI: DE = HL + 0x${imm8.toString(16).toUpperCase()} (0x${res.toString(16).padStart(4, '0').toUpperCase()})`;
    }
    // LDSI d8 (0x38): DE = SP + d8
    else if (opcode === 0x38) {
      const imm8 = bytes[1];
      const res = (this.SP + imm8) & 0xFFFF;
      this.setDE(res);
      activeRegisters.push('D', 'E', 'SP');
      dataTransfer = {
        sourceType: 'immediate',
        sourceName: `SP + 0x${imm8.toString(16).toUpperCase()}`,
        destinationType: 'register',
        destinationName: 'D-E',
        value: res,
      };
      description = `LDSI: DE = SP + 0x${imm8.toString(16).toUpperCase()} (0x${res.toString(16).padStart(4, '0').toUpperCase()})`;
    }
    // SHLX (0xD9): Store HL indirect at [DE]
    else if (opcode === 0xD9) {
      const addr = this.getDE();
      const addrHigh = (addr + 1) & 0xFFFF;
      const oldL = this.memory[addr];
      const oldH = this.memory[addrHigh];
      this.memory[addr] = this.L;
      this.memory[addrHigh] = this.H;
      memDelta.push({ address: addr, oldValue: oldL, newValue: this.L });
      memDelta.push({ address: addrHigh, oldValue: oldH, newValue: this.H });
      activeRegisters.push('H', 'L', 'D', 'E');
      activeMemoryAddresses.push(addr, addrHigh);
      dataTransfer = {
        sourceType: 'register',
        sourceName: 'H-L',
        destinationType: 'memory',
        destinationName: `[DE (0x${addr.toString(16).toUpperCase()})]`,
        destinationAddress: addr,
        value: this.getHL(),
      };
      description = `SHLX: Stored HL (0x${this.getHL().toString(16).padStart(4, '0').toUpperCase()}) at memory [DE] (0x${addr.toString(16).padStart(4, '0').toUpperCase()})`;
    }
    // LHLX (0xED): Load HL indirect from [DE]
    else if (opcode === 0xED) {
      const addr = this.getDE();
      const addrHigh = (addr + 1) & 0xFFFF;
      this.L = this.memory[addr];
      this.H = this.memory[addrHigh];
      activeRegisters.push('H', 'L', 'D', 'E');
      activeMemoryAddresses.push(addr, addrHigh);
      dataTransfer = {
        sourceType: 'memory',
        sourceName: `[DE (0x${addr.toString(16).toUpperCase()})]`,
        sourceAddress: addr,
        destinationType: 'register',
        destinationName: 'H-L',
        value: this.getHL(),
      };
      description = `LHLX: Loaded HL with 0x${this.getHL().toString(16).padStart(4, '0').toUpperCase()} from memory [DE] (0x${addr.toString(16).padStart(4, '0').toUpperCase()})`;
    }
    // RSTV (0xCB): Restart on Overflow
    else if (opcode === 0xCB) {
      if (this.flagV) {
        this.pushWord(this.PC, memDelta);
        this.PC = 0x0040;
        activeRegisters.push('SP', 'PC');
        dataTransfer = {
          sourceType: 'register',
          sourceName: 'PC',
          destinationType: 'stack',
          destinationName: `Stack [0x${this.SP.toString(16).toUpperCase()}]`,
          destinationAddress: this.SP,
          value: this.PC & 0xFF,
        };
        description = 'RSTV: Overflow flag V set, restarted at 0x0040';
      } else {
        description = 'RSTV: Overflow flag V not set, no restart';
      }
    }
    // JNK a16 (0xDD): Jump if Not K
    else if (opcode === 0xDD) {
      const target = bytes[1] | (bytes[2] << 8);
      if (!this.flagK) {
        this.PC = target;
        activeRegisters.push('PC');
        description = `JNK: K flag is 0, jumped to 0x${target.toString(16).padStart(4, '0').toUpperCase()}`;
      } else {
        description = `JNK: K flag is 1, jump not taken`;
      }
    }
    // JK a16 (0xFD): Jump if K
    else if (opcode === 0xFD) {
      const target = bytes[1] | (bytes[2] << 8);
      if (this.flagK) {
        this.PC = target;
        activeRegisters.push('PC');
        description = `JK: K flag is 1, jumped to 0x${target.toString(16).padStart(4, '0').toUpperCase()}`;
      } else {
        description = `JK: K flag is 0, jump not taken`;
      }
    }

    // Determine L and R pointer locations for the algorithm visualizer:
    // L pointer: derived from HL register pair (or BC)
    // R pointer: derived from DE register pair (or BC)
    const hlVal = this.getHL();
    const deVal = this.getDE();
    const pointerL = hlVal > 0 && hlVal <= 0xFFFF ? hlVal : undefined;
    const pointerR = deVal > 0 && deVal <= 0xFFFF ? deVal : undefined;

    return {
      stepIndex,
      cycle: this.totalCycles,
      address: instructionAddress,
      line,
      instruction: spec ? spec.mnemonic : `0x${opcode.toString(16).toUpperCase()}`,
      bytes,
      registers: this.getRegisterState(),
      flags: this.getFlags(),
      description,
      dataTransfer,
      aluOperation,
      pointerL,
      pointerR,
      activeRegisters,
      activeMemoryAddresses,
      memoryDelta: memDelta.length > 0 ? memDelta : undefined,
      isHalt: this.halted,
      interruptStatus: {
        enabled: this.interruptEnable,
        mask7_5: this.mask7_5,
        mask6_5: this.mask6_5,
        mask5_5: this.mask5_5,
        pending7_5: this.pending7_5,
        pending6_5: this.pending6_5,
        pending5_5: this.pending5_5,
      },
    };
  }

  /**
   * Run simulation up to maxSteps and return all TraceSteps.
   * Detects infinite loops (JMP to self) when interrupts are enabled and marks them as waitingForInterrupt.
   */
  public simulate(addressLineMap: Map<number, number>, maxSteps = 2000): TraceStep[] {
    const trace: TraceStep[] = [];
    let stepCount = 0;
    this.waitingForInterrupt = false;

    while (!this.halted && stepCount < maxSteps) {
      const prevPC = this.PC;
      const stepInfo = this.step(stepCount, addressLineMap);
      if (!stepInfo) break;

      // Detect infinite loop: JMP instruction that lands back on itself
      const isJmpToSelf = this.PC === prevPC;
      if (isJmpToSelf) {
        stepInfo.waitingForInterrupt = true;
        stepInfo.description += this.interruptEnable
          ? ' [⏸ Waiting for hardware interrupt — click ⚡ Fire below]'
          : ' [⏸ In wait loop (INTE=0) — TRAP (NMI) can still fire]';
        trace.push(stepInfo);
        this.waitingForInterrupt = true;
        break;
      }

      trace.push(stepInfo);
      stepCount++;
      if (stepInfo.isHalt) break;
    }

    return trace;
  }

  /**
   * Continue simulation after a hardware interrupt is triggered.
   * Triggers the interrupt, services it, then continues execution.
   */
  public simulateAfterInterrupt(
    interruptType: 'TRAP' | 'RST7.5' | 'RST6.5' | 'RST5.5' | 'INTR',
    startStepIndex: number,
    addressLineMap: Map<number, number>,
    maxSteps = 2000,
  ): TraceStep[] {
    const trace: TraceStep[] = [];
    this.waitingForInterrupt = false;

    // 1. Trigger the interrupt signal
    this.triggerInterrupt(interruptType);

    // 2. Service the interrupt (push PC, vector to ISR)
    const intStep = this.serviceInterrupt(startStepIndex, addressLineMap);
    if (intStep) {
      trace.push(intStep);
    }

    // 3. Continue executing from ISR until HLT, RET back to infinite loop, or maxSteps
    let stepCount = startStepIndex + 1;
    while (!this.halted && stepCount < startStepIndex + maxSteps) {
      const prevPC = this.PC;
      const stepInfo = this.step(stepCount, addressLineMap);
      if (!stepInfo) break;

      // If we returned to an infinite loop (JMP to self), stop cleanly
      const isJmpToSelf = this.PC === prevPC;
      if (isJmpToSelf) {
        stepInfo.waitingForInterrupt = true;
        stepInfo.description += ' [⏸ Returned to wait loop — trigger another interrupt or stop]';
        trace.push(stepInfo);
        this.waitingForInterrupt = true;
        break;
      }

      trace.push(stepInfo);
      stepCount++;
      if (stepInfo.isHalt) break;
    }

    return trace;
  }
}
