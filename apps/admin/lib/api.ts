import { cookies } from 'next/headers';
import { API_CONFIG, ADMIN_HEADER, AUTH_CONFIG } from './constants';
import type {
  AdminListing,
  AdminListingDetail,
  AdminMe,
  AdminMetrics,
  AdminTeamMember,
  AdminUser,
  AppConfigRow,
  Dispute,
  ListQuery,
  Order,
  OrderDetail,
  PaginatedResult,
  PendingPayout,
  PendingRefund,
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
      ...(options?.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : (options?.headers as Record<string, string> | undefined)),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${String(res.status)}: ${text}`);
  }

  return res.json() as Promise<T>;
}

function buildListQuery(q: ListQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.q && q.q.trim() && q.qBy) {
    params.set('q', q.q.trim());
    params.set('qBy', q.qBy);
  }
  if (q.page && q.page > 1) params.set('page', String(q.page));
  if (q.pageSize) params.set('pageSize', String(q.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getMetrics(): Promise<AdminMetrics> {
  return apiFetch<AdminMetrics>('/admin/metrics');
}

export async function getDispute(id: string): Promise<Dispute> {
  return apiFetch<Dispute>(`/admin/disputes/${id}`);
}

export async function getDisputes(query: ListQuery = {}): Promise<PaginatedResult<Dispute>> {
  return apiFetch<PaginatedResult<Dispute>>(`/admin/disputes${buildListQuery(query)}`);
}

export async function getOrders(query: ListQuery = {}): Promise<PaginatedResult<Order>> {
  return apiFetch<PaginatedResult<Order>>(`/admin/orders${buildListQuery(query)}`);
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/admin/orders/${id}`);
}

export async function getUsers(query: ListQuery = {}): Promise<PaginatedResult<AdminUser>> {
  return apiFetch<PaginatedResult<AdminUser>>(`/admin/users${buildListQuery(query)}`);
}

export async function getPendingPayouts(query: ListQuery = {}): Promise<PaginatedResult<PendingPayout>> {
  return apiFetch<PaginatedResult<PendingPayout>>(`/admin/payouts/pending${buildListQuery(query)}`);
}

export async function getPendingRefunds(query: ListQuery = {}): Promise<PaginatedResult<PendingRefund>> {
  return apiFetch<PaginatedResult<PendingRefund>>(`/admin/refunds/pending${buildListQuery(query)}`);
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

export async function getMe(): Promise<AdminMe> {
  return apiFetch<AdminMe>('/admin/me');
}

export async function getTeam(query: ListQuery = {}): Promise<PaginatedResult<AdminTeamMember>> {
  return apiFetch<PaginatedResult<AdminTeamMember>>(`/admin/team${buildListQuery(query)}`);
}

export async function getListing(id: string): Promise<AdminListingDetail> {
  return apiFetch<AdminListingDetail>(`/admin/listings/${id}`);
}

export async function getListings(query: ListQuery & { verificationStatus?: string } = {}): Promise<PaginatedResult<AdminListing>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.verificationStatus) params.set('verificationStatus', query.verificationStatus);
  if (query.q && query.q.trim() && query.qBy) {
    params.set('q', query.q.trim());
    params.set('qBy', query.qBy);
  }
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<PaginatedResult<AdminListing>>(`/admin/listings${qs ? `?${qs}` : ''}`);
}

export async function getAppConfig(): Promise<AppConfigRow[]> {
  return apiFetch<AppConfigRow[]>('/admin/config');
}
