import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const suite6 = `
; 8085 Simulator Test Suite 6: Silicon Anomalies & Microcode Quirks
; WARNING: This test will fail almost all high-level language emulators.

ORG 0000H
JMP START

ORG 0100H
START:
    LXI SP, 20FFH

; --- TEST 17: THE "SUB A" AUXILIARY CARRY (AC) ANOMALY ---
; SUB A is calculated in silicon as A + ~A + 1. 
; This guarantees a carry-out from bit 3 to bit 4. AC must be 1!
    MVI A, 55H
    SUB A            ; Result = 00H. Z = 1, CY = 0, AC = 1
    JNZ ERR_11       ; Zero must be 1
    JC  ERR_11       ; Carry must be 0
    PUSH PSW
    POP B
    MOV A, C         ; C contains the flags register byte
    ANI 10H          ; Mask everything except bit 4 (the AC flag)
    JZ ERR_11        ; ERROR! AC was 0. Your emulator uses standard subtraction, not 2's complement logic.

; --- TEST 18: THE "ANA" BIT-3 OR QUIRK ---
; Logical AND sets the AC flag to the logical OR of bit 3 of the two operands.
    MVI A, 07H       ; Bit 3 is 0
    ANI 07H          ; Bit 3 is 0. AC should be 0.
    PUSH PSW
    POP B
    MOV A, C
    ANI 10H          
    JNZ ERR_12       ; ERROR! AC was 1.

    MVI A, 08H       ; Bit 3 is 1
    ANI 00H          ; Bit 3 is 0. 1 OR 0 = 1. AC must be 1!
    PUSH PSW
    POP B
    MOV A, C
    ANI 10H
    JZ ERR_12        ; ERROR! AC was 0. Your emulator doesn't simulate the 8085 ALU bit-3 wiring anomaly.

; --- TEST 19: XTHL MEMORY BUS OVERFLOW ---
; XTHL at SP=FFFFH must read/write to FFFFH and 0000H.
    MVI A, 0BBH
    STA 0FFFFH       ; Write BB to very end of memory
    MVI A, 0AAH
    STA 0000H        ; Write AA to very beginning of memory

    LXI SP, 0FFFFH
    LXI H, 1122H
    XTHL             ; H should become AA, L should become BB.
                     ; Memory at FFFF should become 22, 0000 should become 11.
    MOV A, H
    CPI 0AAH
    JNZ ERR_13
    MOV A, L
    CPI 0BBH
    JNZ ERR_13
    
    LDA 0FFFFH
    CPI 22H
    JNZ ERR_13
    LDA 0000H
    CPI 11H
    JNZ ERR_13

; --- TEST 20: DCR CARRY-OUT VS BORROW ---
; DCR adds FFH in silicon. 
    MVI A, 01H
    DCR A            ; 01H + FFH. Lower nibble: 1 + F = 10 (Carry out = 1, so AC = 1).
    PUSH PSW
    POP B
    MOV A, C
    ANI 10H          
    JZ ERR_14        ; ERROR! AC was 0. DCR from 01H must set AC=1.

    MVI A, 10H
    DCR A            ; 10H + FFH. Lower nibble: 0 + F = F (Carry out = 0, so AC = 0).
    PUSH PSW
    POP B
    MOV A, C
    ANI 10H          
    JNZ ERR_14       ; ERROR! AC was 1. DCR from 10H must set AC=0.

; =========================================
; --- PASS EXIT ---
SUCCESS:
    LXI SP, 20FFH
    MVI A, 077H      ; 77 = Absolute Silicon Accuracy!
    STA 3000H
    HLT

; =========================================
; --- ERROR EXITS ---
ERR_11: LXI SP, 20FFH
        MVI A, 0F1H
        JMP HALT_ERR
ERR_12: LXI SP, 20FFH
        MVI A, 0F2H
        JMP HALT_ERR
ERR_13: LXI SP, 20FFH
        MVI A, 0F3H
        JMP HALT_ERR
ERR_14: LXI SP, 20FFH
        MVI A, 0F4H
        JMP HALT_ERR

HALT_ERR:
    STA 3000H        ; Store specific error code
    HLT
`;

const assembler = new Assembler8085();
const res = assembler.assemble(suite6);
console.log('Assemble success:', res.success, 'Diagnostics:', res.diagnostics);
const cpu = new CPU8085();
cpu.reset(res.startAddress);
cpu.loadProgram(res.startAddress, res.machineCode);
const trace = cpu.simulate(res.addressLineMap, 500);

for (const step of trace) {
  console.log(`Step ${step.stepIndex}: PC=0x${step.address.toString(16).padStart(4, '0')} ${step.instruction} - ${step.description}`);
}

console.log('Total Steps:', trace.length);
console.log('Result at 3000H:', '0x' + cpu.memory[0x3000].toString(16).toUpperCase());
