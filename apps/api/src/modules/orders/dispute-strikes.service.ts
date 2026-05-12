import { Injectable } from '@nestjs/common';
import { DisputeResolution, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeTier, strikeRuleFor, INDEFINITE_HOLD_UNTIL } from '../users/trust-tier';

export interface StrikeOutcome {
  readonly role: 'seller' | 'buyer' | null;
  readonly userId: string | null;
  readonly strikeNumber: number;
  readonly newTrustScore: number;
}

const NO_STRIKE: StrikeOutcome = { role: null, userId: null, strikeNumber: 0, newTrustScore: 0 };

@Injectable()
export class DisputeStrikesService {
  constructor(private readonly prisma: PrismaService) {}

  async applyDisputeStrike(
    disputeId: string,
    resolution: DisputeResolution,
    actorId: string | null
  ): Promise<StrikeOutcome> {
    const dispute = await this.prisma.dispute.findUniqueOrThrow({
      where: { id: disputeId },
      include: { order: { select: { id: true, buyerId: true, sellerId: true } } }
    });

    if (resolution === DisputeResolution.REFUND_BUYER) {
      return this.applyToUser(dispute.order.sellerId, 'seller', disputeId, actorId);
    }

    // RELEASE_TO_SELLER: strike the buyer (when they raised the dispute); skip otherwise.
    if (dispute.raisedById !== dispute.order.buyerId) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'dispute',
          entityId: disputeId,
          action: 'dispute.resolved_no_strike',
          actorId,
          metadata: {
            reason: 'seller_raised_dispute_resolved_in_seller_favor',
            raisedById: dispute.raisedById
          }
        }
      });
      return NO_STRIKE;
    }
    return this.applyToUser(dispute.order.buyerId, 'buyer', disputeId, actorId);
  }

  private async applyToUser(
    userId: string,
    role: 'seller' | 'buyer',
    disputeId: string,
    actorId: string | null
  ): Promise<StrikeOutcome> {
    let outcome: StrikeOutcome = NO_STRIKE;
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true, trustScore: true, tier: true, status: true,
          sellerStrikes: true, buyerStrikes: true, payoutHoldUntil: true
        }
      });

      const newStrikeCount =
        (role === 'seller' ? user.sellerStrikes : user.buyerStrikes) + 1;
      const rule = strikeRuleFor(newStrikeCount);

      const newScore = Math.max(0, user.trustScore - rule.scoreDelta);
      const newTier = computeTier(newScore);
      const shouldSuspend = newStrikeCount >= 3 && user.status === UserStatus.ACTIVE;
      const newStatus = shouldSuspend ? UserStatus.SUSPENDED : user.status;

      let newHoldUntil: Date | null = user.payoutHoldUntil;
      if (role === 'seller') {
        const candidate =
          rule.holdDays === 'indefinite'
            ? INDEFINITE_HOLD_UNTIL
            : new Date(Date.now() + rule.holdDays * 24 * 3600 * 1000);
        newHoldUntil =
          user.payoutHoldUntil && user.payoutHoldUntil > candidate
            ? user.payoutHoldUntil
            : candidate;
      }

      const updateData: Record<string, unknown> = {
        trustScore: newScore,
        tier: newTier,
        status: newStatus
      };
      if (role === 'seller') {
        updateData.sellerStrikes = newStrikeCount;
        updateData.payoutHoldUntil = newHoldUntil;
      } else {
        updateData.buyerStrikes = newStrikeCount;
      }

      await tx.user.update({ where: { id: userId }, data: updateData });

      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: userId,
          action: `${role}.strike_applied`,
          actorId,
          metadata: {
            disputeId,
            role,
            strikeNumber: newStrikeCount,
            scoreDelta: rule.scoreDelta,
            scoreBefore: user.trustScore,
            scoreAfter: newScore,
            tierBefore: user.tier,
            tierAfter: newTier,
            payoutHoldUntil: role === 'seller' && newHoldUntil ? newHoldUntil.toISOString() : null,
            suspended: shouldSuspend
          }
        }
      });

      outcome = { role, userId, strikeNumber: newStrikeCount, newTrustScore: newScore };
    });

    return outcome;
  }
}
