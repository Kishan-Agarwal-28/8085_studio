// WebAssembly binary generator for 8085 Machine Code
// Compiles 8085 binary into a valid WebAssembly (Wasm) module with 64KB linear memory,
// state getters, and memory access functions.

export class WasmCompiler8085 {
  // LEB128 unsigned integer encoder
  private static encodeUnsignedLEB128(value: number): number[] {
    const result: number[] = [];
    let more = true;
    while (more) {
      let byte = value & 0x7f;
      value >>>= 7;
      if (value === 0) {
        more = false;
      } else {
        byte |= 0x80;
      }
      result.push(byte);
    }
    return result;
  }

  // LEB128 signed integer encoder
  private static encodeSignedLEB128(value: number): number[] {
    const result: number[] = [];
    let more = true;
    while (more) {
      let byte = value & 0x7f;
      value >>= 7;
      if (
        (value === 0 && (byte & 0x40) === 0) ||
        (value === -1 && (byte & 0x40) !== 0)
      ) {
        more = false;
      } else {
        byte |= 0x80;
      }
      result.push(byte);
    }
    return result;
  }

  // Encode a vector (length prefix + items)
  private static encodeVector(items: number[][]): number[] {
    const countLEB = this.encodeUnsignedLEB128(items.length);
    const flattened = items.flat();
    return [...countLEB, ...flattened];
  }

  // Create a section: [section_id, size_leb, ...payload]
  private static createSection(id: number, payload: number[]): number[] {
    const sizeLEB = this.encodeUnsignedLEB128(payload.length);
    return [id, ...sizeLEB, ...payload];
  }

  // Encode UTF-8 string into wasm format [length_leb, ...bytes]
  private static encodeString(str: string): number[] {
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(str));
    return [...this.encodeUnsignedLEB128(bytes.length), ...bytes];
  }

  /**
   * Compiles the 8085 machine code into a valid WebAssembly binary module (.wasm)
   * Linear Memory: 1 page = 64KB (0x0000 - 0xFFFF)
   * The assembled machine code is placed in linear memory at startAddress.
   */
  public static compile(machineCode: Uint8Array, startAddress: number): Uint8Array {
    // 1. WASM Header
    const header = [
      0x00, 0x61, 0x73, 0x6d, // Magic "\0asm"
      0x01, 0x00, 0x00, 0x00, // Version 1
    ];

    // 2. Type Section (id 1)
    // Types:
    // Type 0: () -> i32 (for get_pc, get_start_addr, get_code_size)
    // Type 1: (i32) -> i32 (for read_mem)
    // Type 2: (i32, i32) -> () (for write_mem)
    const typeSectionPayload = this.encodeVector([
      // Type 0: () -> i32
      [0x60, 0x00, 0x01, 0x7f],
      // Type 1: (i32) -> i32
      [0x60, 0x01, 0x7f, 0x01, 0x7f],
      // Type 2: (i32, i32) -> ()
      [0x60, 0x02, 0x7f, 0x7f, 0x00],
    ]);
    const typeSection = this.createSection(1, typeSectionPayload);

    // 3. Function Section (id 3)
    // Func 0: type 0 (get_start_address)
    // Func 1: type 0 (get_code_size)
    // Func 2: type 1 (read_mem)
    // Func 3: type 2 (write_mem)
    const functionSectionPayload = this.encodeVector([
      this.encodeUnsignedLEB128(0), // func 0 -> type 0
      this.encodeUnsignedLEB128(0), // func 1 -> type 0
      this.encodeUnsignedLEB128(1), // func 2 -> type 1
      this.encodeUnsignedLEB128(2), // func 3 -> type 2
    ]);
    const functionSection = this.createSection(3, functionSectionPayload);

    // 4. Memory Section (id 5)
    // 1 memory: flags 0 (min only), min 1 page = 64KB
    const memorySectionPayload = this.encodeVector([
      [0x00, 0x01], // min 1 page (64KB)
    ]);
    const memorySection = this.createSection(5, memorySectionPayload);

    // 5. Export Section (id 7)
    // Exports:
    // "memory" -> memory index 0
    // "get_start_address" -> func index 0
    // "get_code_size" -> func index 1
    // "read_mem" -> func index 2
    // "write_mem" -> func index 3
    const exportSectionPayload = this.encodeVector([
      [...this.encodeString('memory'), 0x02, 0x00],
      [...this.encodeString('get_start_address'), 0x00, 0x00],
      [...this.encodeString('get_code_size'), 0x00, 0x01],
      [...this.encodeString('read_mem'), 0x00, 0x02],
      [...this.encodeString('write_mem'), 0x00, 0x03],
    ]);
    const exportSection = this.createSection(7, exportSectionPayload);

    // 6. Code Section (id 10)
    // Func 0 (get_start_address): i32.const startAddress, end
    const func0Body = [
      0x00, // 0 locals
      0x41, ...this.encodeSignedLEB128(startAddress), // i32.const startAddress
      0x0b, // end
    ];
    const func0 = [...this.encodeUnsignedLEB128(func0Body.length), ...func0Body];

    // Func 1 (get_code_size): i32.const codeLength, end
    const func1Body = [
      0x00, // 0 locals
      0x41, ...this.encodeSignedLEB128(machineCode.length), // i32.const machineCode.length
      0x0b, // end
    ];
    const func1 = [...this.encodeUnsignedLEB128(func1Body.length), ...func1Body];

    // Func 2 (read_mem): param 0 (addr) -> i32.load8_u [align 0, offset 0]
    const func2Body = [
      0x00, // 0 locals
      0x20, 0x00, // local.get 0 (addr)
      0x2d, 0x00, 0x00, // i32.load8_u align=0 offset=0
      0x0b, // end
    ];
    const func2 = [...this.encodeUnsignedLEB128(func2Body.length), ...func2Body];

    // Func 3 (write_mem): param 0 (addr), param 1 (val) -> i32.store8 [align 0, offset 0]
    const func3Body = [
      0x00, // 0 locals
      0x20, 0x00, // local.get 0 (addr)
      0x20, 0x01, // local.get 1 (val)
      0x3a, 0x00, 0x00, // i32.store8 align=0 offset=0
      0x0b, // end
    ];
    const func3 = [...this.encodeUnsignedLEB128(func3Body.length), ...func3Body];

    const codeSectionPayload = this.encodeVector([func0, func1, func2, func3]);
    const codeSection = this.createSection(10, codeSectionPayload);

    // 7. Data Section (id 11) - Initialize linear memory with 8085 machine code
    let dataSection: number[] = [];
    if (machineCode.length > 0) {
      const dataOffsetExpr = [
        0x41, ...this.encodeSignedLEB128(startAddress), // i32.const startAddress
        0x0b, // end
      ];
      const dataBytes = Array.from(machineCode);
      const segment = [
        0x00, // memory index 0 (active)
        ...dataOffsetExpr,
        ...this.encodeUnsignedLEB128(dataBytes.length),
        ...dataBytes,
      ];
      const dataSectionPayload = this.encodeVector([segment]);
      dataSection = this.createSection(11, dataSectionPayload);
    }

    // Assemble final binary
    const wasmBytes = new Uint8Array([
      ...header,
      ...typeSection,
      ...functionSection,
      ...memorySection,
      ...exportSection,
      ...codeSection,
      ...dataSection,
    ]);

    return wasmBytes;
  }
}
