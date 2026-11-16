/** Reads a list answer that is either a plain array or an `{ items: [...] }` envelope. Anything else is an empty list. */
export function listOrItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown } | null | undefined)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}
