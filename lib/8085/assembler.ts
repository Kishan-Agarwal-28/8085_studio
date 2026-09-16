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

export class Assembler8085 {
  private diagnostics: CompileDiagnostic[] = [];
  private symbolTable: Map<string, number> = new Map();
  private origin = 0x2000; // Standard 8085 starting RAM address

  // Parse a numeric literal (hex, dec, bin, char)
  public parseNumber(val: string): { value: number; valid: boolean; error?: string } {
    val = val.trim();
    if (!val) return { value: 0, valid: false, error: 'Empty literal' };

    // Character literal 'A'
    if (val.startsWith("'") && val.endsWith("'") && val.length === 3) {
      return { value: val.charCodeAt(1), valid: true };
    }

    // Hex with 0x prefix
    if (val.toLowerCase().startsWith('0x')) {
      const num = parseInt(val.slice(2), 16);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid hex number ${val}` } : { value: num, valid: true };
    }

    // Hex with H suffix (e.g. 2000H, 0FFH)
    if (val.toUpperCase().endsWith('H')) {
      const num = parseInt(val.slice(0, -1), 16);
      return isNaN(num) ? { value: 0, valid: false, error: `Invalid hex number ${val}` } : { value: num, valid: true };
    }

    // Binary with B suffix (e.g. 10101010B)
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

    // Decimal
    const dec = parseInt(val, 10);
    if (!isNaN(dec)) {
      return { value: dec, valid: true };
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
      const colonIdx = code.indexOf(':');
      if (colonIdx !== -1) {
        const potentialLabel = code.slice(0, colonIdx).trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(potentialLabel)) {
          label = potentialLabel;
          code = code.slice(colonIdx + 1).trim();
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
          const operandStr = code.slice(spaceIdx).trim();
          if (operandStr) {
            // Split operands by comma
            const parts = operandStr.split(',');
            for (const part of parts) {
              operands.push(part.trim());
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

    // Generate contiguous machineCode buffer
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
        const bytesHex = item.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(9, ' ');
        hexDumpLines.push(`${addrHex}: ${bytesHex} | ${item.rawText.trim()}`);
      }
    }

    const labelsObj: Record<string, number> = {};
    this.symbolTable.forEach((addr, lbl) => {
      labelsObj[lbl] = addr;
    });

    return {
      success: this.diagnostics.filter(d => d.severity === 'error').length === 0,
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
      case 'ADD': case 'ADC': case 'SUB': case 'SBB':
      case 'ANA': case 'XRA': case 'ORA': case 'CMP':
      case 'INR': case 'DCR':
      case 'MOV':
      case 'RST':
        return 1;

      // 2-byte opcodes
      case 'MVI': case 'ADI': case 'ACI': case 'SUI': case 'SBI':
      case 'ANI': case 'XRI': case 'ORI': case 'CPI':
      case 'IN': case 'OUT':
        return 2;

      // 3-byte opcodes
      case 'LXI': case 'LDA': case 'STA': case 'LHLD': case 'SHLD':
      case 'JMP': case 'JC': case 'JNC': case 'JZ': case 'JNZ': case 'JP': case 'JM': case 'JPE': case 'JPO':
      case 'CALL': case 'CC': case 'CNC': case 'CZ': case 'CNZ': case 'CP': case 'CM': case 'CPE': case 'CPO':
        return 3;

      // Directives
      case 'DB': {
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
      case 'DW':
        return operands.length * 2;

      default:
        this.diagnostics.push({ line: lineNum, column: 1, message: `Unknown instruction or directive: ${mnemonic}`, severity: 'error' });
        return 1;
    }
  }

  private resolveValue(valStr: string, lineNum: number): number {
    valStr = valStr.trim();
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
      'B': 0, 'BC': 0,
      'D': 1, 'DE': 1,
      'H': 2, 'HL': 2,
      'SP': 3,
      'PSW': 3,
    };

    switch (m) {
      // Data Transfer
      case 'MOV': {
        if (ops.length !== 2) {
          this.diagnostics.push({ line, column: 1, message: 'MOV requires 2 operands (e.g. MOV A, B)', severity: 'error' });
          return [0x00];
        }
        const dst = ops[0].toUpperCase();
        const src = ops[1].toUpperCase();
        if (dst === 'M' && src === 'M') {
          this.diagnostics.push({ line, column: 1, message: 'MOV M, M is invalid (encodes HLT)', severity: 'error' });
          return [0x76];
        }
        if (regIndex[dst] === undefined || regIndex[src] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register in MOV: ${dst}, ${src}`, severity: 'error' });
          return [0x00];
        }
        return [0x40 + (regIndex[dst] << 3) + regIndex[src]];
      }

      case 'MVI': {
        if (ops.length !== 2) {
          this.diagnostics.push({ line, column: 1, message: 'MVI requires register and 8-bit data (e.g. MVI A, 05H)', severity: 'error' });
          return [0x00, 0x00];
        }
        const r = ops[0].toUpperCase();
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register: ${r}`, severity: 'error' });
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
        const rp = ops[0].toUpperCase();
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for LXI: ${rp} (use B, D, H, or SP)`, severity: 'error' });
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
        const rp = (ops[0] || '').toUpperCase();
        if (rp === 'B' || rp === 'BC') return [0x0A];
        if (rp === 'D' || rp === 'DE') return [0x1A];
        this.diagnostics.push({ line, column: 1, message: 'LDAX only supports B or D register pairs', severity: 'error' });
        return [0x0A];
      }

      case 'STAX': {
        const rp = (ops[0] || '').toUpperCase();
        if (rp === 'B' || rp === 'BC') return [0x02];
        if (rp === 'D' || rp === 'DE') return [0x12];
        this.diagnostics.push({ line, column: 1, message: 'STAX only supports B or D register pairs', severity: 'error' });
        return [0x02];
      }

      case 'XCHG': return [0xEB];
      case 'XTHL': return [0xE3];
      case 'SPHL': return [0xF9];
      case 'PCHL': return [0xE9];

      // Arithmetic
      case 'ADD': case 'ADC': case 'SUB': case 'SBB':
      case 'ANA': case 'XRA': case 'ORA': case 'CMP': {
        const bases: Record<string, number> = {
          'ADD': 0x80, 'ADC': 0x88, 'SUB': 0x90, 'SBB': 0x98,
          'ANA': 0xA0, 'XRA': 0xA8, 'ORA': 0xB0, 'CMP': 0xB8,
        };
        const r = (ops[0] || '').toUpperCase();
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for ${m}: ${r}`, severity: 'error' });
          return [0x00];
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
        const r = (ops[0] || '').toUpperCase();
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for INR: ${r}`, severity: 'error' });
          return [0x00];
        }
        return [0x04 + (regIndex[r] << 3)];
      }

      case 'DCR': {
        const r = (ops[0] || '').toUpperCase();
        if (regIndex[r] === undefined) {
          this.diagnostics.push({ line, column: 1, message: `Invalid register for DCR: ${r}`, severity: 'error' });
          return [0x00];
        }
        return [0x05 + (regIndex[r] << 3)];
      }

      case 'INX': {
        const rp = (ops[0] || '').toUpperCase();
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for INX: ${rp}`, severity: 'error' });
          return [0x03];
        }
        return [0x03 + (rpIndex[rp] << 4)];
      }

      case 'DCX': {
        const rp = (ops[0] || '').toUpperCase();
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for DCX: ${rp}`, severity: 'error' });
          return [0x0B];
        }
        return [0x0B + (rpIndex[rp] << 4)];
      }

      case 'DAD': {
        const rp = (ops[0] || '').toUpperCase();
        if (rpIndex[rp] === undefined || rp === 'PSW') {
          this.diagnostics.push({ line, column: 1, message: `Invalid register pair for DAD: ${rp}`, severity: 'error' });
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
        const rp = (ops[0] || '').toUpperCase();
        if (rp === 'B' || rp === 'BC') return [0xC5];
        if (rp === 'D' || rp === 'DE') return [0xD5];
        if (rp === 'H' || rp === 'HL') return [0xE5];
        if (rp === 'PSW') return [0xF5];
        this.diagnostics.push({ line, column: 1, message: `Invalid operand for PUSH: ${rp} (use B, D, H, or PSW)`, severity: 'error' });
        return [0xC5];
      }

      case 'POP': {
        const rp = (ops[0] || '').toUpperCase();
        if (rp === 'B' || rp === 'BC') return [0xC1];
        if (rp === 'D' || rp === 'DE') return [0xD1];
        if (rp === 'H' || rp === 'HL') return [0xE1];
        if (rp === 'PSW') return [0xF1];
        this.diagnostics.push({ line, column: 1, message: `Invalid operand for POP: ${rp} (use B, D, H, or PSW)`, severity: 'error' });
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

      // Directives
      case 'DB': {
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

      case 'DW': {
        const bytes: number[] = [];
        for (const op of ops) {
          const w = this.resolveValue(op, line) & 0xFFFF;
          bytes.push(w & 0xFF, (w >> 8) & 0xFF);
        }
        return bytes;
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
