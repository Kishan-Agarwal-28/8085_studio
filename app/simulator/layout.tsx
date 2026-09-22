import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Simulator & IDE — Real-Time 8085 Microprocessor Studio',
  description:
    'Live Intel 8085 assembly compiler, cycle-accurate virtual machine, and real-time CPU data bus visualizer. Step through micro-cycles, inspect registers, edit 64KB memory live, trigger hardware interrupts, and present with tldraw overlay whiteboard.',
  alternates: {
    canonical: '/simulator',
  },
  openGraph: {
    title: '8085 Simulator & Assembler IDE | 8085 Studio',
    description:
      'Live Intel 8085 assembly compiler and cycle-accurate CPU data bus visualizer with 64KB memory inspector and presenter mode.',
    url: 'https://8085-studio.netlify.app/simulator',
  },
};

export default function SimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
