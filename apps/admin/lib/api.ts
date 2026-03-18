import { cookies } from 'next/headers';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from './constants';
import type {
  AdminMetrics,
  AdminUser,
  Dispute,
  Order,
  PendingPayout,
} from './types';

async function getAdminToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;
  if (!token) throw new Error('No admin token');
  return token;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      [ADMIN_HEADER]: token,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getMetrics(): Promise<AdminMetrics> {
  return apiFetch<AdminMetrics>('/admin/metrics');
}

export async function getDisputes(status?: string): Promise<Dispute[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<Dispute[]>(`/admin/disputes${qs}`);
}

export async function getOrders(status?: string): Promise<Order[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<Order[]>(`/admin/orders${qs}`);
}

export async function getUsers(status?: string): Promise<AdminUser[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<AdminUser[]>(`/admin/users${qs}`);
}

export async function getPendingPayouts(): Promise<PendingPayout[]> {
  return apiFetch<PendingPayout[]>('/admin/payouts/pending');
}

export async function suspendUser(id: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/suspend`, { method: 'POST' });
}

export async function reactivateUser(id: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/reactivate`, { method: 'POST' });
}

export async function completePayout(orderId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/admin/orders/${orderId}/complete-payout`, {
    method: 'POST',
  });
}

