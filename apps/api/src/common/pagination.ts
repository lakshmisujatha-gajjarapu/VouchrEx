export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationArgs {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function parsePagination(rawPage?: string, rawPageSize?: string): PaginationArgs {
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const parsedSize = Number.parseInt(rawPageSize ?? '', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const sizeCandidate =
    Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(sizeCandidate, MAX_PAGE_SIZE);
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function normalizeSearch(q?: string): string | undefined {
  const trimmed = q?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeQBy(qBy?: string): string | undefined {
  const trimmed = qBy?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Build a Prisma `contains` filter (case-insensitive). */
export function containsCi(value: string): { contains: string; mode: 'insensitive' } {
  return { contains: value, mode: 'insensitive' };
}

/** Build a Prisma `startsWith` filter (case-insensitive). */
export function startsWithCi(value: string): { startsWith: string; mode: 'insensitive' } {
  return { startsWith: value, mode: 'insensitive' };
}
