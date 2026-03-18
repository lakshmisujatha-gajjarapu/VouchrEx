# 20 — Failure Scenarios & Recovery

## Scenario 1: Payment Collected but Escrow Not Created
Server crashes after Razorpay confirms payment.
**Recovery:** Razorpay webhook retries (24hr). Idempotent handler. Reconciliation job every 15 min. Auto-refund if unresolved.

## Scenario 2: Timer Not Started After Code Reveal
Redis crashes before timer is set.
**Recovery:** Timer also stored in PostgreSQL. Background job checks orders in CODE_REVEALED without active timer. Re-creates timer.

## Scenario 3: Seller Payout Fails
Bank issue or wrong account.
**Recovery:** Retry 3x (1hr intervals). If fails → alert ops. Seller notified. Manual resolution.

## Scenario 4: Voucher Expires During Escrow
**Prevention:** Block listings expiring within 48hrs. Shorten window for near-expiry.
**Recovery:** Auto-refund buyer. No seller strike (not their fault). Platform absorbs loss.

## Scenario 5: Database Down
**Recovery:** RDS Multi-AZ auto-failover (<2 min). Redis serves cached data. No data loss (sync replication).

## Scenario 6: Mass Fraud Attack
50+ fake accounts, coordinated buying+disputes.
**Response:** Auto-block device cluster. Tighten global rate limits. Hold all pending payouts. Ops alerted. Post-incident: update fraud rules.

## Scenario 7: Razorpay Outage
**Response:** "Payments unavailable" message. Existing escrows safe. New purchases queued. Enable backup gateway (Cashfree) if prolonged.

## Scenario 8: Brand Deactivates Codes in Bulk
**Response:** Auto-verify catches at listing time. Active escrows: auto-refund. No seller strike. Platform absorbs loss.