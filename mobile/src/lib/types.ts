export type Role = 'customer' | 'manager' | 'procurement' | 'admin';

export type OrderStatus =
  | 'PENDING_REVIEW'
  | 'NEGOTIATING'
  | 'CONFIRMED'
  | 'SENT_TO_PROCUREMENT'
  | 'ORDER_PLACED'
  | 'SHIPPED_FROM_CHINA'
  | 'ARRIVED_NIGERIA'
  | 'CUSTOMS_CLEARED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'REJECTED'
  | 'CANCELLED';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  state?: string | null;
  preferredWarehouseId?: string | null;
  active?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone?: string | null;
  active?: boolean;
}

export interface Order {
  id: string;
  reference: string;
  itemName: string;
  description?: string | null;
  productUrl?: string | null;
  requestedQuantity: number;
  targetUnitPrice?: number | null;
  currency: string;
  status: OrderStatus;
  statusLabel: string;
  finalUnitPrice?: number | null;
  finalQuantity?: number | null;
  finalTotal?: number | null;
  supplierReference?: string | null;
  trackingNumber?: string | null;
  pickupCode?: string;
  customer?: { id: string; name: string; phone?: string };
  warehouse?: { id: string; name: string; address: string; city: string; state: string };
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  bySide: 'customer' | 'staff';
  byName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  message?: string | null;
  status: 'open' | 'accepted' | 'superseded' | 'withdrawn';
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  label: string;
  note?: string | null;
  by?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  orderId?: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
