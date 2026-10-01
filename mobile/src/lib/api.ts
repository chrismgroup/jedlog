import { API_URL } from './config';
import { secureStorage } from './storage';
import type { AppNotification, Offer, Order, OrderEvent, OrderStatus, Role, User, Warehouse } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Access token lives only in memory; the refresh token is in the device keychain.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: () => void = () => {};

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function rawRequest(path: string, init: RequestInit = {}, withAuth = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(API_URL + path, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(withAuth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) return false;
      const res = await rawRequest('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
      if (!res.ok) {
        if (res.status === 401) await secureStorage.clearRefreshToken();
        return false;
      }
      const data = await res.json();
      accessToken = data.accessToken;
      await secureStorage.setRefreshToken(data.refreshToken);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let res = await rawRequest(path, init);
  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    if (await refreshSession()) {
      res = await rawRequest(path, init);
    } else {
      onSessionExpired();
    }
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || 'Something went wrong. Please try again.');
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface OrderDetail {
  order: Order;
  offers: Offer[];
  events: OrderEvent[];
}

export const api = {
  login: (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password }),
  register: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    state: string;
    preferredWarehouseId: string;
  }) => post<AuthResponse>('/auth/register', data),
  logout: (refreshToken: string) => post<void>('/auth/logout', { refreshToken }),
  me: () => request<{ user: User }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ accessToken: string; refreshToken: string }>('/auth/change-password', { currentPassword, newPassword }),

  warehouses: () => request<{ warehouses: Warehouse[] }>('/warehouses'),
  createWarehouse: (w: Omit<Warehouse, 'id'>) => post<{ warehouse: Warehouse }>('/warehouses', w),

  orders: (params: { status?: OrderStatus; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    const s = qs.toString();
    return request<{ orders: Order[] }>(`/orders${s ? `?${s}` : ''}`);
  },
  orderStats: () => request<{ counts: Partial<Record<OrderStatus, number>> }>('/orders/stats'),
  order: (id: string) => request<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
  createOrder: (data: {
    itemName: string;
    description?: string;
    productUrl?: string;
    quantity: number;
    targetUnitPrice?: number;
    warehouseId?: string;
  }) => post<{ order: Order }>('/orders', data),
  sendOffer: (id: string, data: { unitPrice: number; quantity: number; message?: string }) =>
    post<{ order: Order }>(`/orders/${id}/offers`, data),
  acceptOffer: (id: string, offerId: string) => post<{ order: Order }>(`/orders/${id}/offers/${offerId}/accept`),
  cancelOrder: (id: string, reason?: string) => post<{ order: Order }>(`/orders/${id}/cancel`, { reason }),
  rejectOrder: (id: string, reason: string) => post<{ order: Order }>(`/orders/${id}/reject`, { reason }),
  sendToProcurement: (id: string, procurementId?: string, note?: string) =>
    post<{ order: Order }>(`/orders/${id}/send-to-procurement`, { procurementId, note }),
  advance: (
    id: string,
    data: { note?: string; supplierReference?: string; trackingNumber?: string; warehouseId?: string },
  ) => post<{ order: Order }>(`/orders/${id}/advance`, data),
  completePickup: (id: string, pickupCode: string) =>
    post<{ order: Order }>(`/orders/${id}/complete-pickup`, { pickupCode }),

  notifications: () => request<{ unread: number; notifications: AppNotification[] }>('/notifications'),
  markAllRead: () => post<void>('/notifications/read-all'),
  markRead: (id: string) => post<void>(`/notifications/${id}/read`),
  registerPushToken: (token: string) => post<void>('/notifications/push-token', { token }),
  unregisterPushToken: (token: string) =>
    request<void>('/notifications/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),

  procurementStaff: () => request<{ users: { id: string; fullName: string }[] }>('/users/procurement'),
  users: (role?: Role) => request<{ users: User[] }>(`/users${role ? `?role=${role}` : ''}`),
  createStaff: (data: { fullName: string; email: string; phone: string; role: Role; password: string }) =>
    post<{ user: User }>('/users', data),
  updateUser: (id: string, data: { active?: boolean; role?: Role }) =>
    request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
