import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const suite4 = `
; 8085 Simulator Test Suite 4: Execution Engine Quirks
; Targets Self-Modifying Code, PSW mapping, and RST vectors.

ORG 0000H
JMP START

; --- RST 1 HARDWARE VECTOR ---
ORG 0008H            ; RST 1 is hardwired to jump to 0008H
JMP RST1_PASS        ; If it jumps here, the RST test passes

ORG 0100H
START:
    LXI SP, 20FFH    ; Initialize Stack

; --- TEST 11: RESTART (RST) INSTRUCTIONS ---
    RST 1            ; Pushes next PC to stack, jumps to 0008H
    JMP ERR_B        ; If RST 1 fails and falls through, error!

RST1_PASS:
    POP D            ; Clean up the stack (Pops the address of 'JMP ERR_B')

; --- TEST 12: SELF-MODIFYING CODE (SMC) ---
; Tests if the emulator authentically fetches from memory on every cycle.
    LXI H, SMC_TARGET
    MVI M, 00H       ; 00H is 'NOP'. We are overwriting the HLT instruction!
SMC_TARGET:
    HLT              ; If emulator caches code, it halts here. If authentic, it executes NOP.

; --- TEST 13: PSW (PROGRAM STATUS WORD) HIJACKING ---
; POP PSW directly overwrites the Flag register.
; We will push C1H (11000001 in binary) -> Sign=1, Zero=1, Parity=0, Carry=1
    LXI H, 00C1H     ; H = 00H (Accumulator), L = C1H (Flags)
    PUSH H           ; Put it on the stack
    POP PSW          ; Pop directly into Accumulator and Flag Register!
    
    JM SIGN_PASS     ; Sign is 1, should jump
    JMP ERR_D
SIGN_PASS:
    JZ ZERO_PASS     ; Zero is 1, should jump
    JMP ERR_D
ZERO_PASS:
    JC CARRY_PASS    ; Carry is 1, should jump
    JMP ERR_D
CARRY_PASS:
    JPO PARITY_PASS  ; Parity is 0 (Odd), should jump
    JMP ERR_D
PARITY_PASS:

; --- TEST 14: STACK POINTER UNDERFLOW ---
; The SP must seamlessly roll backwards from 0000H to FFFFH.
    LXI SP, 0000H
    DCX SP           ; SP should roll under to FFFFH
    LXI H, 0000H
    DAD SP           ; HL = HL + SP (0000H + FFFFH)
    MOV A, H
    CPI 0FFH         ; Check if High byte is FF
    JNZ ERR_E

; =========================================
; --- PASS EXIT ---
SUCCESS:
    MVI A, 0CCH      ; CC = Core Complete!
    STA 3000H
    HLT

; =========================================
; --- ERROR EXITS ---
ERR_B: MVI A, 0EBH
       JMP HALT_ERR
ERR_C: MVI A, 0ECH   ; Note: SMC failure will usually just result in a system freeze at HLT
       JMP HALT_ERR
ERR_D: MVI A, 0EDH
       JMP HALT_ERR
ERR_E: MVI A, 0EEH
       JMP HALT_ERR

HALT_ERR:
    LXI SP, 20FFH    ; Reset SP just in case it was corrupted
    STA 3000H        ; Store specific error code
    HLT
`;

const assembler = new Assembler8085();
const res = assembler.assemble(suite4);
console.log('Hex dump:\n', res.hexDump);
const cpu = new CPU8085();
cpu.reset(res.startAddress);
cpu.loadProgram(res.startAddress, res.machineCode);
const trace = cpu.simulate(res.addressLineMap, 500);

for (const step of trace) {
  console.log(`Step ${step.stepIndex}: PC=0x${step.address.toString(16).padStart(4, '0')} ${step.instruction} - ${step.description}`);
}

console.log('Total Steps:', trace.length);
console.log('Result at 3000H:', '0x' + cpu.memory[0x3000].toString(16).toUpperCase());
