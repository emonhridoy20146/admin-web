'use client';
import { useCan } from '../auth/session';

/** Hides children without the permission. The server stays the authority — always handle 403. */
export function Can({ permission, children, fallback = null }: { permission: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
