import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationChannel, UserStatus, type AppConfig } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type SeedRow = {
  readonly key: string;
  readonly value: string;
  readonly valueType: 'number' | 'string' | 'boolean' | 'json';
  readonly description: string;
};

// Defaults seeded on first boot. Editable at runtime via /admin/config.
const SEED_ROWS: readonly SeedRow[] = [
  {
    key: 'buyer_fee_rate',
    value: '0.10',
    valueType: 'number',
    description: 'Fraction of listing sellingPrice charged to buyer on top of price (0.10 = 10%).'
  },
  {
    key: 'seller_commission_rate',
    value: '0.10',
    valueType: 'number',
    description: 'Fraction of listing sellingPrice deducted from seller payout (0.10 = 10%).'
  },
  {
    key: 'listing_max_price_inr',
    value: '1000',
    valueType: 'number',
    description: 'Maximum allowed voucher faceValue in INR. Listings above this are rejected.'
  }
];

// Cache TTL keeps multi-replica deployments eventually consistent. A PUT on one
// replica invalidates its own cache immediately; other replicas pick up the change
// within CACHE_TTL_MS. Trade-off vs. a Redis pub/sub invalidation channel: simpler
// and good enough while config is read on hot paths (~per order/listing create).
const CACHE_TTL_MS = 30_000;

const PUBLIC_CONFIG_KEYS = ['buyer_fee_rate', 'seller_commission_rate', 'listing_max_price_inr'] as const;
const PUBLIC_CONFIG_FALLBACKS = {
  buyer_fee_rate: 0.10,
  seller_commission_rate: 0.10,
  listing_max_price_inr: 1000
} as const;

// Hard upper bounds — a typo like 1.0 instead of 0.10 must never reach
// production. These caps are deliberately generous (rates can be 100%, caps
// can be very large) but reject impossibly absurd values that signal an error
// rather than a deliberate change. Stricter "are you sure?" warnings live in
// the admin UI, not here.
const KEY_BOUNDS: Record<string, { min: number; max: number; label: string }> = {
  buyer_fee_rate: { min: 0, max: 1, label: 'rate (0 to 1)' },
  seller_commission_rate: { min: 0, max: 1, label: 'rate (0 to 1)' },
  listing_max_price_inr: { min: 0, max: 1_000_000, label: 'INR amount' }
};

@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly cache = new Map<string, { value: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService
  ) {}

  async onModuleInit(): Promise<void> {
    for (const row of SEED_ROWS) {
      await this.prisma.appConfig.upsert({
        where: { key: row.key },
        create: {
          key: row.key,
          value: row.value,
          valueType: row.valueType,
          description: row.description
        },
        update: {}
      });
    }
  }

  async getAll(): Promise<AppConfig[]> {
    return this.prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
  }

  /**
   * Public, client-facing config. Mobile reads this at boot to drive the UI.
   * Loads all three keys in a single findMany (then warms the cache) instead of
   * three potentially-uncached findUnique calls.
   */
  async getPublicConfig(): Promise<{
    buyerFeeRate: number;
    sellerCommissionRate: number;
    listingMaxPriceInr: number;
  }> {
    const values = await this.getNumbersBulk(PUBLIC_CONFIG_KEYS, PUBLIC_CONFIG_FALLBACKS);
    return {
      buyerFeeRate: values.buyer_fee_rate,
      sellerCommissionRate: values.seller_commission_rate,
      listingMaxPriceInr: values.listing_max_price_inr
    };
  }

  private async getNumbersBulk<K extends string>(
    keys: readonly K[],
    fallbacks: Readonly<Record<K, number>>
  ): Promise<Record<K, number>> {
    const result = {} as Record<K, number>;
    const missing: K[] = [];
    const now = Date.now();

    for (const k of keys) {
      const cached = this.cache.get(k);
      if (cached && cached.expiresAt > now) {
        const n = Number(cached.value);
        result[k] = Number.isFinite(n) ? n : fallbacks[k];
      } else {
        missing.push(k);
      }
    }

    if (missing.length > 0) {
      const rows = await this.prisma.appConfig.findMany({ where: { key: { in: missing as string[] } } });
      const byKey = new Map(rows.map((r) => [r.key, r.value]));
      for (const k of missing) {
        const raw = byKey.get(k);
        if (raw === undefined) {
          result[k] = fallbacks[k];
        } else {
          this.cache.set(k, { value: raw, expiresAt: Date.now() + CACHE_TTL_MS });
          const n = Number(raw);
          result[k] = Number.isFinite(n) ? n : fallbacks[k];
        }
      }
    }

    return result;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const raw = await this.getRaw(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      this.logger.warn(`AppConfig key '${key}' value '${raw}' is not a finite number — using fallback ${String(fallback)}`);
      return fallback;
    }
    return parsed;
  }

  async set(
    key: string,
    value: string,
    actorId: string | null,
    opts?: {
      readonly notify?: {
        readonly title: string;
        readonly message: string;
      };
    }
  ): Promise<AppConfig> {
    const existing = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!existing) {
      throw new BadRequestException(`Unknown config key '${key}'.`);
    }

    this.validate(existing.valueType, value);
    this.validateKeyBounds(key, value);

    // Persist the value change and the audit-log entry atomically — if either
    // fails the other must not happen, otherwise the settings table drifts
    // away from its auditable history.
    const [updated] = await this.prisma.$transaction([
      this.prisma.appConfig.update({
        where: { key },
        data: { value, updatedBy: actorId }
      }),
      this.prisma.auditLog.create({
        data: {
          entityType: 'app_config',
          entityId: key,
          action: 'config.updated',
          actorId,
          metadata: {
            oldValue: existing.value,
            newValue: value,
            notified: Boolean(opts?.notify)
          }
        }
      })
    ]);

    // Post-commit side effects: cache invalidate, realtime broadcast, and the
    // optional marketing fan-out. None of these should be inside the transaction.
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    const publicConfig = await this.getPublicConfig();
    this.eventEmitter.emit('config.updated', publicConfig);

    if (opts?.notify) {
      // Best-effort, post-commit fan-out: a notification failure must not roll
      // back the config update. The fan-out is one Prisma createMany followed
      // by N event emits inside NotificationsService.createMany. Since the
      // channel is IN_APP only, there's no Expo/APNs/FCM call in the hot path,
      // so cost is essentially the DB write + waiting on N event handlers for
      // the admin's PUT request. Comfortable up to tens of thousands of active
      // users; move to a background queue if the admin save latency becomes
      // user-visible (>~1s).
      try {
        await this.broadcastConfigChangeNotification(key, opts.notify);
      } catch (err) {
        this.logger.error(`Failed to broadcast config notification for '${key}': ${String(err)}`);
      }
    }

    return updated;
  }

  private async broadcastConfigChangeNotification(
    key: string,
    notify: { readonly title: string; readonly message: string }
  ): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: { id: true }
    });

    if (recipients.length === 0) return;

    // IN_APP channel: writes a Notification row that shows up in the user's
    // inbox bell, but does NOT trigger an OS-level push (no Expo dispatch).
    // Config changes are ambient information; pushing them at 2am would burn
    // notification trust. Use a real campaign/marketing pipeline (with quiet
    // hours, opt-outs, and budgets) for anything that should wake the phone.
    await this.notificationsService.createMany(
      recipients.map((u) => ({
        userId: u.id,
        eventType: `config.${key}.announcement`,
        title: notify.title,
        message: notify.message,
        channel: NotificationChannel.IN_APP,
        metadata: { configKey: key }
      }))
    );

    this.logger.log(`Broadcast in-app config notification for '${key}' to ${String(recipients.length)} users.`);
  }

  private async getRaw(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!row) {
      this.cache.delete(key);
      return null;
    }

    this.cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
    return row.value;
  }

  /**
   * Per-key bounds check. Catches fat-finger typos like "1.0" for a rate that
   * should be a fraction, or a faceValue cap of "100000000" when "10000" was
   * meant. Stricter heuristics (e.g. "rate changed by >5×") belong in the
   * admin UI as a confirmation step, not as a server-side rejection.
   */
  private validateKeyBounds(key: string, value: string): void {
    const bounds = KEY_BOUNDS[key];
    if (!bounds) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return; // covered by validate()
    if (n < bounds.min || n > bounds.max) {
      throw new BadRequestException(
        `Value ${String(n)} for '${key}' is out of bounds. Expected ${bounds.label}: ${String(bounds.min)} to ${String(bounds.max)}.`
      );
    }
  }

  private validate(valueType: string, value: string): void {
    if (valueType === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new BadRequestException(`Value '${value}' is not a valid number.`);
      }
      // Rates live in [0, 1]; absolute amounts are positive. Allow either.
      if (n < 0) {
        throw new BadRequestException('Value cannot be negative.');
      }
    } else if (valueType === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        throw new BadRequestException(`Value '${value}' is not a valid boolean ('true' or 'false').`);
      }
    } else if (valueType === 'json') {
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException(`Value '${value}' is not valid JSON.`);
      }
    }
    // string: no validation
  }
}
