export const USERS = {
  ME: '/users/me',
  PUSH_TOKENS: '/me/push-tokens',
  PUSH_TOKEN_BY_DEVICE: (deviceId: string) => `/me/push-tokens/${encodeURIComponent(deviceId)}`,
} as const;
