import { BRANDFETCH_MIN_QUERY_LENGTH, BRANDFETCH_SEARCH_URL } from '@/constants';

export type BrandfetchSuggestion = {
  readonly name: string;
  readonly domain?: string;
  readonly icon?: string;
};

type BrandfetchResult = {
  readonly name?: string | null;
  readonly domain?: string;
  readonly icon?: string | null;
};

const rawClientId: unknown = process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID;
const brandfetchClientId = typeof rawClientId === 'string' ? rawClientId.trim() : '';

function normalizeBrandName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function searchBrandfetchBrands(query: string) {
  const normalizedQuery = query.trim();
  if (!brandfetchClientId || normalizedQuery.length < BRANDFETCH_MIN_QUERY_LENGTH) {
    return [] as readonly BrandfetchSuggestion[];
  }

  const response = await fetch(
    `${BRANDFETCH_SEARCH_URL}/${encodeURIComponent(normalizedQuery)}?c=${encodeURIComponent(brandfetchClientId)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Brand suggestions are temporarily unavailable.');
  }

  const payload = (await response.json()) as readonly BrandfetchResult[];
  const seen = new Set<string>();

  return payload
    .flatMap((item) => {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) {
        return [];
      }

      return [{
        name,
        ...(item.domain ? { domain: item.domain } : {}),
        ...(item.icon ? { icon: item.icon } : {}),
      }];
    })
    .filter((item) => {
      const key = normalizeBrandName(item.name);
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}
