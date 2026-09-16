import { CompileDiagnostic, CompileResult } from './types';

interface ParsedLine {
  lineNum: number;
  label?: string;
  mnemonic?: string;
  operands: string[];
  rawText: string;
  address: number;
  byteCount: number;
  bytes: number[];
}

const KNOWN_MNEMONICS = new Set([
  'NOP', 'HLT', 'EI', 'DI', 'RIM', 'SIM', 'DAA', 'CMA', 'CMC', 'STC',
  'RLC', 'RRC', 'RAL', 'RAR', 'XCHG', 'XTHL', 'SPHL', 'PCHL',
  'RET', 'RC', 'RNC', 'RZ', 'RNZ', 'RP', 'RM', 'RPE', 'RPO',
  'LDAX', 'STAX', 'PUSH', 'POP', 'INX', 'DCX', 'DAD',
  'ADD', 'ADC', 'SUB', 'SBB', 'ANA', 'XRA', 'ORA', 'CMP',
  'INR', 'DCR', 'MOV', 'MVI', 'LXI', 'LDA', 'STA', 'LHLD', 'SHLD',
  'ADI', 'ACI', 'SUI', 'SBI', 'ANI', 'XRI', 'ORI', 'CPI',
  'IN', 'OUT', 'JMP', 'JC', 'JNC', 'JZ', 'JNZ', 'JP', 'JM', 'JPE', 'JPO',
  'CALL', 'CC', 'CNC', 'CZ', 'CNZ', 'CP', 'CM', 'CPE', 'CPO',
  'RST', 'DB', 'DW', 'DS', 'DEFB', 'DEFW', 'DEFS', 'RESERVE', 'SPACE',
  'DSUB', 'ARHL', 'RDEL', 'LDHI', 'LDSI', 'SHLX', 'LHLX', 'RSTV', 'JNK', 'JK',
  'EQU', 'ORG', 'END',
]);

export class Assembler8085 {
  private diagnostics: CompileDiagnostic[] = [];
  private symbolTable: Map<string, number> = new Map();
  private origin = 0x2000; // Standard 8085 starting RAM address

  // Normalize register symbols and memory notations:
  // e.g. [HL], (HL), [H-L], (H-L), @HL, @H, MEM, MEMORY, [M], (M), M[HL] -> M
  // e.g. [BC], (BC), BC -> B
  // e.g. [DE], (DE), DE -> D
  // e.g. [H], (H), HL -> H
  // e.g. AF -> PSW
  public normalizeReg(r: string): string {
    const clean = r.trim().toUpperCase();
    if (['[HL]', '(HL)', '[H-L]', '(H-L)', '@HL', '@H', 'M', 'MEM', 'MEMORY', '[M]', '(M)', 'M[HL]', 'M(HL)'].includes(clean)) return 'M';
    if (['[B]', '(B)', '[BC]', '(BC)', 'BC', 'B'].includes(clean)) return 'B';
    if (['[D]', '(D)', '[DE]', '(DE)', 'DE', 'D'].includes(clean)) return 'D';
    if (['[H]', '(H)', 'HL', 'H'].includes(clean)) return 'H';
    if (['[SP]', '(SP)', 'SP'].includes(clean)) return 'SP';
    if (['AF', 'PSW'].includes(clean)) return 'PSW';
    return clean;
  }

  // Parse a numeric literal (hex, dec, bin, char, immediate prefixes)
  public parseNumber(val: string): { value: number; valid: boolean; error?: string } {
    val = val.trim();
    if (!val) return { value: 0, valid: false, error: 'Empty literal' };

    // Strip immediate '#' prefix if present (e.g. #20H, #$2050, #255)
    if (val.startsWith('#')) {
      val = val.slice(1).trim();
    }

    // Character literal 'A'
    if (val.startsWith("'") && val.endsWith("'") && val.length === 3) {
      return { value: val.charCodeAt(1), valid: true };
    }

    // Hex with $ prefix (e.g. $2050, $FF)
    if (val.startsWith('$')) {
      const num = parseInt(val.slice(1), 16);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid hex number ${val}` } : { value: num, valid: true };
    }

    // Hex with 0x prefix
    if (val.toLowerCase().startsWith('0x')) {
      const num = parseInt(val.slice(2), 16);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid hex number ${val}` } : { value: num, valid: true };
    }

    // Hex with H or h suffix (e.g. 2000H, 0FFH, A050H, 2050h)
    if (val.toUpperCase().endsWith('H') && val.length > 1) {
      const num = parseInt(val.slice(0, -1), 16);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid hex number ${val}` } : { value: num, valid: true };
    }

    // Binary with B or b suffix (e.g. 10101010B)
    if (val.toUpperCase().endsWith('B') && val.length > 1) {
      const body = val.slice(0, -1);
      if (/^[01]+$/.test(body)) {
        return { value: parseInt(body, 2), valid: true };
      }
    }

    // Octal with O or Q suffix
    if ((val.toUpperCase().endsWith('O') || val.toUpperCase().endsWith('Q')) && val.length > 1) {
      const num = parseInt(val.slice(0, -1), 8);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid octal number ${val}` } : { value: num, valid: true };
    }

    // Strict Decimal (must strictly contain digits, optional D suffix e.g. 25, 255, 100D)
    if (/^-?\d+[dD]?$/.test(val)) {
      const cleaned = val.replace(/[dD]$/, '');
      const dec = parseInt(cleaned, 10);
      if (!isNaN(dec)) return { value: dec, valid: true };
    }

    // Hex without suffix if it contains valid hex chars A-F (e.g. 20A0, F000)
    if (/^[0-9a-fA-F]+$/.test(val)) {
      const hex = parseInt(val, 16);
      if (!isNaN(hex)) return { value: hex, valid: true };
    }

    return { value: 0, valid: false, error: `Unrecognized number format: ${val}` };
  }

  public assemble(source: string): CompileResult {
    this.diagnostics = [];
    this.symbolTable.clear();
    this.origin = 0x2000;

    const lines = source.split(/\r?\n/);
    const parsedLines: ParsedLine[] = [];
    let currentAddress = this.origin;

    // PASS 1: Tokenize lines, calculate addresses, build symbol table
    for (let i = 0; i < lines.length; i++) {
      const rawText = lines[i];
      const lineNum = i + 1;

      // Strip comment
      let code = rawText;
      const commentIdx = code.indexOf(';');
      if (commentIdx !== -1) {
        code = code.slice(0, commentIdx);
      }
      code = code.trim();
      if (!code) continue;

      let label: string | undefined;

      // 1. Check for standard colon label: LABEL:
      const colonIdx = code.indexOf(':');
      if (colonIdx !== -1) {
        const potentialLabel = code.slice(0, colonIdx).trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(potentialLabel)) {
          label = potentialLabel;
          code = code.slice(colonIdx + 1).trim();
        }
      }

      // 2. Check for colon-less label: e.g. "START LXI H, 2050H"
      if (!label && code) {
        const words = code.split(/\s+/);
        if (words.length > 1) {
          const firstWord = words[0].toUpperCase();
          const secondWord = words[1].toUpperCase();
          if (!KNOWN_MNEMONICS.has(firstWord) && KNOWN_MNEMONICS.has(secondWord)) {
            label = words[0];
            code = code.slice(words[0].length).trim();
          }
        }
      }

      let mnemonic = '';
      const operands: string[] = [];

      if (code) {
        // Split mnemonic and operand parts
        const spaceIdx = code.search(/\s/);
        if (spaceIdx === -1) {
          mnemonic = code.toUpperCase();
        } else {
          mnemonic = code.slice(0, spaceIdx).toUpperCase();
          let operandStr = code.slice(spaceIdx).trim();
          if (operandStr) {
            // Normalize bracketed register pairs before splitting by comma (e.g. [H, L] -> [HL])
            operandStr = operandStr
              .replace(/\[\s*H\s*,\s*L\s*\]/gi, '[HL]')
              .replace(/\(\s*H\s*,\s*L\s*\)/gi, '(HL)')
              .replace(/\[\s*B\s*,\s*C\s*\]/gi, '[BC]')
              .replace(/\(\s*B\s*,\s*C\s*\)/gi, '(BC)')
              .replace(/\[\s*D\s*,\s*E\s*\]/gi, '[DE]')
              .replace(/\(\s*D\s*,\s*E\s*\)/gi, '(DE)');

            // Split operands by comma if comma exists, else split by whitespace
            const parts = operandStr.includes(',')
              ? operandStr.split(',')
              : operandStr.split(/\s+/);
            for (const part of parts) {
              const trimmed = part.trim();
              if (trimmed) operands.push(trimmed);
            }
          }
        }
      }

      // Handle EQU
      if (mnemonic === 'EQU') {
        if (!label) {
          this.diagnostics.push({ line: lineNum, column: 1, message: 'EQU directive requires a label', severity: 'error' });
        } else if (operands.length !== 1) {
          this.diagnostics.push({ line: lineNum, column: 1, message: 'EQU requires 1 value operand', severity: 'error' });
        } else {
          const numRes = this.parseNumber(operands[0]);
          if (numRes.valid) {
            this.symbolTable.set(label.toUpperCase(), numRes.value);
          } else {
            this.diagnostics.push({ line: lineNum, column: 1, message: numRes.error || 'Invalid EQU value', severity: 'error' });
          }
        }
        continue;
      }

      // Handle ORG
      if (mnemonic === 'ORG') {
        if (operands.length !== 1) {
          this.diagnostics.push({ line: lineNum, column: 1, message: 'ORG requires 1 address operand', severity: 'error' });
        } else {
          const numRes = this.parseNumber(operands[0]);
          if (numRes.valid) {
            currentAddress = numRes.value & 0xFFFF;
            if (parsedLines.length === 0) {
              this.origin = currentAddress;
            }
          } else {
            this.diagnostics.push({ line: lineNum, column: 1, message: numRes.error || 'Invalid ORG address', severity: 'error' });
          }
        }
        continue;
      }

      if (label) {
        const uLabel = label.toUpperCase();
        if (this.symbolTable.has(uLabel)) {
          this.diagnostics.push({ line: lineNum, column: 1, message: `Duplicate label: ${label}`, severity: 'error' });
        } else {
          this.symbolTable.set(uLabel, currentAddress);
        }
      }

      if (!mnemonic) continue;
      if (mnemonic === 'END') break;

      // Estimate byte count for instruction / directive
      const byteCount = this.estimateByteCount(mnemonic, operands, lineNum);
      parsedLines.push({
        lineNum,
        label,
        mnemonic,
        operands,
        rawText,
        address: currentAddress,
        byteCount,
        bytes: [],
      });
      currentAddress = (currentAddress + byteCount) & 0xFFFF;
    }

    // PASS 2: Encode instructions into machine bytes
    const lineAddressMap = new Map<number, number>();
    const addressLineMap = new Map<number, number>();
    const memoryMap = new Map<number, number>();
    let minAddr = this.origin;
    let maxAddr = this.origin;

    for (const item of parsedLines) {
      lineAddressMap.set(item.lineNum, item.address);
      addressLineMap.set(item.address, item.lineNum);

      const encodedBytes = this.encodeInstruction(item);
      item.bytes = encodedBytes;

      for (let b = 0; b < encodedBytes.length; b++) {
        const addr = (item.address + b) & 0xFFFF;
        memoryMap.set(addr, encodedBytes[b]);
        if (addr < minAddr) minAddr = addr;
        if (addr > maxAddr) maxAddr = addr;
      }
    }

    // Generate contiguous machineCode buffer starting from this.origin
    const size = memoryMap.size > 0 ? (maxAddr - this.origin + 1) : 0;
    const machineCode = new Uint8Array(Math.max(size, 0));
    memoryMap.forEach((byteVal, addr) => {
      if (addr >= this.origin && addr <= maxAddr) {
        machineCode[addr - this.origin] = byteVal;
      }
    });

    // Generate formatted hex dump
    const hexDumpLines: string[] = [];
    for (const item of parsedLines) {
      if (item.bytes.length > 0) {
        const addrHex = item.address.toString(16).padStart(4, '0').toUpperCase();
        const bytesHex = item.bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(9, ' ');
        hexDumpLines.push(`${addrHex}: ${bytesHex} | ${item.rawText.trim()}`);
      }
    }

    const labelsObj: Record<string, number> = {};
    this.symbolTable.forEach((addr, lbl) => {
      labelsObj[lbl] = addr;
    });

    return {
      success: this.diagnostics.filter((d) => d.severity === 'error').length === 0,
      diagnostics: this.diagnostics,
      machineCode,
      startAddress: this.origin,
      labels: labelsObj,
      lineAddressMap,
      addressLineMap,
      hexDump: hexDumpLines.join('\n'),
    };
  }

  private estimateByteCount(mnemonic: string, operands: string[], lineNum: number): number {
    switch (mnemonic) {
      // 1-byte opcodes
      case 'NOP': case 'HLT': case 'EI': case 'DI': case 'RIM': case 'SIM':
      case 'DAA': case 'CMA': case 'CMC': case 'STC':
      case 'RLC': case 'RRC': case 'RAL': case 'RAR':
      case 'XCHG': case 'XTHL': case 'SPHL': case 'PCHL':
      case 'RET': case 'RC': case 'RNC': case 'RZ': case 'RNZ': case 'RP': case 'RM': case 'RPE': case 'RPO':
      case 'LDAX': case 'STAX':
      case 'PUSH': case 'POP':
      case 'INX': case 'DCX': case 'DAD':
      case 'DSUB': case 'ARHL': case 'RDEL': case 'SHLX': case 'LHLX': case 'RSTV':
        return 1;

      case 'ADD': case 'ADC': case 'SUB': case 'SBB':
      case 'ANA': case 'XRA': case 'ORA': case 'CMP': {
        if (operands.length === 1) {
          const r = this.normalizeReg(operands[0]);
          const regNames = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'];
          if (!regNames.includes(r)) return 2; // immediate fallback (ADI, CPI, etc.)
        }
        return 1;
      }
      case 'INR': case 'DCR':
        return 1;
      case 'MOV': {
        if (operands.length === 2) {
          const dstRaw = operands[0].trim().toUpperCase();
          const srcRaw = operands[1].trim().toUpperCase();
          const dstNorm = this.normalizeReg(operands[0]);
          const srcNorm = this.normalizeReg(operands[1]);
          const regNames = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'];

          // 1. Direct address load/store: MOV A, [2050H] or MOV [2050H], A -> 3 bytes (LDA / STA)
          if ((dstNorm === 'A' && !regNames.includes(srcNorm)) ||
              (srcNorm === 'A' && !regNames.includes(dstNorm))) {
            const num = this.parseNumber(dstNorm === 'A' ? operands[1].replace(/[\[\]\(\)]/g, '') : operands[0].replace(/[\[\]\(\)]/g, ''));
            if (num.valid && num.value > 255) return 3;
          }

          // 2. 16-bit register load: MOV HL, 2050H -> 3 bytes (LXI H, 2050H)
          if (['HL', 'BC', 'DE', 'SP'].includes(dstRaw)) {
            return 3;
          }

          // 3. 8-bit immediate move: MOV reg, imm -> 2 bytes (MVI)
          if (!regNames.includes(srcNorm)) return 2;
        }
        return 1;
      }
      case 'RST':
        return 1;

      // 2-byte opcodes
      case 'MVI': {
        if (operands.length === 2) {
          const dstRaw = operands[0].trim().toUpperCase();
          if (['HL', 'BC', 'DE', 'SP'].includes(dstRaw)) {
            return 3; // LXI fallback
          }
        }
        return 2;
      }
      case 'ADI': case 'ACI': case 'SUI': case 'SBI':
      case 'ANI': case 'XRI': case 'ORI': case 'CPI':
      case 'IN': case 'OUT':
      case 'LDHI': case 'LDSI':
        return 2;

      // 3-byte opcodes
      case 'LXI': case 'LDA': case 'STA': case 'LHLD': case 'SHLD':
      case 'JMP': case 'JC': case 'JNC': case 'JZ': case 'JNZ': case 'JP': case 'JM': case 'JPE': case 'JPO':
      case 'CALL': case 'CC': case 'CNC': case 'CZ': case 'CNZ': case 'CP': case 'CM': case 'CPE': case 'CPO':
      case 'JNK': case 'JK':
        return 3;

      // Directives
      case 'DB': case 'DEFB': {
        let count = 0;
        for (const op of operands) {
          if (op.startsWith('"') && op.endsWith('"')) {
            count += op.length - 2;
          } else {
            count += 1;
          }
        }
        return Math.max(1, count);
      }
      case 'DW': case 'DEFW':
        return operands.length * 2;

      case 'DS': case 'DEFS': case 'RESERVE': case 'SPACE': {
        const numRes = this.parseNumber(operands[0] || '1');
        return Math.max(1, numRes.valid ? numRes.value : 1);
      }

      default:
        this.diagnostics.push({ line: lineNum, column: 1, message: `Unknown instruction or directive: ${mnemonic}`, severity: 'error' });
        return 1;
    }
  }

  private resolveValue(valStr: string, lineNum: number): number {
    valStr = valStr.trim();
    if (valStr.startsWith('#')) valStr = valStr.slice(1).trim();
    const uVal = valStr.toUpperCase();
    if (this.symbolTable.has(uVal)) {
      return this.symbolTable.get(uVal)!;
    }
    const num = this.parseNumber(valStr);
    if (num.valid) return num.value;
    this.diagnostics.push({ line: lineNum, column: 1, message: `Unresolved symbol or invalid number: '${valStr}'`, severity: 'error' });
    return 0;
  }

  private encodeInstruction(item: ParsedLine): number[] {
    const m = item.mnemonic?.toUpperCase() || '';
    const ops = item.operands;
    const line = item.lineNum;

    const regIndex: Record<string, number> = {
      'B': 0, 'C': 1, 'D': 2, 'E': 3, 'H': 4, 'L': 5, 'M': 6, 'A': 7,
    };

    const rpIndex: Record<string, number> = {
      'B': 0,
      'D': 1,
      'H': 2,
      'SP': 3,
      'PSW': 3,
    };

    switch (m) {
      // Data Transfer
      case 'MOV': {
        if (ops.length !== 2) {
          this.diagnostics.push({ line, column: 1, message: 'MOV requires 2 operands (e.g. MOV A, B or MOV A, M)', severity: 'error' });
          return [0x00];
        }
        const dstRaw = ops[0].trim().toUpperCase();
        const srcRaw = ops[1].trim().toUpperCase();
        const dst = this.normalizeReg(ops[0]);
        const src = this.normalizeReg(ops[1]);

        // Fallback 1: User wrote MOV HL, 2050H or MOV BC, 2050H (16-bit register load) -> LXI
        if (['HL', 'BC', 'DE', 'SP'].includes(dstRaw)) {
          const rp = dstRaw === 'HL' ? 2 : dstRaw === 'BC' ? 0 : dstRaw === 'DE' ? 1 : 3;
          const val = this.resolveValue(ops[1], line) & 0xFFFF;
          return [0x01 + (rp << 4), val & 0xFF, (val >> 8) & 0xFF];
        }

        // Fallback 2: User wrote MOV A, [2050H] or MOV A, 2050H (16-bit memory load) -> LDA
        if (dst === 'A' && regIndex[src] === undefined) {
          const cleaned = ops[1].replace(/[\[\]\(\)]/g, '').trim();
          const val = this.resolveValue(cleaned, line);
          if (val > 255 || srcRaw.startsWith('[') || srcRaw.startsWith('(')) {
            const addr = val & 0xFFFF;
            return [0x3A, addr & 0xFF, (addr >> 8) & 0xFF];
          }
        }

        // Fallback 3: User wrote MOV [2050H], A or MOV 2050H, A (16-bit memory store) -> STA
        if (src === 'A' && regIndex[dst] === undefined) {
          const cleaned = ops[0].replace(/[\[\]\(\)]/g, '').trim();
          const val = this.resolveValue(cleaned, line);
          if (val > 255 || dstRaw.startsWith('[') || dstRaw.startsWith('(')) {
            const addr = val & 0xFFFF;
            return [0x32, addr & 0xFF, (addr >> 8) & 0xFF];
          }
        }

        // Fallback 4: User wrote MOV reg/M, immediate (e.g. MOV H, 20H or MOV M, 42H) -> MVI
        if (regIndex[src] === undefined && regIndex[dst] !== undefined) {
          const val = this.resolveValue(ops[1], line) & 0xFF;
          return [0x06 + (regIndex[dst] << 3), val];
        }

        if (dst === 'M' && src === 'M') {
          this.diagnostics.push({ line, column: 1, message: 'MOV M, M is invalid in 8085 (encodes HLT)', severity: 'error' });
          return [0x76];
        }
        if (regIndex[dst] === undefined || regIndex[src] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register in MOV: ${ops[0]}, ${ops[1]}`, severity: 'error' });
          return [0x00];
        }
        return [0x40 + (regIndex[dst] << 3) + regIndex[src]];
      }

      case 'MVI': {
        if (ops.length !== 2) {
          this.diagnostics.push({ line, column: 1, message: 'MVI requires register and 8-bit data (e.g. MVI A, 05H or MVI M, 55H)', severity: 'error' });
          return [0x00, 0x00];
        }
        const dstRaw = ops[0].trim().toUpperCase();
        // Fallback: User wrote MVI HL, 2050H or MVI BC, 2050H -> LXI
        if (['HL', 'BC', 'DE', 'SP'].includes(dstRaw)) {
          const rp = dstRaw === 'HL' ? 2 : dstRaw === 'BC' ? 0 : dstRaw === 'DE' ? 1 : 3;
          const val = this.resolveValue(ops[1], line) & 0xFFFF;
          return [0x01 + (rp << 4), val & 0xFF, (val >> 8) & 0xFF];
        }

        const r = this.normalizeReg(ops[0]);
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for MVI: ${ops[0]}`, severity: 'error' });
          return [0x00, 0x00];
        }
        const val = this.resolveValue(ops[1], line) & 0xFF;
        return [0x06 + (regIndex[r] << 3), val];
      }

      case 'LXI': {
        if (ops.length !== 2) {
          this.diagnostics.push({ line, column: 1, message: 'LXI requires register pair and 16-bit data (e.g. LXI H, 2000H)', severity: 'error' });
          return [0x00, 0x00, 0x00];
        }
        const rp = this.normalizeReg(ops[0]);
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for LXI: ${ops[0]} (use B, D, H, or SP)`, severity: 'error' });
          return [0x00, 0x00, 0x00];
        }
        const val = this.resolveValue(ops[1], line) & 0xFFFF;
        const opc = 0x01 + (rpIndex[rp] << 4);
        return [opc, val & 0xFF, (val >> 8) & 0xFF];
      }

      case 'LDA': {
        if (ops.length !== 1) {
          this.diagnostics.push({ line, column: 1, message: 'LDA requires 16-bit address operand', severity: 'error' });
          return [0x3A, 0x00, 0x00];
        }
        const addr = this.resolveValue(ops[0], line) & 0xFFFF;
        return [0x3A, addr & 0xFF, (addr >> 8) & 0xFF];
      }

      case 'STA': {
        if (ops.length !== 1) {
          this.diagnostics.push({ line, column: 1, message: 'STA requires 16-bit address operand', severity: 'error' });
          return [0x32, 0x00, 0x00];
        }
        const addr = this.resolveValue(ops[0], line) & 0xFFFF;
        return [0x32, addr & 0xFF, (addr >> 8) & 0xFF];
      }

      case 'LHLD': {
        const addr = this.resolveValue(ops[0] || '', line) & 0xFFFF;
        return [0x2A, addr & 0xFF, (addr >> 8) & 0xFF];
      }
      case 'SHLD': {
        const addr = this.resolveValue(ops[0] || '', line) & 0xFFFF;
        return [0x22, addr & 0xFF, (addr >> 8) & 0xFF];
      }

      case 'LDAX': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rp === 'B') return [0x0A];
        if (rp === 'D') return [0x1A];
        if (rp === 'H' || rp === 'M') return [0x7E]; // Fallback to MOV A, M
        this.diagnostics.push({ line, column: 1, message: 'LDAX only supports B or D register pairs (for HL, use MOV A, M)', severity: 'error' });
        return [0x0A];
      }

      case 'STAX': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rp === 'B') return [0x02];
        if (rp === 'D') return [0x12];
        if (rp === 'H' || rp === 'M') return [0x77]; // Fallback to MOV M, A
        this.diagnostics.push({ line, column: 1, message: 'STAX only supports B or D register pairs (for HL, use MOV M, A)', severity: 'error' });
        return [0x02];
      }

      case 'XCHG': return [0xEB];
      case 'XTHL': return [0xE3];
      case 'SPHL': return [0xF9];
      case 'PCHL': return [0xE9];

      // Arithmetic & Logic (ADD, ADC, SUB, SBB, ANA, XRA, ORA, CMP)
      case 'ADD': case 'ADC': case 'SUB': case 'SBB':
      case 'ANA': case 'XRA': case 'ORA': case 'CMP': {
        const bases: Record<string, number> = {
          'ADD': 0x80, 'ADC': 0x88, 'SUB': 0x90, 'SBB': 0x98,
          'ANA': 0xA0, 'XRA': 0xA8, 'ORA': 0xB0, 'CMP': 0xB8,
        };
        const r = this.normalizeReg(ops[0] || 'B');
        if (regIndex[r] === undefined) {
          // If operand is not a register, user may have written CMP 05H (immediate) instead of CPI 05H!
          const immBases: Record<string, number> = {
            'ADD': 0xC6, 'ADC': 0xCE, 'SUB': 0xD6, 'SBB': 0xDE,
            'ANA': 0xE6, 'XRA': 0xEE, 'ORA': 0xF6, 'CMP': 0xFE,
          };
          const val = this.resolveValue(ops[0] || '', line) & 0xFF;
          return [immBases[m], val];
        }
        return [bases[m] + regIndex[r]];
      }

      case 'ADI': return [0xC6, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'ACI': return [0xCE, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'SUI': return [0xD6, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'SBI': return [0xDE, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'ANI': return [0xE6, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'XRI': return [0xEE, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'ORI': return [0xF6, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'CPI': return [0xFE, this.resolveValue(ops[0] || '', line) & 0xFF];

      case 'INR': {
        const r = this.normalizeReg(ops[0] || '');
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for INR: ${ops[0]}`, severity: 'error' });
          return [0x00];
        }
        return [0x04 + (regIndex[r] << 3)];
      }

      case 'DCR': {
        const r = this.normalizeReg(ops[0] || '');
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for DCR: ${ops[0]}`, severity: 'error' });
          return [0x00];
        }
        return [0x05 + (regIndex[r] << 3)];
      }

      case 'INX': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for INX: ${ops[0]}`, severity: 'error' });
          return [0x03];
        }
        return [0x03 + (rpIndex[rp] << 4)];
      }

      case 'DCX': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for DCX: ${ops[0]}`, severity: 'error' });
          return [0x0B];
        }
        return [0x0B + (rpIndex[rp] << 4)];
      }

      case 'DAD': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for DAD: ${ops[0]}`, severity: 'error' });
          return [0x09];
        }
        return [0x09 + (rpIndex[rp] << 4)];
      }

      case 'DAA': return [0x27];
      case 'RLC': return [0x07];
      case 'RRC': return [0x0F];
      case 'RAL': return [0x17];
      case 'RAR': return [0x1F];
      case 'CMA': return [0x2F];
      case 'CMC': return [0x3F];
      case 'STC': return [0x37];

      // Branching
      case 'JMP': return this.encodeBranch(0xC3, ops[0], line);
      case 'JNZ': return this.encodeBranch(0xC2, ops[0], line);
      case 'JZ':  return this.encodeBranch(0xCA, ops[0], line);
      case 'JNC': return this.encodeBranch(0xD2, ops[0], line);
      case 'JC':  return this.encodeBranch(0xDA, ops[0], line);
      case 'JPO': return this.encodeBranch(0xE2, ops[0], line);
      case 'JPE': return this.encodeBranch(0xEA, ops[0], line);
      case 'JP':  return this.encodeBranch(0xF2, ops[0], line);
      case 'JM':  return this.encodeBranch(0xFA, ops[0], line);

      case 'CALL': return this.encodeBranch(0xCD, ops[0], line);
      case 'CNZ':  return this.encodeBranch(0xC4, ops[0], line);
      case 'CZ':   return this.encodeBranch(0xCC, ops[0], line);
      case 'CNC':  return this.encodeBranch(0xD4, ops[0], line);
      case 'CC':   return this.encodeBranch(0xDC, ops[0], line);
      case 'CPO':  return this.encodeBranch(0xE4, ops[0], line);
      case 'CPE':  return this.encodeBranch(0xEC, ops[0], line);
      case 'CP':   return this.encodeBranch(0xF4, ops[0], line);
      case 'CM':   return this.encodeBranch(0xFC, ops[0], line);

      case 'RET': return [0xC9];
      case 'RNZ': return [0xC0];
      case 'RZ':  return [0xC8];
      case 'RNC': return [0xD0];
      case 'RC':  return [0xD8];
      case 'RPO': return [0xE0];
      case 'RPE': return [0xE8];
      case 'RP':  return [0xF0];
      case 'RM':  return [0xF8];

      case 'RST': {
        const n = this.resolveValue(ops[0] || '0', line);
        if (n < 0 || n > 7) {
          this.diagnostics.push({ line, column: 1, message: 'RST vector must be between 0 and 7', severity: 'error' });
          return [0xC7];
        }
        return [0xC7 + (n << 3)];
      }

      // Stack
      case 'PUSH': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rp === 'B') return [0xC5];
        if (rp === 'D') return [0xD5];
        if (rp === 'H') return [0xE5];
        if (rp === 'PSW') return [0xF5];
        this.diagnostics.push({ line, column: 1, message: `Invalid operand for PUSH: ${ops[0]} (use B, D, H, or PSW)`, severity: 'error' });
        return [0xC5];
      }

      case 'POP': {
        const rp = this.normalizeReg(ops[0] || '');
        if (rp === 'B') return [0xC1];
        if (rp === 'D') return [0xD1];
        if (rp === 'H') return [0xE1];
        if (rp === 'PSW') return [0xF1];
        this.diagnostics.push({ line, column: 1, message: `Invalid operand for POP: ${ops[0]} (use B, D, H, or PSW)`, severity: 'error' });
        return [0xC1];
      }

      case 'IN': return [0xDB, this.resolveValue(ops[0] || '0', line) & 0xFF];
      case 'OUT': return [0xD3, this.resolveValue(ops[0] || '0', line) & 0xFF];

      case 'HLT': return [0x76];
      case 'NOP': return [0x00];
      case 'EI': return [0xFB];
      case 'DI': return [0xF3];
      case 'RIM': return [0x20];
      case 'SIM': return [0x30];

      // Undocumented instructions
      case 'DSUB': return [0x08];
      case 'ARHL': return [0x10];
      case 'RDEL': return [0x18];
      case 'LDHI': return [0x28, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'LDSI': return [0x38, this.resolveValue(ops[0] || '', line) & 0xFF];
      case 'SHLX': return [0xD9];
      case 'LHLX': return [0xED];
      case 'RSTV': return [0xCB];
      case 'JNK': return this.encodeBranch(0xDD, ops[0], line);
      case 'JK': return this.encodeBranch(0xFD, ops[0], line);

      // Directives
      case 'DB': case 'DEFB': {
        const bytes: number[] = [];
        for (const op of ops) {
          if (op.startsWith('"') && op.endsWith('"')) {
            const str = op.slice(1, -1);
            for (let c = 0; c < str.length; c++) {
              bytes.push(str.charCodeAt(c) & 0xFF);
            }
          } else {
            bytes.push(this.resolveValue(op, line) & 0xFF);
          }
        }
        return bytes;
      }

      case 'DW': case 'DEFW': {
        const bytes: number[] = [];
        for (const op of ops) {
          const w = this.resolveValue(op, line) & 0xFFFF;
          bytes.push(w & 0xFF, (w >> 8) & 0xFF);
        }
        return bytes;
      }

      case 'DS': case 'DEFS': case 'RESERVE': case 'SPACE': {
        const count = this.resolveValue(ops[0] || '1', line);
        return new Array(Math.max(1, count)).fill(0);
      }

      default:
        return [0x00];
    }
  }

  private encodeBranch(opcode: number, target: string | undefined, line: number): number[] {
    if (!target) {
      this.diagnostics.push({ line, column: 1, message: 'Branch instruction requires target address or label', severity: 'error' });
      return [opcode, 0x00, 0x00];
    }
    const addr = this.resolveValue(target, line) & 0xFFFF;
    return [opcode, addr & 0xFF, (addr >> 8) & 0xFF];
  }
}
