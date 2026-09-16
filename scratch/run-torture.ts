import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const originalTortureTest = `
; 8085 Simulator Torture Test
; Targets edge cases, undocumented flag behaviors, and complex instructions

ORG 0000H
JMP START

ORG 0100H
START:
    LXI SP, 20FFH    ; Initialize Stack

; --- TEST 1: ROTATES AND CARRY (RRC, RAL) ---
    MVI A, 81H       ; A = 10000001
    RRC              ; Rotate Right. A becomes 11000000 (C0H), Carry = 1
    JC L1_PART2      ; Jump if Carry is 1
    JMP ERR_1        ; Error: Carry wasn't set by RRC
L1_PART2:
    CPI 0C0H         ; Check if A rotated correctly
    JNZ ERR_1
    RAL              ; Rotate Left thru Carry. A becomes 10000001 (81H), Carry = 1
    JC L1_PART3
    JMP ERR_1
L1_PART3:
    CPI 81H
    JNZ ERR_1

; --- TEST 2: DAA (DECIMAL ADJUST ACCUMULATOR) ---
    MVI A, 38H       ; Load BCD 38
    ADI 45H          ; Add BCD 45. Hex result is 7DH.
    DAA              ; Adjust to BCD 83 (7D -> 83)
    CPI 83H
    JNZ ERR_2

; --- TEST 3: LOGICALS, PARITY, AND SIGN FLAGS ---
    MVI A, 0AAH      ; A = 10101010
    XRA A            ; XOR with itself. A becomes 00H. Sets Zero=1, Parity=1(Even), Sign=0, Carry=0.
    JNZ ERR_3        ; Error: A should be Zero
    JPO ERR_3        ; Error: Parity of 00H is Even (1). JPO jumps if Odd (0).
    JM  ERR_3        ; Error: Sign should be Plus (0).
    JC  ERR_3        ; Error: XRA must clear the Carry flag!

; --- TEST 4: INX/DCX FLAG PRESERVATION ---
; 16-bit increments/decrements MUST NOT affect condition flags.
    MVI A, 01H
    ORA A            ; We do this to explicitly force the Zero flag to 0.
    LXI B, 0FFFFH    ; Load BC with FFFF
    INX B            ; BC rolls over to 0000. 
    JZ ERR_4         ; ERROR! INX should NOT touch the Zero flag. If it jumped, your INX is bugged.

; --- TEST 5: ADVANCED STACK (XTHL) ---
    LXI H, 1234H
    PUSH H           ; Push 1234H to stack
    LXI H, 5678H
    XTHL             ; Exchange HL with top of stack. HL becomes 1234H. Stack holds 5678H.
    MOV A, H
    CPI 12H          ; Did H update correctly?
    JNZ ERR_5
    MOV A, L
    CPI 34H          ; Did L update correctly?
    JNZ ERR_5
    POP B            ; Pop stack into BC. B should be 56H, C should be 78H.
    MOV A, B
    CPI 56H
    JNZ ERR_5
    
; =========================================
; --- PASS EXIT ---
SUCCESS:
    MVI A, 0FFH      ; FF = Ultimate Success
    STA 3000H
    HLT

; =========================================
; --- ERROR EXITS ---
ERR_1: MVI A, 0E1H
       JMP HALT_ERR
ERR_2: MVI A, 0E2H
       JMP HALT_ERR
ERR_3: MVI A, 0E3H
       JMP HALT_ERR
ERR_4: MVI A, 0E4H
       JMP HALT_ERR
ERR_5: MVI A, 0E5H
       JMP HALT_ERR

HALT_ERR:
    STA 3000H        ; Store specific error code
    HLT
`;

const assembler = new Assembler8085();
const res = assembler.assemble(originalTortureTest);
console.log('Assembled successfully:', res.success);
const cpu = new CPU8085();
cpu.reset(res.startAddress);
cpu.loadProgram(res.startAddress, res.machineCode);
const trace = cpu.simulate(res.addressLineMap, 500);
console.log('Total Steps Executed:', trace.length);
console.log('Result at 3000H:', '0x' + cpu.memory[0x3000].toString(16).toUpperCase());
