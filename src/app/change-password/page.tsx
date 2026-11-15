'use client';
import { Suspense } from 'react';
import { ChangePasswordPage } from '@/features/auth';

export default function Page() {
  return (
    <Suspense>
      <ChangePasswordPage />
    </Suspense>
  );
}
