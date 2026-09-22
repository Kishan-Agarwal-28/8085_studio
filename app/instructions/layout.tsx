import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instruction Set Architecture (ISA) & User Manual — 8085 Studio',
  description:
    'Comprehensive reference manual for the Intel 8085 microprocessor. Searchable opcode directory for all 246 standard instructions and 10 undocumented ghost opcodes with addressing modes, cycles, and flag effects.',
  alternates: {
    canonical: '/instructions',
  },
  openGraph: {
    title: '8085 Instruction Set (ISA) & User Manual | 8085 Studio',
    description:
      'Searchable opcode table for all 246 standard 8085 instructions and 10 secret ghost opcodes with clock cycles, bytes, and flag effects.',
    url: 'https://8085-studio.netlify.app/instructions',
  },
};

export default function InstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
