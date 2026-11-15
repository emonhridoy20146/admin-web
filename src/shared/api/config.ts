export function apiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_MOCK === '1') return '/api/v1';
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';
}
export const isMockApi = () => process.env.NEXT_PUBLIC_API_MOCK === '1';
