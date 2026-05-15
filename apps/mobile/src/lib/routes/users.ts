export const USERS = {
  ME: '/users/me',
  ME_STATS: '/users/me/stats',
  SELLER_PUBLIC_STATS: (id: string) => `/users/${encodeURIComponent(id)}/public-stats`,
  PUSH_TOKENS: '/me/push-tokens',
  PUSH_TOKEN_BY_DEVICE: (deviceId: string) => `/me/push-tokens/${encodeURIComponent(deviceId)}`,
} as const;
