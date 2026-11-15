'use client';
import { AppShell } from '@/features/shell';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
