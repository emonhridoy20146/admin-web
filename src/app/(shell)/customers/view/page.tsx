'use client';
import { CustomerDetailPage } from '@/features/customers';

/**
 * Customer detail shell (ADR-W02). Static export emits /customers/_/index.html once; the host rewrites
 * /customers/<id>/ → /customers/view/ and the page reads <id> from the URL client-side.
 */
export default CustomerDetailPage;
