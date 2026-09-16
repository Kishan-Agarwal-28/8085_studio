'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Cpu,
  BookOpen,
  ArrowRight,
  Search,
  CheckCircle2,
  Code2,
  Play,
  Hammer,
  Database,
} from 'lucide-react';

interface OpcodeDoc {
  mnemonic: string;
  opcode: string;
  bytes: number;
  cycles: number;
  group: 'Data Transfer' | 'Arithmetic' | 'Logical' | 'Branch' | 'Stack & Control' | 'Ghost Opcodes';
  flags: string;
  description: string;
  example: string;
}

const ALL_INSTRUCTIONS: OpcodeDoc[] = [
  // Data Transfer
  { mnemonic: 'MOV r1, r2', opcode: '40 - 7F', bytes: 1, cycles: 4, group: 'Data Transfer', flags: 'None', description: 'Move content of register r2 into register r1.', example: 'MOV A, B' },
  { mnemonic: 'MOV r, M', opcode: '46, 4E, 56...', bytes: 1, cycles: 7, group: 'Data Transfer', flags: 'None', description: 'Move content of memory [HL] into register r.', example: 'MOV A, M' },
  { mnemonic: 'MOV M, r', opcode: '70 - 77', bytes: 1, cycles: 7, group: 'Data Transfer', flags: 'None', description: 'Move content of register r into memory [HL].', example: 'MOV M, A' },
  { mnemonic: 'MVI r, d8', opcode: '06, 0E, 16...', bytes: 2, cycles: 7, group: 'Data Transfer', flags: 'None', description: 'Move 8-bit immediate data into register r.', example: 'MVI A, 42H' },
  { mnemonic: 'MVI M, d8', opcode: '36', bytes: 2, cycles: 10, group: 'Data Transfer', flags: 'None', description: 'Move 8-bit immediate data into memory [HL].', example: 'MVI M, 0FFH' },
  { mnemonic: 'LXI rp, d16', opcode: '01, 11, 21, 31', bytes: 3, cycles: 10, group: 'Data Transfer', flags: 'None', description: 'Load 16-bit immediate data into register pair rp (B, D, H, or SP).', example: 'LXI H, 2050H' },
  { mnemonic: 'LDA a16', opcode: '3A', bytes: 3, cycles: 13, group: 'Data Transfer', flags: 'None', description: 'Load Accumulator directly from 16-bit memory address.', example: 'LDA 2050H' },
  { mnemonic: 'STA a16', opcode: '32', bytes: 3, cycles: 13, group: 'Data Transfer', flags: 'None', description: 'Store Accumulator directly into 16-bit memory address.', example: 'STA 3000H' },
  { mnemonic: 'LHLD a16', opcode: '2A', bytes: 3, cycles: 16, group: 'Data Transfer', flags: 'None', description: 'Load H and L registers direct from memory (L from [addr], H from [addr+1]).', example: 'LHLD 2000H' },
  { mnemonic: 'SHLD a16', opcode: '22', bytes: 3, cycles: 16, group: 'Data Transfer', flags: 'None', description: 'Store H and L registers direct to memory ([addr] = L, [addr+1] = H).', example: 'SHLD 2000H' },
  { mnemonic: 'LDAX rp', opcode: '0A (B), 1A (D)', bytes: 1, cycles: 7, group: 'Data Transfer', flags: 'None', description: 'Load Accumulator indirect through register pair B or D.', example: 'LDAX D' },
  { mnemonic: 'STAX rp', opcode: '02 (B), 12 (D)', bytes: 1, cycles: 7, group: 'Data Transfer', flags: 'None', description: 'Store Accumulator indirect into memory pointed by B or D.', example: 'STAX B' },
  { mnemonic: 'XCHG', opcode: 'EB', bytes: 1, cycles: 4, group: 'Data Transfer', flags: 'None', description: 'Exchange the contents of register pairs H-L and D-E.', example: 'XCHG' },

  // Arithmetic
  { mnemonic: 'ADD r / M', opcode: '80 - 87', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Add register or memory content to Accumulator.', example: 'ADD B' },
  { mnemonic: 'ADC r / M', opcode: '88 - 8F', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Add register/memory and Carry flag to Accumulator.', example: 'ADC C' },
  { mnemonic: 'ADI d8', opcode: 'C6', bytes: 2, cycles: 7, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Add 8-bit immediate data to Accumulator.', example: 'ADI 05H' },
  { mnemonic: 'ACI d8', opcode: 'CE', bytes: 2, cycles: 7, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Add 8-bit immediate data with Carry to Accumulator.', example: 'ACI 01H' },
  { mnemonic: 'SUB r / M', opcode: '90 - 97', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Subtract register or memory from Accumulator (A + ~val + 1 in silicon).', example: 'SUB A' },
  { mnemonic: 'SBB r / M', opcode: '98 - 9F', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Subtract register or memory with Borrow from Accumulator.', example: 'SBB D' },
  { mnemonic: 'SUI d8', opcode: 'D6', bytes: 2, cycles: 7, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Subtract 8-bit immediate data from Accumulator.', example: 'SUI 10H' },
  { mnemonic: 'SBI d8', opcode: 'DE', bytes: 2, cycles: 7, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Subtract 8-bit immediate data with Borrow from Accumulator.', example: 'SBI 02H' },
  { mnemonic: 'INR r / M', opcode: '04, 0C, 14...', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P', description: 'Increment register or memory by 1. Note: Carry flag is NOT affected.', example: 'INR C' },
  { mnemonic: 'DCR r / M', opcode: '05, 0D, 15...', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P', description: 'Decrement register or memory by 1 (adds FFH in silicon). CY is NOT affected.', example: 'DCR B' },
  { mnemonic: 'INX rp', opcode: '03, 13, 23, 33', bytes: 1, cycles: 6, group: 'Arithmetic', flags: 'None', description: 'Increment 16-bit register pair by 1. No flags affected.', example: 'INX H' },
  { mnemonic: 'DCX rp', opcode: '0B, 1B, 2B, 3B', bytes: 1, cycles: 6, group: 'Arithmetic', flags: 'None', description: 'Decrement 16-bit register pair by 1. No flags affected.', example: 'DCX SP' },
  { mnemonic: 'DAD rp', opcode: '09, 19, 29, 39', bytes: 1, cycles: 10, group: 'Arithmetic', flags: 'CY', description: '16-bit double add register pair to H-L (HL = HL + rp). Only CY is modified.', example: 'DAD B' },
  { mnemonic: 'DAA', opcode: '27', bytes: 1, cycles: 4, group: 'Arithmetic', flags: 'S, Z, AC, P, CY', description: 'Decimal Adjust Accumulator for packed Binary Coded Decimal (BCD) operations.', example: 'DAA' },

  // Logical
  { mnemonic: 'ANA r / M', opcode: 'A0 - A7', bytes: 1, cycles: 4, group: 'Logical', flags: 'S, Z, AC, P, CY=0', description: 'Logical AND with Accumulator. AC is set to (A.3 | op.3) on 8085 silicon.', example: 'ANA B' },
  { mnemonic: 'ANI d8', opcode: 'E6', bytes: 2, cycles: 7, group: 'Logical', flags: 'S, Z, AC, P, CY=0', description: 'Logical AND 8-bit immediate data with Accumulator.', example: 'ANI 0FH' },
  { mnemonic: 'ORA r / M', opcode: 'B0 - B7', bytes: 1, cycles: 4, group: 'Logical', flags: 'S, Z, AC=0, P, CY=0', description: 'Logical OR with Accumulator. Resets AC and CY.', example: 'ORA A' },
  { mnemonic: 'ORI d8', opcode: 'F6', bytes: 2, cycles: 7, group: 'Logical', flags: 'S, Z, AC=0, P, CY=0', description: 'Logical OR 8-bit immediate data with Accumulator.', example: 'ORI 80H' },
  { mnemonic: 'XRA r / M', opcode: 'A8 - AF', bytes: 1, cycles: 4, group: 'Logical', flags: 'S, Z, AC=0, P, CY=0', description: 'Logical XOR with Accumulator. XRA A clears A and resets CY.', example: 'XRA A' },
  { mnemonic: 'XRI d8', opcode: 'EE', bytes: 2, cycles: 7, group: 'Logical', flags: 'S, Z, AC=0, P, CY=0', description: 'Logical XOR 8-bit immediate data with Accumulator.', example: 'XRI 0AAH' },
  { mnemonic: 'CMP r / M', opcode: 'B8 - BF', bytes: 1, cycles: 4, group: 'Logical', flags: 'S, Z, AC, P, CY', description: 'Compare register/memory with Accumulator via virtual subtraction. A is preserved.', example: 'CMP C' },
  { mnemonic: 'CPI d8', opcode: 'FE', bytes: 2, cycles: 7, group: 'Logical', flags: 'S, Z, AC, P, CY', description: 'Compare 8-bit immediate data with Accumulator. If A == val, CY is preserved.', example: 'CPI 0C0H' },
  { mnemonic: 'RLC', opcode: '07', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY', description: 'Rotate Accumulator left 1 bit. Bit 7 moves to Carry and Bit 0.', example: 'RLC' },
  { mnemonic: 'RRC', opcode: '0F', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY', description: 'Rotate Accumulator right 1 bit. Bit 0 moves to Carry and Bit 7.', example: 'RRC' },
  { mnemonic: 'RAL', opcode: '17', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY', description: 'Rotate Accumulator left through Carry (9-bit rotate).', example: 'RAL' },
  { mnemonic: 'RAR', opcode: '1F', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY', description: 'Rotate Accumulator right through Carry (9-bit rotate).', example: 'RAR' },
  { mnemonic: 'CMA', opcode: '2F', bytes: 1, cycles: 4, group: 'Logical', flags: 'None', description: "One's complement of Accumulator (invert all bits). No flags affected.", example: 'CMA' },
  { mnemonic: 'CMC', opcode: '3F', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY', description: 'Complement Carry flag (CY = !CY).', example: 'CMC' },
  { mnemonic: 'STC', opcode: '37', bytes: 1, cycles: 4, group: 'Logical', flags: 'CY=1', description: 'Set Carry flag to 1.', example: 'STC' },

  // Branch Group
  { mnemonic: 'JMP a16', opcode: 'C3', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Unconditional jump to 16-bit target address.', example: 'JMP START' },
  { mnemonic: 'JNZ a16', opcode: 'C2', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Not Zero (Z = 0).', example: 'JNZ LOOP' },
  { mnemonic: 'JZ a16', opcode: 'CA', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Zero (Z = 1).', example: 'JZ ZERO_EXIT' },
  { mnemonic: 'JNC a16', opcode: 'D2', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if No Carry (CY = 0).', example: 'JNC NEXT' },
  { mnemonic: 'JC a16', opcode: 'DA', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Carry is set (CY = 1).', example: 'JC OVERFLOW' },
  { mnemonic: 'JPO a16', opcode: 'E2', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Parity Odd (P = 0).', example: 'JPO ODD_LABEL' },
  { mnemonic: 'JPE a16', opcode: 'EA', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Parity Even (P = 1).', example: 'JPE EVEN_LABEL' },
  { mnemonic: 'JP a16', opcode: 'F2', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Positive / Plus (S = 0).', example: 'JP POSITIVE' },
  { mnemonic: 'JM a16', opcode: 'FA', bytes: 3, cycles: 10, group: 'Branch', flags: 'None', description: 'Jump if Minus / Negative (S = 1).', example: 'JM NEGATIVE' },
  { mnemonic: 'CALL a16', opcode: 'CD', bytes: 3, cycles: 18, group: 'Branch', flags: 'None', description: 'Call subroutine at 16-bit address (pushes return PC to stack).', example: 'CALL DELAY' },
  { mnemonic: 'RET', opcode: 'C9', bytes: 1, cycles: 10, group: 'Branch', flags: 'None', description: 'Return from subroutine (pops return PC from stack).', example: 'RET' },
  { mnemonic: 'PCHL', opcode: 'E9', bytes: 1, cycles: 6, group: 'Branch', flags: 'None', description: 'Load Program Counter with H-L (indirect jump: PC = HL).', example: 'PCHL' },
  { mnemonic: 'RST n', opcode: 'C7 + (n*8)', bytes: 1, cycles: 12, group: 'Branch', flags: 'None', description: 'Restart at hardwired hardware vector (n * 8). Return address pushed to stack.', example: 'RST 1 ; jumps 0008H' },

  // Stack & Control
  { mnemonic: 'PUSH rp', opcode: 'C5, D5, E5, F5', bytes: 1, cycles: 12, group: 'Stack & Control', flags: 'None', description: 'Push 16-bit register pair (BC, DE, HL, or PSW) onto the stack.', example: 'PUSH PSW' },
  { mnemonic: 'POP rp', opcode: 'C1, D1, E1, F1', bytes: 1, cycles: 10, group: 'Stack & Control', flags: 'Flags on POP PSW', description: 'Pop 16-bit word from stack into register pair (BC, DE, HL, or PSW).', example: 'POP PSW' },
  { mnemonic: 'XTHL', opcode: 'E3', bytes: 1, cycles: 16, group: 'Stack & Control', flags: 'None', description: 'Exchange top of stack word with register pair H-L.', example: 'XTHL' },
  { mnemonic: 'SPHL', opcode: 'F9', bytes: 1, cycles: 6, group: 'Stack & Control', flags: 'None', description: 'Move H-L contents into Stack Pointer (SP = HL).', example: 'SPHL' },
  { mnemonic: 'EI', opcode: 'FB', bytes: 1, cycles: 4, group: 'Stack & Control', flags: 'None', description: 'Enable maskable hardware interrupts (sets IE flip-flop to 1).', example: 'EI' },
  { mnemonic: 'DI', opcode: 'F3', bytes: 1, cycles: 4, group: 'Stack & Control', flags: 'None', description: 'Disable maskable hardware interrupts (resets IE flip-flop to 0).', example: 'DI' },
  { mnemonic: 'SIM', opcode: '30', bytes: 1, cycles: 4, group: 'Stack & Control', flags: 'None', description: 'Set Interrupt Mask from Accumulator (RST 7.5, 6.5, 5.5 masks and SOD pin).', example: 'SIM' },
  { mnemonic: 'RIM', opcode: '20', bytes: 1, cycles: 4, group: 'Stack & Control', flags: 'None', description: 'Read Interrupt Mask into Accumulator (masks, pending interrupts, IE, SID pin).', example: 'RIM' },
  { mnemonic: 'NOP', opcode: '00', bytes: 1, cycles: 4, group: 'Stack & Control', flags: 'None', description: 'No operation. Consumes 1 byte and 4 clock cycles.', example: 'NOP' },
  { mnemonic: 'HLT', opcode: '76', bytes: 1, cycles: 5, group: 'Stack & Control', flags: 'None', description: 'Halt processor execution until next interrupt or system reset.', example: 'HLT' },

  // Ghost / Undocumented Opcodes
  { mnemonic: 'DSUB', opcode: '08', bytes: 1, cycles: 10, group: 'Ghost Opcodes', flags: 'S, Z, AC, P, CY, V', description: 'Double subtract BC from HL (HL = HL - BC). Affects all status flags including signed overflow V.', example: 'DSUB ; or DB 08H' },
  { mnemonic: 'ARHL', opcode: '10', bytes: 1, cycles: 7, group: 'Ghost Opcodes', flags: 'CY', description: 'Arithmetic right shift HL by 1 bit. Bit 15 is replicated (preserves sign), bit 0 shifts into Carry.', example: 'ARHL ; or DB 10H' },
  { mnemonic: 'RDEL', opcode: '18', bytes: 1, cycles: 10, group: 'Ghost Opcodes', flags: 'CY', description: '16-bit rotate DE left through Carry flag. Bit 15 moves to Carry, old Carry moves to Bit 0.', example: 'RDEL ; or DB 18H' },
  { mnemonic: 'LDHI d8', opcode: '28', bytes: 2, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Load DE with HL + immediate 8-bit data (DE = HL + d8). No flags affected.', example: 'LDHI 10H' },
  { mnemonic: 'LDSI d8', opcode: '38', bytes: 2, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Load DE with Stack Pointer + immediate 8-bit data (DE = SP + d8).', example: 'LDSI 04H' },
  { mnemonic: 'SHLX', opcode: 'D9', bytes: 1, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Store HL indirect at address in DE (memory[DE] = L, memory[DE+1] = H).', example: 'SHLX ; or DB 0D9H' },
  { mnemonic: 'LHLX', opcode: 'ED', bytes: 1, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Load HL indirect from address in DE (L = memory[DE], H = memory[DE+1]).', example: 'LHLX ; or DB 0EDH' },
  { mnemonic: 'RSTV', opcode: 'CB', bytes: 1, cycles: 12, group: 'Ghost Opcodes', flags: 'None', description: 'Restart on Overflow. If V flag is 1, pushes return PC to stack and jumps to 0040H.', example: 'RSTV ; or DB 0CBH' },
  { mnemonic: 'JNK a16', opcode: 'DD', bytes: 3, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Jump to 16-bit target address if undocumented K flag is 0.', example: 'JNK 2000H' },
  { mnemonic: 'JK a16', opcode: 'FD', bytes: 3, cycles: 10, group: 'Ghost Opcodes', flags: 'None', description: 'Jump to 16-bit target address if undocumented K flag is 1.', example: 'JK 2000H' },
];

export default function InstructionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  const filteredInstructions = useMemo(() => {
    return ALL_INSTRUCTIONS.filter((inst) => {
      const matchesGroup = selectedGroup === 'All' || inst.group === selectedGroup;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inst.mnemonic.toLowerCase().includes(q) ||
        inst.opcode.toLowerCase().includes(q) ||
        inst.description.toLowerCase().includes(q) ||
        inst.group.toLowerCase().includes(q);
      return matchesGroup && matchesSearch;
    });
  }, [searchQuery, selectedGroup]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ─── Top Navbar ─── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-sm shadow-emerald-500/10">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-zinc-100">8085 Studio</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Guide</span>
              </div>
              <p className="text-[11px] text-zinc-400">Usage Manual & ISA Reference</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md hover:bg-zinc-900 transition-colors hidden sm:inline-block"
            >
              Overview
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-3.5 py-1.5 text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Launch Simulator
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Header ─── */}
      <section className="border-b border-zinc-900 bg-linear-to-b from-zinc-900/40 to-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BookOpen className="h-3.5 w-3.5" />
            Comprehensive Intel 8085 Manual
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
            Usage Instructions & Instruction Set Reference
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Complete guide to assembling, simulating, and debugging 8085 assembly programs. Covers editor syntax, hardware memory layout, silicon flag behaviors, and all 10 undocumented ghost opcodes.
          </p>

          {/* Quick Jump Links */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            {[
              { label: 'Quick Start', href: '#quick-start' },
              { label: 'Editor & Syntax', href: '#syntax' },
              { label: 'Assembler Directives', href: '#directives' },
              { label: 'Flag Register (PSW)', href: '#flags' },
              { label: 'Silicon Quirks', href: '#silicon-quirks' },
              { label: 'ISA Opcode Table', href: '#isa' },
              { label: 'Keyboard Shortcuts', href: '#shortcuts' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* ─── SECTION 1: QUICK START ─── */}
        <section id="quick-start" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/20">
              1
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Quick Start Workflow</h2>
              <p className="text-xs text-zinc-400">Step-by-step procedure to assemble, run, and inspect your programs.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="font-semibold text-emerald-400">STEP 1</span>
                <Code2 className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-200">Write Assembly Code</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Type your assembly code into the Monaco Editor. You can choose from presets (Factorial, Bubble Sort, Fibonacci) or start from scratch with full syntax highlighting.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="font-semibold text-emerald-400">STEP 2</span>
                <Hammer className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-200">Assemble / Compile</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click <strong className="text-zinc-200">Compile</strong>. The two-pass assembler resolves symbols, checks syntax, and generates the machine code buffer and formatted Hex Dump.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="font-semibold text-emerald-400">STEP 3</span>
                <Play className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-200">Simulate & Step</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click <strong className="text-zinc-200">Run</strong> to execute. Use the playback controls (Step Forward, Backward, Play, or Speed Slider) to observe micro-cycle execution.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="font-semibold text-emerald-400">STEP 4</span>
                <Database className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-200">Inspect CPU & Memory</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                View registers (A, B, C, D, E, H, L, SP, PC), the animated Flag register (S, Z, AC, P, CY), the active line in code, and real-time modified memory addresses.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: SYNTAX & NUMBER FORMATS ─── */}
        <section id="syntax" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/20">
              2
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Editor Syntax & Literals</h2>
              <p className="text-xs text-zinc-400">Tolerant assembly parsing rules and recognized literal notations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Numeric Literal Notations
              </h3>
              <p className="text-xs text-zinc-400">The compiler accepts standard 8085 formats, plus modern hex/binary prefixes:</p>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">2050H, 0FFH, A000H</span>
                  <span className="text-zinc-500">Standard Hex (H suffix)</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">0x2050, 0xFF</span>
                  <span className="text-zinc-500">C-Style Hex prefix</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">$2050, $FF</span>
                  <span className="text-zinc-500">Motorola/Wozniak style</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">10101010B</span>
                  <span className="text-zinc-500">Binary format (B suffix)</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">255, 100D, 42</span>
                  <span className="text-zinc-500">Strict Decimal</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-emerald-400">#20H, #&apos;A&apos;</span>
                  <span className="text-zinc-500">Immediate # prefix supported</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                Tolerant Register & Memory Notations
              </h3>
              <p className="text-xs text-zinc-400">The assembler automatically normalizes common student & textbook notations:</p>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">M, [HL], (HL), MEM, M[HL]</span>
                  <span className="text-zinc-500">Resolved to M</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">BC, [BC], (BC), B</span>
                  <span className="text-zinc-500">Resolved to B register pair</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">DE, [DE], (DE), D</span>
                  <span className="text-zinc-500">Resolved to D register pair</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">HL, [HL], H</span>
                  <span className="text-zinc-500">Resolved to H register pair</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">MOV A, [2050H]</span>
                  <span className="text-zinc-500">Auto-assembled to LDA 2050H</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex justify-between">
                  <span className="text-cyan-300">MOV [2050H], A</span>
                  <span className="text-zinc-500">Auto-assembled to STA 2050H</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: ASSEMBLER DIRECTIVES ─── */}
        <section id="directives" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/20">
              3
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Assembler Directives</h2>
              <p className="text-xs text-zinc-400">Control origin address, symbol values, and allocate initialized memory.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-amber-400 font-bold">ORG addr</span>
                <span className="text-zinc-500">Origin</span>
              </div>
              <p className="text-xs text-zinc-400">
                Sets the program counter location counter to the specified 16-bit address. If omitted, programs default to <code className="text-emerald-400">2000H</code> (standard RAM).
              </p>
              <pre className="p-2 rounded bg-zinc-950 font-mono text-[11px] text-zinc-300">ORG 0100H{'\n'}START: LXI SP, 20FFH</pre>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-amber-400 font-bold">LABEL EQU value</span>
                <span className="text-zinc-500">Equate Symbol</span>
              </div>
              <p className="text-xs text-zinc-400">
                Assigns a constant numeric value to a symbol name. Symbols can be used throughout your program anywhere an immediate value or address is expected.
              </p>
              <pre className="p-2 rounded bg-zinc-950 font-mono text-[11px] text-zinc-300">COUNT EQU 05H{'\n'}MVI C, COUNT</pre>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-amber-400 font-bold">DB / DW / DS</span>
                <span className="text-zinc-500">Data Directives</span>
              </div>
              <p className="text-xs text-zinc-400">
                <strong className="text-zinc-200">DB</strong> defines bytes, <strong className="text-zinc-200">DW</strong> defines 16-bit words (low byte first), and <strong className="text-zinc-200">DS</strong> reserves a block of uninitialized bytes.
              </p>
              <pre className="p-2 rounded bg-zinc-950 font-mono text-[11px] text-zinc-300">ARRAY: DB 12H, 34H, 56H{'\n'}PTR:   DW 2050H</pre>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4: FLAG REGISTER (PSW) ─── */}
        <section id="flags" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/20">
              4
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Program Status Word (PSW) & Flags</h2>
              <p className="text-xs text-zinc-400">Complete bit mapping of the 8-bit Flag register in the Intel 8085 CPU.</p>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-8 gap-2 font-mono text-center text-xs">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">D7</span>
                <span className="text-emerald-400 font-bold text-sm">S</span>
                <span className="text-[10px] text-zinc-400 block">Sign</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">D6</span>
                <span className="text-emerald-400 font-bold text-sm">Z</span>
                <span className="text-[10px] text-zinc-400 block">Zero</span>
              </div>
              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/50 space-y-1">
                <span className="text-purple-400 block text-[10px]">D5</span>
                <span className="text-purple-300 font-bold text-sm">K</span>
                <span className="text-[10px] text-purple-400 block">Ghost</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">D4</span>
                <span className="text-emerald-400 font-bold text-sm">AC</span>
                <span className="text-[10px] text-zinc-400 block">Aux Carry</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 space-y-1 opacity-50">
                <span className="text-zinc-500 block text-[10px]">D3</span>
                <span className="text-zinc-400 font-bold text-sm">0</span>
                <span className="text-[10px] text-zinc-500 block">Fixed 0</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">D2</span>
                <span className="text-emerald-400 font-bold text-sm">P</span>
                <span className="text-[10px] text-zinc-400 block">Parity</span>
              </div>
              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/50 space-y-1">
                <span className="text-purple-400 block text-[10px]">D1</span>
                <span className="text-purple-300 font-bold text-sm">V / 1</span>
                <span className="text-[10px] text-purple-400 block">Overflow</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">D0</span>
                <span className="text-emerald-400 font-bold text-sm">CY</span>
                <span className="text-[10px] text-zinc-400 block">Carry</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400 pt-2">
              <div className="space-y-1.5">
                <p><strong className="text-zinc-200">S (Sign):</strong> Set to 1 if bit 7 of the result is 1 (negative), else 0.</p>
                <p><strong className="text-zinc-200">Z (Zero):</strong> Set to 1 if the ALU result is strictly 00H, else 0.</p>
                <p><strong className="text-zinc-200">AC (Auxiliary Carry):</strong> Set if there is a carry/borrow between bit 3 and bit 4.</p>
                <p><strong className="text-zinc-200">P (Parity):</strong> Set to 1 if result has an even number of 1-bits (Even Parity), 0 if odd.</p>
              </div>
              <div className="space-y-1.5">
                <p><strong className="text-zinc-200">CY (Carry):</strong> Set if carry out of bit 7 on add, or borrow on subtract.</p>
                <p><strong className="text-purple-300">V (Overflow - Bit 1):</strong> Silicon flag indicating 8-bit or 16-bit signed arithmetic overflow.</p>
                <p><strong className="text-purple-300">K (K-Flag - Bit 5):</strong> Undocumented flag used in signed comparison jumps (<code className="text-purple-300">JK</code> / <code className="text-purple-300">JNK</code>).</p>
                <p><strong className="text-zinc-200">PSW in Stack:</strong> <code className="text-zinc-200">PUSH PSW</code> pushes A as high byte and Flags as low byte.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 5: SILICON QUIRKS & ANOMALIES ─── */}
        <section id="silicon-quirks" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm border border-rose-500/20">
              5
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Silicon Quirks & Hardware Fidelity</h2>
              <p className="text-xs text-zinc-400">Authentic 8085 physical logic gate quirks emulated in 8085 Studio.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-sm text-rose-300">SUB A Auxiliary Carry Anomaly</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                In physical 8085 silicon, subtraction is performed as <code className="text-zinc-200">A + ~B + 1</code>. When executing <code className="text-emerald-400">SUB A</code>, the lower nibble calculation guarantees a carry from bit 3 to bit 4. Therefore, <strong className="text-rose-400">AC must be 1</strong> despite result being 00H!
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-sm text-rose-300">ANA / ANI Bit-3 OR Quirk</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                On the Intel 8085, the logical AND instructions set the AC flag according to the logical OR of bit 3 of both operands: <code className="text-zinc-200">AC = (A.3 | op.3)</code>. This is due to physical ALU wiring quirks on the die.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-sm text-rose-300">DCR Silicon Carry-Out</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <code className="text-emerald-400">DCR</code> instructions add <code className="text-zinc-200">0FFH</code> to the register in hardware. If the lower nibble is non-zero, adding <code className="text-zinc-200">0FH</code> causes a carry-out, setting <strong className="text-rose-400">AC = 1</strong>. If lower nibble is 0, AC is 0.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6: SEARCHABLE ISA REFERENCE TABLE ─── */}
        <section id="isa" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/20">
                6
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-100">8085 Instruction Set Reference</h2>
                <p className="text-xs text-zinc-400">Complete searchable table of standard and undocumented instructions.</p>
              </div>
            </div>

            {/* Filter / Search Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search instruction, opcode, or group..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-64"
                />
              </div>
            </div>
          </div>

          {/* Group Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {['All', 'Data Transfer', 'Arithmetic', 'Logical', 'Branch', 'Stack & Control', 'Ghost Opcodes'].map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedGroup === grp
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
            <div className="overflow-x-auto max-h-140 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-zinc-900 text-zinc-400 font-mono text-[11px] border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Mnemonic</th>
                    <th className="py-2.5 px-3">Opcode (Hex)</th>
                    <th className="py-2.5 px-3">Bytes</th>
                    <th className="py-2.5 px-3">T-States</th>
                    <th className="py-2.5 px-3">Flags Affected</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-3">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 font-mono">
                  {filteredInstructions.map((inst, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        inst.group === 'Ghost Opcodes' ? 'bg-purple-950/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-zinc-100 flex items-center gap-1.5">
                        {inst.mnemonic}
                        {inst.group === 'Ghost Opcodes' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900/60 text-purple-300 font-sans">Ghost</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-emerald-400">{inst.opcode}</td>
                      <td className="py-2 px-3 text-zinc-400">{inst.bytes}</td>
                      <td className="py-2 px-3 text-zinc-400">{inst.cycles}</td>
                      <td className="py-2 px-3 text-amber-300/90 text-[11px]">{inst.flags}</td>
                      <td className="py-2 px-4 font-sans text-zinc-300">{inst.description}</td>
                      <td className="py-2 px-3 text-cyan-400 text-[11px]">{inst.example}</td>
                    </tr>
                  ))}
                  {filteredInstructions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 font-sans">
                        No instructions found matching &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── SECTION 7: KEYBOARD SHORTCUTS ─── */}
        <section id="shortcuts" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20">
              7
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Keyboard Shortcuts</h2>
              <p className="text-xs text-zinc-400">Boost your productivity with studio hotkeys.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Run / Simulate</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-emerald-400 font-bold">F9 or Ctrl+Enter</kbd>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Play / Pause Execution</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Space</kbd>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Step Forward</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-cyan-300">→</kbd>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Step Backward</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-cyan-300">←</kbd>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Reset Program</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-amber-300">R</kbd>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-300 font-sans">Toggle File Explorer</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Files Button</kbd>
            </div>
          </div>
        </section>

        {/* ─── BOTTOM CTA ─── */}
        <div className="border border-zinc-800 bg-linear-to-r from-emerald-950/30 via-zinc-900 to-zinc-900 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <h3 className="text-2xl font-bold text-zinc-100">Ready to write and simulate 8085 code?</h3>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            Launch the interactive studio, pick an algorithm preset, or assemble your own custom microcode with live cycle animation.
          </p>
          <div className="pt-2">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-3 text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="h-4 w-4 fill-current" />
              Open 8085 Simulator
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
