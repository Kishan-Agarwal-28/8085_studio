import { Assembler8085 } from '../lib/8085/assembler';
import { CPU8085 } from '../lib/8085/cpu';

const suite5 = `
; 8085 Simulator Test Suite 5: The Final Boss
; Targets EI, DI, SIM (Set Interrupt Mask), and RIM (Read Interrupt Mask)

ORG 0000H
JMP START

ORG 0100H
START:
    LXI SP, 20FFH    ; Initialize Stack

; --- TEST 15: EI, DI, and the IE Flip-Flop ---
    DI               ; Disable Interrupts (IE Flip-Flop = 0)
    RIM              ; Read Interrupt Mask into Accumulator
    MOV B, A         ; Save RIM result in B
    MVI A, 08H       ; 08H = 00001000 in binary (Bit 3 is the IE flag in RIM)
    ANA B            ; Bitwise AND to isolate the IE bit
    JNZ ERR_F        ; Error: IE bit should be 0 because we called DI

    EI               ; Enable Interrupts (IE Flip-Flop = 1)
    RIM              ; Read Interrupt Mask into Accumulator
    MOV B, A
    MVI A, 08H       
    ANA B            
    JZ ERR_F         ; Error: IE bit should be 1 because we called EI
    DI               ; Turn interrupts back off for safety

; --- TEST 16: SIM and RIM Masking ---
; We will use SIM to mask RST 7.5 and RST 5.5, but leave RST 6.5 unmasked.
; SIM Data Format: 
; Bit 0=M5.5, Bit 1=M6.5, Bit 2=M7.5, Bit 3=Mask Set Enable (MSE)
    MVI A, 0DH       ; 0DH = 00001101 binary. (MSE=1, M7.5=1, M6.5=0, M5.5=1)
    SIM              ; Apply the mask to the hardware

    MVI A, 00H       ; Clear A
    RIM              ; Read the mask back from the hardware
    
    ; RIM Format: Bits 0, 1, 2 represent the current M5.5, M6.5, M7.5 masks.
    ; Since we just set them to 1, 0, 1, the lower 3 bits of A must be 101 (05H).
    MOV B, A
    MVI A, 07H       ; Mask out everything except the bottom 3 bits
    ANA B
    CPI 05H          ; Did RIM accurately report the masks we set?
    JNZ ERR_G

; =========================================
; --- PASS EXIT ---
SUCCESS:
    MVI A, 99H       ; 99 = Simulator is 100% Complete!
    STA 3000H
    HLT

; =========================================
; --- ERROR EXITS ---
ERR_F: MVI A, 0EFH
       JMP HALT_ERR
ERR_G: MVI A, 0E0H
       JMP HALT_ERR

HALT_ERR:
    STA 3000H        ; Store specific error code
    HLT
`;

const assembler = new Assembler8085();
const res = assembler.assemble(suite5);
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
