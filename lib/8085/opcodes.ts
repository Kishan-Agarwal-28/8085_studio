// Complete Intel 8085 Opcode Table and Mnemonic Specifications

export interface OpcodeSpec {
  mnemonic: string;
  opcode: number;
  bytes: number;
  cycles: number;
  description: string;
}

export const OPCODES: Record<number, OpcodeSpec> = {};

// Helper to register opcodes
function reg(opcode: number, mnemonic: string, bytes: number, cycles: number, description: string) {
  OPCODES[opcode] = { opcode, mnemonic, bytes, cycles, description };
}

// 1. Data Transfer Group
// MOV r1, r2 (49 combinations) + MOV r, M (7) + MOV M, r (7)
const regs = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'];
const movBase = 0x40;
for (let d = 0; d < 8; d++) {
  for (let s = 0; s < 8; s++) {
    const code = movBase + (d << 3) + s;
    if (d === 6 && s === 6) {
      // 0x76 is HLT
      reg(0x76, 'HLT', 1, 5, 'Halt processor execution');
    } else {
      const dst = regs[d];
      const src = regs[s];
      const cyc = (dst === 'M' || src === 'M') ? 7 : 4;
      reg(code, `MOV ${dst}, ${src}`, 1, cyc, `Move data from ${src} to ${dst}`);
    }
  }
}

// MVI r, data8 (0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0x3E)
const mviCodes = [0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0x3E];
regs.forEach((r, idx) => {
  const code = mviCodes[idx];
  const cyc = r === 'M' ? 10 : 7;
  reg(code, `MVI ${r}, d8`, 2, cyc, `Move 8-bit immediate data into ${r}`);
});

// LXI rp, data16 (0x01 B, 0x11 D, 0x21 H, 0x31 SP)
reg(0x01, 'LXI B, d16', 3, 10, 'Load 16-bit immediate data into register pair B-C');
reg(0x11, 'LXI D, d16', 3, 10, 'Load 16-bit immediate data into register pair D-E');
reg(0x21, 'LXI H, d16', 3, 10, 'Load 16-bit immediate data into register pair H-L');
reg(0x31, 'LXI SP, d16', 3, 10, 'Load 16-bit immediate data into Stack Pointer');

// LDA, STA, LHLD, SHLD
reg(0x3A, 'LDA a16', 3, 13, 'Load Accumulator direct from memory address');
reg(0x32, 'STA a16', 3, 13, 'Store Accumulator direct into memory address');
reg(0x2A, 'LHLD a16', 3, 16, 'Load H and L registers direct from memory address');
reg(0x22, 'SHLD a16', 3, 16, 'Store H and L registers direct into memory address');

// LDAX, STAX
reg(0x0A, 'LDAX B', 1, 7, 'Load Accumulator indirect through register pair B-C');
reg(0x1A, 'LDAX D', 1, 7, 'Load Accumulator indirect through register pair D-E');
reg(0x02, 'STAX B', 1, 7, 'Store Accumulator indirect into memory pointed by B-C');
reg(0x12, 'STAX D', 1, 7, 'Store Accumulator indirect into memory pointed by D-E');

// XCHG
reg(0xEB, 'XCHG', 1, 4, 'Exchange contents of H-L and D-E register pairs');

// 2. Arithmetic Group
// ADD, ADC, SUB, SBB, ANA, XRA, ORA, CMP
const arithOps = [
  { name: 'ADD', base: 0x80, cycR: 4, cycM: 7, desc: 'Add register/memory to Accumulator' },
  { name: 'ADC', base: 0x88, cycR: 4, cycM: 7, desc: 'Add register/memory with Carry to Accumulator' },
  { name: 'SUB', base: 0x90, cycR: 4, cycM: 7, desc: 'Subtract register/memory from Accumulator' },
  { name: 'SBB', base: 0x98, cycR: 4, cycM: 7, desc: 'Subtract register/memory with Borrow from Accumulator' },
  { name: 'ANA', base: 0xA0, cycR: 4, cycM: 7, desc: 'Logical AND register/memory with Accumulator' },
  { name: 'XRA', base: 0xA8, cycR: 4, cycM: 7, desc: 'Logical XOR register/memory with Accumulator' },
  { name: 'ORA', base: 0xB0, cycR: 4, cycM: 7, desc: 'Logical OR register/memory with Accumulator' },
  { name: 'CMP', base: 0xB8, cycR: 4, cycM: 7, desc: 'Compare register/memory with Accumulator' },
];

arithOps.forEach(op => {
  regs.forEach((r, idx) => {
    const code = op.base + idx;
    const cyc = r === 'M' ? op.cycM : op.cycR;
    reg(code, `${op.name} ${r}`, 1, cyc, `${op.desc} (${r})`);
  });
});

// Immediate Arithmetic & Logic
reg(0xC6, 'ADI d8', 2, 7, 'Add immediate 8-bit data to Accumulator');
reg(0xCE, 'ACI d8', 2, 7, 'Add immediate 8-bit data with Carry to Accumulator');
reg(0xD6, 'SUI d8', 2, 7, 'Subtract immediate 8-bit data from Accumulator');
reg(0xDE, 'SBI d8', 2, 7, 'Subtract immediate 8-bit data with Borrow from Accumulator');
reg(0xE6, 'ANI d8', 2, 7, 'Logical AND immediate 8-bit data with Accumulator');
reg(0xEE, 'XRI d8', 2, 7, 'Logical XOR immediate 8-bit data with Accumulator');
reg(0xF6, 'ORI d8', 2, 7, 'Logical OR immediate 8-bit data with Accumulator');
reg(0xFE, 'CPI d8', 2, 7, 'Compare immediate 8-bit data with Accumulator');

// INR r / M
const inrCodes = [0x04, 0x0C, 0x14, 0x1C, 0x24, 0x2C, 0x34, 0x3C];
regs.forEach((r, idx) => {
  const code = inrCodes[idx];
  const cyc = r === 'M' ? 10 : 4;
  reg(code, `INR ${r}`, 1, cyc, `Increment register/memory ${r} by 1`);
});

// DCR r / M
const dcrCodes = [0x05, 0x0D, 0x15, 0x1D, 0x25, 0x2D, 0x35, 0x3D];
regs.forEach((r, idx) => {
  const code = dcrCodes[idx];
  const cyc = r === 'M' ? 10 : 4;
  reg(code, `DCR ${r}`, 1, cyc, `Decrement register/memory ${r} by 1`);
});

// INX rp (0x03 B, 0x13 D, 0x23 H, 0x33 SP)
reg(0x03, 'INX B', 1, 6, 'Increment register pair B-C by 1');
reg(0x13, 'INX D', 1, 6, 'Increment register pair D-E by 1');
reg(0x23, 'INX H', 1, 6, 'Increment register pair H-L by 1');
reg(0x33, 'INX SP', 1, 6, 'Increment Stack Pointer by 1');

// DCX rp (0x0B B, 0x1B D, 0x2B H, 0x3B SP)
reg(0x0B, 'DCX B', 1, 6, 'Decrement register pair B-C by 1');
reg(0x1B, 'DCX D', 1, 6, 'Decrement register pair D-E by 1');
reg(0x2B, 'DCX H', 1, 6, 'Decrement register pair H-L by 1');
reg(0x3B, 'DCX SP', 1, 6, 'Decrement Stack Pointer by 1');

// DAD rp (HL = HL + rp)
reg(0x09, 'DAD B', 1, 10, 'Double add register pair B-C to H-L');
reg(0x19, 'DAD D', 1, 10, 'Double add register pair D-E to H-L');
reg(0x29, 'DAD H', 1, 10, 'Double add register pair H-L to H-L');
reg(0x39, 'DAD SP', 1, 10, 'Double add Stack Pointer to H-L');

// DAA
reg(0x27, 'DAA', 1, 4, 'Decimal Adjust Accumulator (for BCD arithmetic)');

// Rotates and Complements
reg(0x07, 'RLC', 1, 4, 'Rotate Accumulator left through carry');
reg(0x0F, 'RRC', 1, 4, 'Rotate Accumulator right through carry');
reg(0x17, 'RAL', 1, 4, 'Rotate Accumulator left through carry flag');
reg(0x1F, 'RAR', 1, 4, 'Rotate Accumulator right through carry flag');
reg(0x2F, 'CMA', 1, 4, 'Complement Accumulator (one\'s complement)');
reg(0x3F, 'CMC', 1, 4, 'Complement Carry Flag');
reg(0x37, 'STC', 1, 4, 'Set Carry Flag to 1');

// 3. Branch Group
// Unconditional Jump, Call, Return
reg(0xC3, 'JMP a16', 3, 10, 'Unconditional jump to 16-bit address');
reg(0xCD, 'CALL a16', 3, 18, 'Unconditional call subroutine at 16-bit address');
reg(0xC9, 'RET', 1, 10, 'Unconditional return from subroutine');

// Conditional Jumps
reg(0xC2, 'JNZ a16', 3, 10, 'Jump if Not Zero (Z = 0)');
reg(0xCA, 'JZ a16', 3, 10, 'Jump if Zero (Z = 1)');
reg(0xD2, 'JNC a16', 3, 10, 'Jump if Not Carry (CY = 0)');
reg(0xDA, 'JC a16', 3, 10, 'Jump if Carry (CY = 1)');
reg(0xE2, 'JPO a16', 3, 10, 'Jump if Parity Odd (P = 0)');
reg(0xEA, 'JPE a16', 3, 10, 'Jump if Parity Even (P = 1)');
reg(0xF2, 'JP a16', 3, 10, 'Jump if Plus / Positive (S = 0)');
reg(0xFA, 'JM a16', 3, 10, 'Jump if Minus / Negative (S = 1)');

// Conditional Calls
reg(0xC4, 'CNZ a16', 3, 18, 'Call if Not Zero (Z = 0)');
reg(0xCC, 'CZ a16', 3, 18, 'Call if Zero (Z = 1)');
reg(0xD4, 'CNC a16', 3, 18, 'Call if Not Carry (CY = 0)');
reg(0xDC, 'CC a16', 3, 18, 'Call if Carry (CY = 1)');
reg(0xE4, 'CPO a16', 3, 18, 'Call if Parity Odd (P = 0)');
reg(0xEC, 'CPE a16', 3, 18, 'Call if Parity Even (P = 1)');
reg(0xF4, 'CP a16', 3, 18, 'Call if Plus (S = 0)');
reg(0xFC, 'CM a16', 3, 18, 'Call if Minus (S = 1)');

// Conditional Returns
reg(0xC0, 'RNZ', 1, 12, 'Return if Not Zero (Z = 0)');
reg(0xC8, 'RZ', 1, 12, 'Return if Zero (Z = 1)');
reg(0xD0, 'RNC', 1, 12, 'Return if Not Carry (CY = 0)');
reg(0xD8, 'RC', 1, 12, 'Return if Carry (CY = 1)');
reg(0xE0, 'RPO', 1, 12, 'Return if Parity Odd (P = 0)');
reg(0xE8, 'RPE', 1, 12, 'Return if Parity Even (P = 1)');
reg(0xF0, 'RP', 1, 12, 'Return if Plus (S = 0)');
reg(0xF8, 'RM', 1, 12, 'Return if Minus (S = 1)');

// PCHL
reg(0xE9, 'PCHL', 1, 6, 'Load Program Counter with H-L contents');

// RST n (0..7)
for (let n = 0; n <= 7; n++) {
  const code = 0xC7 + (n << 3);
  reg(code, `RST ${n}`, 1, 12, `Restart at address 0x${(n * 8).toString(16).padStart(4, '0').toUpperCase()}`);
}

// 4. Stack, I/O & Machine Control
reg(0xC5, 'PUSH B', 1, 12, 'Push register pair B-C onto stack');
reg(0xD5, 'PUSH D', 1, 12, 'Push register pair D-E onto stack');
reg(0xE5, 'PUSH H', 1, 12, 'Push register pair H-L onto stack');
reg(0xF5, 'PUSH PSW', 1, 12, 'Push Program Status Word (A and Flags) onto stack');

reg(0xC1, 'POP B', 1, 10, 'Pop register pair B-C from stack');
reg(0xD1, 'POP D', 1, 10, 'Pop register pair D-E from stack');
reg(0xE1, 'POP H', 1, 10, 'Pop register pair H-L from stack');
reg(0xF1, 'POP PSW', 1, 10, 'Pop Program Status Word (A and Flags) from stack');

reg(0xE3, 'XTHL', 1, 16, 'Exchange top of stack with H-L register pair');
reg(0xF9, 'SPHL', 1, 6, 'Move H-L contents to Stack Pointer');

reg(0xDB, 'IN d8', 2, 10, 'Read data from 8-bit I/O port into Accumulator');
reg(0xD3, 'OUT d8', 2, 10, 'Write data from Accumulator to 8-bit I/O port');

reg(0x00, 'NOP', 1, 4, 'No operation');
reg(0xFB, 'EI', 1, 4, 'Enable Interrupts');
reg(0xF3, 'DI', 1, 4, 'Disable Interrupts');
reg(0x20, 'RIM', 1, 4, 'Read Interrupt Mask');
reg(0x30, 'SIM', 1, 4, 'Set Interrupt Mask');

// 5. Undocumented 8085 Instructions
reg(0x08, 'DSUB', 1, 10, 'Double subtract BC from HL (HL = HL - BC)');
reg(0x10, 'ARHL', 1, 7, 'Arithmetic right shift HL (HL >> 1, bit 15 duplicated, CY = bit 0)');
reg(0x18, 'RDEL', 1, 10, 'Rotate DE left through Carry (16-bit rotate through CY)');
reg(0x28, 'LDHI d8', 2, 10, 'Load DE with HL + immediate 8-bit data');
reg(0x38, 'LDSI d8', 2, 10, 'Load DE with Stack Pointer + immediate 8-bit data');
reg(0xD9, 'SHLX', 1, 10, 'Store HL indirect into memory address pointed by DE');
reg(0xED, 'LHLX', 1, 10, 'Load HL indirect from memory address pointed by DE');
reg(0xCB, 'RSTV', 1, 12, 'Restart at address 0x0040 if Overflow flag (V) is set');
reg(0xDD, 'JNK a16', 3, 10, 'Jump to 16-bit address if K flag is not set (K = 0)');
reg(0xFD, 'JK a16', 3, 10, 'Jump to 16-bit address if K flag is set (K = 1)');

export function getOpcodeSpec(code: number): OpcodeSpec | undefined {
  return OPCODES[code];
}
