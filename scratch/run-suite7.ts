import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const suite7 = `
; 8085 Simulator Test Suite 7: The Undocumented "Ghost" Opcodes
; Tests the 10 secret instructions hidden in the 8085 silicon.

ORG 0000H
JMP START

ORG 0100H
START:
    LXI SP, 20FFH

; --- TEST 21: DSUB (08H) - 16-bit Subtract ---
; Like DAD, but subtracts BC from HL. Modifies ALL flags!
    LXI H, 1000H
    LXI B, 0001H
    DB 08H           ; Execute DSUB. HL = 1000H - 0001H = 0FFFH.
    
    MOV A, H
    CPI 0FH          ; H should be 0F
    JNZ ERR_15
    MOV A, L
    CPI 0FFH         ; L should be FF
    JNZ ERR_15

; --- TEST 22: ARHL (10H) - Arithmetic Shift Right HL ---
; Shifts HL right by 1 bit. Bit 15 is duplicated (Sign preserved). Bit 0 goes to Carry.
    LXI H, 8001H     ; Binary: 10000000 00000001
    ORA A            ; Clear Carry flag
    DB 10H           ; Execute ARHL. HL becomes C000H. Carry becomes 1.
    
    MOV A, H
    CPI 0C0H         ; Binary: 11000000
    JNZ ERR_16
    MOV A, L
    CPI 00H
    JNZ ERR_16
    JNC ERR_16       ; ERROR! Bit 0 was a 1, so Carry must be set.

; --- TEST 23: SHLX (D9H) and LHLX (EDH) ---
; 16-bit indirect load/store using DE as the pointer (like a 16-bit STAX/LDAX)
    LXI D, 3200H     ; DE points to memory 3200H
    LXI H, 0AABBH    ; Data to store
    DB 0D9H          ; Execute SHLX. Stores L at (DE) and H at (DE+1)
    
    LXI H, 0000H     ; Clear HL to prove we are actually reading from memory
    DB 0EDH          ; Execute LHLX. Loads L from (DE) and H from (DE+1)
    
    MOV A, H
    CPI 0AAH
    JNZ ERR_17
    MOV A, L
    CPI 0BBH
    JNZ ERR_17

; --- TEST 24: RDEL (18H) - Rotate DE Left through Carry ---
; A 16-bit rotate through the carry flag, operating on the DE register pair.
    LXI D, 8001H     ; DE = 8001H
    STC              ; Set Carry = 1
    DB 18H           ; Execute RDEL. DE becomes 0003H, Carry becomes 1.
    
    MOV A, D
    CPI 00H
    JNZ ERR_18
    MOV A, E
    CPI 03H
    JNZ ERR_18
    JNC ERR_18       ; The highest bit of D (1) should have rotated into the Carry flag.

; =========================================
; --- PASS EXIT ---
SUCCESS:
    LXI SP, 20FFH
    MVI A, 88H       ; 88 = The Hidden 8085 Master!
    STA 3000H
    HLT

; =========================================
; --- ERROR EXITS ---
ERR_15: MVI A, 0F5H
        JMP HALT_ERR
ERR_16: MVI A, 0F6H
        JMP HALT_ERR
ERR_17: MVI A, 0F7H
        JMP HALT_ERR
ERR_18: MVI A, 0F8H
        JMP HALT_ERR

HALT_ERR:
    LXI SP, 20FFH
    STA 3000H        
    HLT
`;

const assembler = new Assembler8085();
const res = assembler.assemble(suite7);
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
