export interface PresetProgram {
  id: string;
  name: string;
  category: string;
  description: string;
  initialMemory?: { address: number; values: number[] }[];
  code: string;
}

export const PRESET_PROGRAMS: PresetProgram[] = [
  {
    id: 'two-pointers-reverse',
    name: 'Two-Pointer Array Reverse (L & R Pointers)',
    category: 'Algorithm',
    description: 'Reverses an array in memory (2050H-2054H) using Left (H-L) and Right (D-E) pointers converging inward.',
    initialMemory: [
      { address: 0x2050, values: [0x11, 0x22, 0x33, 0x44, 0x55] },
    ],
    code: `; ============================================
; Program: Two-Pointer Array In-Place Reversal
; Demonstrates 'L' (HL) and 'R' (DE) pointers
; converging and swapping elements in memory.
; Array located at 2050H - 2054H: [11, 22, 33, 44, 55]
; ============================================
ORG 2000H

; Initialize Left Pointer (HL) to array start
LXI H, 2050H      ; L pointer = 2050H

; Initialize Right Pointer (DE) to array end
LXI D, 2054H      ; R pointer = 2054H

LOOP:
  ; Check if L pointer >= R pointer
  MOV A, E        ; Compare lower bytes of pointers
  CMP L
  JC DONE         ; If R < L, we are done
  JZ DONE         ; If R == L, middle reached, done

  ; Read element at Left Pointer [HL]
  MOV B, M        ; B = [L]

  ; Read element at Right Pointer [DE]
  LDAX D          ; A = [R]

  ; Swap elements
  MOV M, A        ; [L] = A (old [R])
  MOV A, B        ; A = old [L]
  STAX D          ; [R] = A

  ; Move L pointer forward, R pointer backward
  INX H           ; L = L + 1
  DCX D           ; R = R - 1

  JMP LOOP        ; Repeat for next pair

DONE:
  HLT             ; Halt processor
`,
  },
  {
    id: 'block-transfer',
    name: 'Block Data Transfer (HL to DE)',
    category: 'Data Transfer',
    description: 'Transfers a 5-byte block of data from source (2050H) to destination (2060H) using HL, DE, and counter C.',
    initialMemory: [
      { address: 0x2050, values: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE] },
      { address: 0x2060, values: [0x00, 0x00, 0x00, 0x00, 0x00] },
    ],
    code: `; ============================================
; Program: Block Data Transfer
; Copies 5 bytes from source (2050H) to dest (2060H)
; Watch data move: Memory[HL] -> A -> Memory[DE]
; ============================================
ORG 2000H

LXI H, 2050H      ; Source memory pointer (HL)
LXI D, 2060H      ; Destination memory pointer (DE)
MVI C, 05H        ; Loop counter = 5 bytes

COPY_LOOP:
  MOV A, M        ; Read byte from Source [HL] into A
  STAX D          ; Store byte from A into Dest [DE]

  INX H           ; Increment source pointer
  INX D           ; Increment destination pointer
  DCR C           ; Decrement counter
  JNZ COPY_LOOP   ; If counter != 0, repeat loop

HLT               ; Execution complete
`,
  },
  {
    id: 'bubble-sort',
    name: 'Bubble Sort (Memory Array Sorting)',
    category: 'Algorithm',
    description: 'Sorts 4 numbers in ascending order at 2050H by comparing adjacent elements and conditionally swapping them.',
    initialMemory: [
      { address: 0x2050, values: [0x45, 0x12, 0x89, 0x03] },
    ],
    code: `; ============================================
; Program: Bubble Sort (Ascending Order)
; Array: [45H, 12H, 89H, 03H] at 2050H - 2053H
; ============================================
ORG 2000H

MVI C, 03H        ; Outer loop passes (N - 1 = 3)

OUTER_LOOP:
  LXI H, 2050H    ; Start at array base
  MOV D, C        ; D = inner loop comparison count

INNER_LOOP:
  MOV A, M        ; A = current element [HL]
  INX H           ; HL points to next element
  CMP M           ; Compare A with [HL+1]
  JC NO_SWAP      ; If A < [HL+1], no swap needed

  ; Swap elements
  MOV B, M        ; B = [HL+1]
  MOV M, A        ; [HL+1] = A (larger value)
  DCX H           ; HL points back to [HL]
  MOV M, B        ; [HL] = B (smaller value)
  INX H           ; Restore HL to next element

NO_SWAP:
  DCR D           ; Decrement inner counter
  JNZ INNER_LOOP  ; Continue inner loop

  DCR C           ; Decrement outer pass counter
  JNZ OUTER_LOOP  ; Continue outer loop

HLT               ; Array is sorted!
`,
  },
  {
    id: 'math-flags',
    name: 'Arithmetic & Status Flag Dynamics',
    category: 'Math',
    description: 'Demonstrates ADD, SUB, INR, DCR, and BCD Decimal Adjust (DAA) while observing Carry, Zero, and Sign flags.',
    code: `; ============================================
; Program: Arithmetic & Flag Visualizer
; Watch status flags (Z, CY, S, P, AC) update!
; ============================================
ORG 2000H

; 1. Addition & Carry Flag
MVI A, 0F0H       ; A = 240
MVI B, 020H       ; B = 32
ADD B             ; A = F0H + 20H = 10H (overflows 255, CY=1)

; 2. Subtraction & Zero Flag
MVI A, 42H        ; A = 42
MVI C, 42H        ; C = 42
SUB C             ; A = 42 - 42 = 0 (Z=1, CY=0)

; 3. Increment & Decrement
MVI D, 01H        ; D = 1
DCR D             ; D = 0 (Z flag sets)
INR D             ; D = 1 (Z flag clears)

; 4. BCD Addition and DAA
MVI A, 38H        ; BCD 38
MVI E, 45H        ; BCD 45
ADD E             ; 38 + 45 = 7DH (hex)
DAA               ; Decimal Adjust -> 83H (BCD 83)

HLT
`,
  },
  {
    id: 'stack-subroutine',
    name: 'Stack Operations & Subroutine CALL / RET',
    category: 'Subroutine',
    description: 'Demonstrates Stack Pointer (SP) behavior, PUSH, POP, CALL subroutine, and RET return mechanism.',
    code: `; ============================================
; Program: Subroutine Call and Stack
; Watch SP decrement on PUSH/CALL and increment on POP/RET
; ============================================
ORG 2000H

LXI SP, 20F0H     ; Initialize Stack Pointer
MVI A, 05H        ; A = 5
MVI B, 0AH        ; B = 10

PUSH B            ; Push B-C onto stack
CALL DOUBLE_A     ; Call subroutine
POP B             ; Restore B-C from stack

HLT

; Subroutine: Doubles Accumulator
DOUBLE_A:
  ADD A           ; A = A + A
  RET             ; Return to caller
`,
  },
];
