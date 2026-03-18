function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
}

export const API_CONFIG = {
  BASE_URL: resolveApiBaseUrl(),
  TIMEOUT: 30000,
};

export const AUTH_CONFIG = {
  COOKIE_NAME: 'cb_admin_token',
  COOKIE_MAX_AGE: 60 * 60 * 24 * 7, // 7 days
};

export const ADMIN_HEADER = 'x-admin-token';
