import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const testPrograms = [
  {
    name: 'Case 1: LXI H + MVI M + MOV A, M',
    code: `
LXI H, 2050H
MVI M, 42H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 2: LXI H + MOV M, A + MOV A, M',
    code: `
MVI A, 99H
LXI H, 2050H
MOV M, A
MVI A, 00H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 3: LXI HL instead of LXI H',
    code: `
LXI HL, 2050H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 4: MVI H and MVI L then MOV A, M',
    code: `
MVI H, 20H
MVI L, 50H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 5: MOV A,M without space',
    code: `
LXI H, 2050H
MOV A,M
HLT
    `
  },
  {
    name: 'Case 6: DB directive data storage',
    code: `
LXI H, DATA
MOV A, M
HLT
DATA: DB 77H
    `
  },
  {
    name: 'Case 7: MOV H, 20H (immediate with MOV)',
    code: `
MOV H, 20H
MOV L, 50H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 8: MOV M, 42H (immediate with MOV)',
    code: `
LXI H, 2050H
MOV M, 42H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 9: SHLD then LXI H then MOV A, M',
    code: `
MVI A, 33H
STA 2050H
LHLD 2050H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 10: MOV A, [HL]',
    code: `
LXI H, 2050H
MOV A, [HL]
HLT
    `
  },
  {
    name: 'Case 11: MOV A, (HL)',
    code: `
LXI H, 2050H
MOV A, (HL)
HLT
    `
  },
  {
    name: 'Case 12: MVI M with decimal',
    code: `
LXI H, 2050H
MVI M, 50
MOV A, M
HLT
    `
  },
  {
    name: 'Case 13: Address starting with letter without 0',
    code: `
LXI H, A050H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 14: LXI H, 2050 (hex address written without H)',
    code: `
LXI H, 2050
MOV A, M
HLT
    `
  },
  {
    name: 'Case 15: Colon-less label',
    code: `
START LXI H, 2050H
MVI M, 88H
LOOP MOV A, M
HLT
    `
  },
  {
    name: 'Case 16: CMP with immediate instead of CPI',
    code: `
MVI A, 05H
CMP 05H
HLT
    `
  },
  {
    name: 'Case 17: LDAX H fallback to MOV A, M',
    code: `
LXI H, 2050H
MVI M, 64H
LDAX H
HLT
    `
  },
  {
    name: 'Case 18: STAX H fallback to MOV M, A',
    code: `
MVI A, 45H
LXI H, 2050H
STAX H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 19: MVI HL, 2050H fallback to LXI H',
    code: `
MVI HL, 2050H
MVI M, 77H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 20: MOV HL, 2050H fallback to LXI H',
    code: `
MOV HL, 2050H
MVI M, 88H
MOV A, M
HLT
    `
  },
  {
    name: 'Case 21: MOV A, [2050H] direct memory fallback to LDA',
    code: `
MVI A, 33H
STA 2050H
MVI A, 00H
MOV A, [2050H]
HLT
    `
  },
  {
    name: 'Case 22: MOV [2050H], A direct memory fallback to STA',
    code: `
MVI A, 55H
MOV [2050H], A
MVI A, 00H
LDA 2050H
HLT
    `
  },
  {
    name: 'Case 23: MOV A, MEM (normalize MEM to M)',
    code: `
LXI H, 2050H
MVI MEM, 19H
MOV A, MEM
HLT
    `
  },
  {
    name: 'Case 24: MOV A, [H, L] with bracketed comma',
    code: `
LXI H, 2050H
MVI M, 91H
MOV A, [H, L]
HLT
    `
  },
  {
    name: 'Case 25: MOV A, M[HL] notation',
    code: `
LXI H, 2050H
MVI M, 12H
MOV A, M[HL]
HLT
    `
  },
  {
    name: 'Case 26: Preloaded memory at 2050H loaded into A via MOV A, M',
    code: `
LXI H, 2050H
MOV A, M
HLT
    `,
    initialMemory: [{ address: 0x2050, values: [0xBE] }],
    expectedA: 0xBE
  }
];

let failed = 0;
for (const t of testPrograms) {
  const asm = new Assembler8085();
  const res = asm.assemble(t.code);
  if (!res.success) {
    console.log('FAIL:', t.name, '->', res.diagnostics.map(d => d.message).join('; '));
    failed++;
  } else {
    const cpu = new CPU8085();
    if ((t as any).initialMemory) {
      for (const block of (t as any).initialMemory) {
        for (let i = 0; i < block.values.length; i++) {
          cpu.memory[(block.address + i) & 0xFFFF] = block.values[i];
        }
      }
    }
    cpu.loadProgram(res.startAddress, res.machineCode);
    const steps = cpu.simulate(res.addressLineMap);
    const finalA = cpu.getRegisterState().A;
    if ((t as any).expectedA !== undefined && finalA !== (t as any).expectedA) {
      console.log('FAIL (Value Mismatch):', t.name, `Expected: ${(t as any).expectedA.toString(16)}H, got: ${finalA.toString(16)}H`);
      failed++;
    } else {
      console.log('PASS:', t.name, `(${steps.length} steps, Final A: ${finalA.toString(16).toUpperCase()}H)`);
    }
  }
}
console.log(`\nTotal: ${testPrograms.length}, Failed: ${failed}`);
