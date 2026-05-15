import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, type SellerPublicStats } from '@/lib/api';
import { useTheme } from '@/theme/theme-context';

function StatCell({ label, value, theme, tone = 'neutral' }: {
  readonly label: string;
  readonly value: string;
  readonly theme: ReturnType<typeof useTheme>;
  readonly tone?: 'neutral' | 'warning';
}) {
  const valueColor = tone === 'warning' ? theme.colors.warning : theme.colors.ink;
  return (
    <View style={{
      flex: 1, backgroundColor: theme.colors.surfaceRaised,
      borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing[3], paddingVertical: 10, gap: 2,
    }}>
      <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 18, color: valueColor }}>{value}</Text>
      <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 11, color: theme.colors.inkSecondary }}>{label}</Text>
    </View>
  );
}

function Section({ title, children, theme }: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ marginTop: theme.spacing[6] }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[2], gap: 8,
      }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: theme.colors.brand }} />
        <Text style={{
          fontFamily: theme.fontFamily.labelSemi, fontSize: 11,
          color: theme.colors.inkSecondary, letterSpacing: 0.8, textTransform: 'uppercase',
        }}>
          {title}
        </Text>
      </View>
      <View style={{
        marginHorizontal: theme.spacing[4], backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
      }}>
        {React.Children.map(children, (child, i) => (
          <>
            {i > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 34 + theme.spacing[3] + theme.spacing[5] }} />}
            {child}
          </>
        ))}
      </View>
    </View>
  );
}

export default function SellerProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, name: nameParam, tier: tierParam } = useLocalSearchParams<{
    readonly id?: string | string[];
    readonly name?: string | string[];
    readonly tier?: string | string[];
  }>();

  const sellerId = useMemo(() => Array.isArray(id) ? id[0] : id, [id]);
  const sellerName = useMemo(() => {
    const v = Array.isArray(nameParam) ? nameParam[0] : nameParam;
    return v ?? 'Seller';
  }, [nameParam]);

  const [stats, setStats] = useState<SellerPublicStats | null>(null);

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    void api.getSellerPublicStats(sellerId)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { /* leave null; tier from params shown in card */ });
    return () => { cancelled = true; };
  }, [sellerId]);

  const rawTier = stats
    ? stats.tier.toLowerCase() as 'gold' | 'silver' | 'bronze' | 'blocked'
    : (() => {
        const v = Array.isArray(tierParam) ? tierParam[0] : tierParam;
        return v === 'gold' || v === 'silver' ? v : 'bronze';
      })();

  const initial = sellerName[0].toUpperCase();

  const tierColor =
    rawTier === 'gold' ? theme.colors.gold :
    rawTier === 'silver' ? theme.colors.silver :
    rawTier === 'blocked' ? theme.colors.danger :
    theme.colors.bronze;

  const tierIcon: keyof typeof Ionicons.glyphMap =
    rawTier === 'gold' ? 'trophy' :
    rawTier === 'silver' ? 'medal' :
    rawTier === 'blocked' ? 'ban' :
    'ribbon';

  const tierTagline =
    rawTier === 'gold' ? 'Top seller · trusted by buyers' :
    rawTier === 'silver' ? 'Growing reputation' :
    rawTier === 'blocked' ? 'Account restricted' :
    'Building their reputation';

  const score = stats?.trustScore ?? 0;
  const target = stats?.nextTierAt ?? 100;
  const pct = stats ? Math.min(100, Math.max(0, (score / target) * 100)) : 0;
  const nextTierName =
    target === 50 ? 'Silver' :
    target === 80 ? 'Gold' :
    null;
  const subtitle = stats == null
    ? 'Loading…'
    : nextTierName
      ? `${String(target - score)} more points to unlock ${nextTierName}`
      : `Top tier seller`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }}>

          {/* ── Nav ── */}
          <View style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[2], paddingBottom: theme.spacing[1] }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => { router.back(); }}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20,
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
              })}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
            </Pressable>
          </View>

          {/* ── Hero ── */}
          <View style={{
            paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[1],
            paddingBottom: theme.spacing[5], gap: theme.spacing[4],
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] }}>
              <View style={{
                borderRadius: 36, shadowColor: theme.colors.brand,
                shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 5,
              }}>
                <LinearGradient
                  colors={theme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 28, color: theme.colors.white }}>
                    {initial}
                  </Text>
                </LinearGradient>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 22, letterSpacing: -0.3, color: theme.colors.ink }}>
                  {sellerName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="shield-checkmark" size={13} color={theme.colors.action} />
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.action }}>
                    Verified seller
                  </Text>
                </View>
              </View>
            </View>

            {/* Membership card */}
            <View style={{
              flexDirection: 'row', backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md, borderWidth: 1, borderColor: `${tierColor}30`,
              overflow: 'hidden', shadowColor: tierColor,
              shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
            }}>
              <View style={{ width: 4, backgroundColor: tierColor }} />
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: theme.spacing[4], paddingVertical: 14, gap: theme.spacing[3],
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${tierColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={tierIcon} size={20} color={tierColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 15, color: theme.colors.ink }}>
                    {rawTier.charAt(0).toUpperCase() + rawTier.slice(1)} member
                  </Text>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkSecondary, marginTop: 1 }}>
                    {tierTagline}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill,
                  backgroundColor: `${tierColor}18`, borderWidth: 1, borderColor: `${tierColor}30`,
                }}>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 12, color: tierColor }}>
                    {String(stats?.totalSales ?? 0)} sales
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Trust & Activity ── */}
          <Section title="Trust & Activity" theme={theme}>
            {/* Trust score */}
            <View style={{ paddingHorizontal: theme.spacing[5], paddingVertical: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.labelSemi, fontSize: 13, color: theme.colors.ink }}>Trust score</Text>
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: tierColor, marginTop: 1 }}>
                    {rawTier.charAt(0).toUpperCase() + rawTier.slice(1)} tier
                  </Text>
                </View>
                <Text style={{ fontFamily: theme.fontFamily.headlineExtra, fontSize: 22, color: tierColor }}>
                  {stats ? String(stats.trustScore) : '—'}
                  <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 13, color: theme.colors.inkMuted }}>{' '}/ {String(target)}</Text>
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceHigh, overflow: 'hidden' }}>
                <View style={{ width: (`${String(pct)}%`) as `${number}%`, height: '100%', backgroundColor: tierColor }} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.body, fontSize: 12, color: theme.colors.inkSecondary }}>{subtitle}</Text>
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: 'row', paddingHorizontal: theme.spacing[5], paddingVertical: 10, gap: theme.spacing[3] }}>
              <StatCell label="Sales" value={String(stats?.totalSales ?? '—')} theme={theme} />
              <StatCell label="Disputes against" value={String(stats?.disputesAgainst ?? '—')} theme={theme} tone={(stats?.disputesAgainst ?? 0) > 0 ? 'warning' : 'neutral'} />
            </View>
          </Section>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
