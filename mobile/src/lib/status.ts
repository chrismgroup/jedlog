import type { OrderStatus } from './types';
import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface StatusInfo {
  label: string;
  icon: IconName;
  tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral';
  customerHelp: string;
  staffHelp: string;
}

export const STATUS_INFO: Record<OrderStatus, StatusInfo> = {
  PENDING_REVIEW: {
    label: 'Request received',
    icon: 'document-text-outline',
    tone: 'info',
    customerHelp: 'Our team is reviewing your request and will send you a price shortly.',
    staffHelp: 'New request. Send the customer your first price offer, or decline with a reason.',
  },
  NEGOTIATING: {
    label: 'Price negotiation',
    icon: 'chatbubbles-outline',
    tone: 'warning',
    customerHelp: 'Review the latest price. Accept it, or send a counter-offer.',
    staffHelp: 'Waiting on a reply. Accept the customer’s counter-offer or send a new price.',
  },
  CONFIRMED: {
    label: 'Order confirmed',
    icon: 'checkmark-circle-outline',
    tone: 'success',
    customerHelp: 'Price agreed! We are preparing to place your order with our supplier.',
    staffHelp: 'Price agreed. Send this order to procurement to be placed in China.',
  },
  SENT_TO_PROCUREMENT: {
    label: 'Sent to procurement',
    icon: 'briefcase-outline',
    tone: 'info',
    customerHelp: 'Our procurement team is placing your order with the supplier.',
    staffHelp: 'Place the order with the supplier, then record the supplier reference.',
  },
  ORDER_PLACED: {
    label: 'Ordered in China',
    icon: 'cart-outline',
    tone: 'info',
    customerHelp: 'Your order has been placed with our supplier in China.',
    staffHelp: 'Mark as shipped once the supplier dispatches it. Add a tracking number if available.',
  },
  SHIPPED_FROM_CHINA: {
    label: 'Shipped from China',
    icon: 'airplane-outline',
    tone: 'info',
    customerHelp: 'Your item is on its way to Nigeria.',
    staffHelp: 'Mark as arrived when the shipment lands in Nigeria.',
  },
  ARRIVED_NIGERIA: {
    label: 'Arrived in Nigeria',
    icon: 'flag-outline',
    tone: 'info',
    customerHelp: 'Your item has arrived in Nigeria and is going through customs.',
    staffHelp: 'Mark as cleared once customs releases the shipment.',
  },
  CUSTOMS_CLEARED: {
    label: 'Cleared by customs',
    icon: 'shield-checkmark-outline',
    tone: 'info',
    customerHelp: 'Customs has cleared your item. It is heading to your pickup warehouse.',
    staffHelp: 'Mark as ready when it reaches the customer’s warehouse. A pickup code is sent to them.',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for pickup',
    icon: 'cube-outline',
    tone: 'success',
    customerHelp: 'Visit the warehouse and show your 6-digit pickup code to collect your item.',
    staffHelp: 'Ask the customer for their pickup code and enter it to release the item.',
  },
  PICKED_UP: {
    label: 'Collected',
    icon: 'happy-outline',
    tone: 'success',
    customerHelp: 'You have collected this order. Thank you for using Jetlog!',
    staffHelp: 'Completed.',
  },
  REJECTED: {
    label: 'Declined',
    icon: 'close-circle-outline',
    tone: 'danger',
    customerHelp: 'We could not fulfil this request. See the reason in the timeline below.',
    staffHelp: 'This request was declined.',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: 'remove-circle-outline',
    tone: 'neutral',
    customerHelp: 'You cancelled this request.',
    staffHelp: 'The customer cancelled this request.',
  },
};

// The journey shown on the progress tracker.
export const JOURNEY: OrderStatus[] = [
  'PENDING_REVIEW',
  'NEGOTIATING',
  'CONFIRMED',
  'ORDER_PLACED',
  'SHIPPED_FROM_CHINA',
  'ARRIVED_NIGERIA',
  'CUSTOMS_CLEARED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
];

export function journeyIndex(status: OrderStatus) {
  if (status === 'SENT_TO_PROCUREMENT') return JOURNEY.indexOf('CONFIRMED');
  return JOURNEY.indexOf(status);
}

export const LOGISTICS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  SENT_TO_PROCUREMENT: 'ORDER_PLACED',
  ORDER_PLACED: 'SHIPPED_FROM_CHINA',
  SHIPPED_FROM_CHINA: 'ARRIVED_NIGERIA',
  ARRIVED_NIGERIA: 'CUSTOMS_CLEARED',
  CUSTOMS_CLEARED: 'READY_FOR_PICKUP',
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'PENDING_REVIEW',
  'NEGOTIATING',
  'CONFIRMED',
  'SENT_TO_PROCUREMENT',
  'ORDER_PLACED',
  'SHIPPED_FROM_CHINA',
  'ARRIVED_NIGERIA',
  'CUSTOMS_CLEARED',
  'READY_FOR_PICKUP',
];
