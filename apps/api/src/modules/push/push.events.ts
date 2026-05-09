/**
 * Push event-type mapping.
 *
 * Each entry maps a notification `eventType` (the same string passed to
 * `NotificationsService.createNotification`) to a builder for the push payload.
 * Anything not in this map is in-app only — no OS-level push.
 *
 * Reference: `docs/superpowers/specs/2026-05-09-realtime-and-push-design.md`
 * (Phase 1B push matrix).
 *
 * Audited event-types currently fired in production code (see audit in
 * `orders.service.ts`, `listings.service.ts`):
 *
 *   Push-eligible (in matrix and currently fired):
 *     - 'payment.captured'      — buyer + seller (escrow active)
 *     - 'code.revealed'         — buyer (voucher revealed)
 *     - 'buyer.revealed'        — seller (buyer opened the code)
 *     - 'order.confirmed'       — buyer + seller (manual confirm / payout initiated)
 *     - 'order.auto_confirmed'  — buyer + seller (auto-confirmed)
 *     - 'listing.reserved'      — seller (voucher sold / reserved)
 *     - 'dispute.created'       — buyer + seller (dispute opened)
 *     - 'dispute.resolved'      — buyer + seller (dispute resolved)
 *
 *   In-app only / not push (currently fired but excluded):
 *     - 'order.created'                    (in-app checkout prompt to buyer)
 *     - 'listing.created'                  (seller's own action)
 *     - 'order.payment_timeout'            (informational, low urgency)
 *     - 'order.voucher_expired'            (informational)
 *     - 'code.reveal_reminder_60min'       (Phase 2 — reveal warnings)
 *     - 'code.reveal_reminder_30min'
 *     - 'code.reveal_reminder_5min'
 *     - 'dispute.seller_reminder'
 *     - 'dispute.seller_responded'
 *
 *   Spec-listed but not yet fired (Phase 2 follow-ups):
 *     - auto-confirm warning  (no notification call exists yet)
 *     - payout completed      (no notification call exists yet)
 */

export type NotificationLike = {
  readonly id: string;
  readonly userId: string | null;
  readonly orderId: string | null;
  readonly listingId: string | null;
  readonly eventType: string;
  readonly title: string;
  readonly message: string;
  readonly metadata: unknown;
};

export type PushEnabledEvent = {
  readonly title: (notification: NotificationLike) => string;
  readonly body: (notification: NotificationLike) => string;
  readonly link: (notification: NotificationLike) => string;
};

const orderLink = (n: NotificationLike) => (n.orderId ? `/orders/${n.orderId}` : '/inbox');
const listingLink = (n: NotificationLike) => (n.listingId ? `/listings/${n.listingId}` : '/inbox');

const fromNotification = (linkFn: (n: NotificationLike) => string): PushEnabledEvent => ({
  title: (n) => n.title,
  body: (n) => n.message,
  link: linkFn
});

/**
 * Event-types that trigger a push (in addition to the in-app realtime).
 * Anything not in this map = in-app only, no push.
 */
export const PUSH_ENABLED_EVENTS: Record<string, PushEnabledEvent> = {
  // Buyer-side
  'payment.captured': fromNotification(orderLink),
  'code.revealed': fromNotification(orderLink),
  'order.auto_confirmed': fromNotification(orderLink),
  'order.confirmed': fromNotification(orderLink),
  'dispute.resolved': fromNotification(orderLink),

  // Seller-side
  'listing.reserved': fromNotification((n) => (n.orderId ? `/orders/${n.orderId}` : listingLink(n))),
  'buyer.revealed': fromNotification(orderLink),
  'dispute.created': fromNotification(orderLink)
};

export function shouldPush(eventType: string): boolean {
  return eventType in PUSH_ENABLED_EVENTS;
}

export function buildPushPayload(notification: NotificationLike) {
  const config = PUSH_ENABLED_EVENTS[notification.eventType];
  if (!config) return null;
  return {
    title: config.title(notification),
    body: config.body(notification),
    link: config.link(notification)
  };
}
