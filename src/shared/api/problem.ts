import type { components } from './schema';

export type Problem = components['schemas']['Problem'];

/** RFC 9457 problem mapped to an Error so TanStack Query can carry it (FR-W-011). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly detail?: string;
  readonly details?: Record<string, unknown>;

  constructor(p: Partial<Problem> & { status: number }) {
    super(p.title || p.code || `HTTP ${p.status}`);
    this.name = 'ApiError';
    this.status = p.status;
    this.code = p.code || (p.status === 0 ? 'NETWORK' : `HTTP_${p.status}`);
    this.requestId = p.requestId;
    this.detail = p.detail;
    this.details = p.details;
  }

  /** i18n key in the `common` namespace: errors.<CODE> with a status-family fallback. */
  get messageKey(): string[] {
    const family = this.status === 0 ? 'NETWORK' : this.status >= 500 ? 'SERVER' : this.status === 403 ? 'FORBIDDEN' : this.status === 404 ? 'NOT_FOUND' : this.status === 409 || this.status === 412 ? 'CONFLICT' : 'GENERIC';
    return [`errors.${this.code}`, `errors.${family}`];
  }

  toClipboard(): string {
    return JSON.stringify({ code: this.code, status: this.status, requestId: this.requestId, detail: this.detail }, null, 2);
  }
}

export async function toApiError(res: Response | undefined, body?: unknown): Promise<ApiError> {
  if (!res) return new ApiError({ status: 0, code: 'NETWORK' });
  const p = (body && typeof body === 'object' ? body : {}) as Partial<Problem>;
  return new ApiError({ ...p, status: res.status, requestId: p.requestId ?? res.headers.get('x-request-id') ?? undefined });
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
