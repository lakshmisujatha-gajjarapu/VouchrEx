---
name: real-time updates decision
description: Decision on real-time/live update strategy for CouponBazaar mobile app
type: project
---

Discussed real-time update strategy for the mobile app. Decision/preference:

- `refetchOnFocus: true` added to all tabs (Bazaar, Orders, Inbox, Listings) — covers 80% of cases
- Main gap: seller doesn't see their listing sold in real-time when a buyer purchases

**Why:** WebSockets/SSE considered overkill for a P2P voucher marketplace. Push notifications (FCM/APNs) is the preferred pattern — same as Meesho/Flipkart. Notification model + stubs already exist in the codebase.

**How to apply:** When implementing real-time seller updates, use push notifications (FCM) rather than WebSockets. Polling every 30s is acceptable as a simpler interim fallback. Do not introduce WebSocket infrastructure unless there's a live bidding or chat feature requirement.
