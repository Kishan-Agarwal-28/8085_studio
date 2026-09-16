'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { CompileDiagnostic } from '@/lib/8085/types';

interface Monaco8085EditorProps {
  value: string;
  onChange: (val: string) => void;
  diagnostics: CompileDiagnostic[];
  activeLine?: number;
}

export const Monaco8085Editor: React.FC<Monaco8085EditorProps> = ({
  value,
  onChange,
  diagnostics,
  activeLine,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decorationsRef = useRef<any>([]);

  // Setup Monaco syntax highlighting for 8085 assembly
  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.languages.register({ id: '8085-asm' });

    monaco.languages.setMonarchTokensProvider('8085-asm', {
      ignoreCase: true,
      keywords: [
        'MOV', 'MVI', 'LXI', 'LDA', 'STA', 'LHLD', 'SHLD', 'LDAX', 'STAX', 'XCHG',
        'ADD', 'ADC', 'SUB', 'SBB', 'INR', 'DCR', 'INX', 'DCX', 'DAD', 'DAA',
        'ANA', 'XRA', 'ORA', 'CMP', 'CPI', 'ANI', 'XRI', 'ORI', 'ADI', 'ACI', 'SUI', 'SBI',
        'RLC', 'RRC', 'RAL', 'RAR', 'CMA', 'CMC', 'STC',
        'JMP', 'JC', 'JNC', 'JZ', 'JNZ', 'JP', 'JM', 'JPE', 'JPO',
        'CALL', 'CC', 'CNC', 'CZ', 'CNZ', 'CP', 'CM', 'CPE', 'CPO',
        'RET', 'RC', 'RNC', 'RZ', 'RNZ', 'RP', 'RM', 'RPE', 'RPO',
        'PUSH', 'POP', 'XTHL', 'SPHL', 'PCHL', 'RST', 'IN', 'OUT',
        'HLT', 'NOP', 'EI', 'DI', 'RIM', 'SIM',
      ],
      directives: ['ORG', 'DB', 'DW', 'EQU', 'END'],
      registers: ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'SP', 'PSW', 'BC', 'DE', 'HL'],
      tokenizer: {
        root: [
          // Labels (e.g. LOOP:, START:)
          [/^[a-zA-Z_]\w*:/, 'type.identifier'],
          // Comments
          [/;.*$/, 'comment'],
          // Strings
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          // Hex numbers like 2000H, 0FFH
          [/\b[0-9][0-9a-fA-F]*[hH]\b/, 'number.hex'],
          // Hex with 0x prefix
          [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],
          // Binary numbers like 10101010B
          [/\b[01]+[bB]\b/, 'number.binary'],
          // Decimal numbers
          [/\b\d+\b/, 'number'],
          // Identifiers/keywords
          [
            /[a-zA-Z_]\w*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@directives': 'keyword.control',
                '@registers': 'variable.predefined',
                '@default': 'identifier',
              },
            },
          ],
          // Delimiters
          [/[,:]/, 'delimiter'],
        ],
      },
    });

    // Custom 8085 dark theme
    monaco.editor.defineTheme('8085-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'F59E0B', fontStyle: 'bold' }, // Amber for mnemonics
        { token: 'keyword.control', foreground: 'EC4899', fontStyle: 'bold' }, // Pink for directives
        { token: 'variable.predefined', foreground: '38BDF8', fontStyle: 'bold' }, // Sky blue for registers
        { token: 'type.identifier', foreground: 'A855F7', fontStyle: 'bold' }, // Purple for labels
        { token: 'number.hex', foreground: '34D399' }, // Emerald for hex
        { token: 'number', foreground: '34D399' },
        { token: 'comment', foreground: '71717A', fontStyle: 'italic' },
        { token: 'string', foreground: 'F472B6' },
      ],
      colors: {
        'editor.background': '#09090b',
        'editor.foreground': '#f4f4f5',
        'editor.lineHighlightBackground': '#18181b',
        'editorCursor.foreground': '#06b6d4',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#06b6d4',
      },
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Update diagnostic markers on Monaco model
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers = diagnostics.map((d) => ({
      startLineNumber: d.line,
      startColumn: d.column || 1,
      endLineNumber: d.line,
      endColumn: model.getLineMaxColumn(d.line),
      message: d.message,
      severity:
        d.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : d.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
    }));

    monaco.editor.setModelMarkers(model, '8085-compiler', markers);
  }, [diagnostics]);

  // Update active line execution highlight
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!activeLine || activeLine < 1) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

    const newDecorations = [
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: 'active-exec-line bg-green-500/80 border-l-4 border-green-500',
          glyphMarginClassName: 'text-green-500 font-bold',
        },
      },
    ];

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    editor.revealLineInCenterIfOutsideViewport(activeLine);
  }, [activeLine]);

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]">
      <Editor
        height="100%"
        defaultLanguage="8085-asm"
        theme="8085-dark"
        value={value}
        onChange={(v) => onChange(v || '')}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontLigatures: true,
          renderLineHighlight: 'all',
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
};
