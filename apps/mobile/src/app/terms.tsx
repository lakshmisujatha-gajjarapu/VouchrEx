import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-context';

// ─── Content primitives ───────────────────────────────────────────────────────

function SectionHeading({ children }: { readonly children: string }) {
  const theme = useTheme();
  return (
    <Text style={{
      fontFamily: theme.fontFamily.headlineExtra,
      fontSize: 15,
      color: theme.colors.ink,
      letterSpacing: -0.1,
      marginTop: theme.spacing[6],
      marginBottom: theme.spacing[2],
    }}>
      {children}
    </Text>
  );
}

function Body({ children }: { readonly children: string }) {
  const theme = useTheme();
  return (
    <Text style={{
      fontFamily: theme.fontFamily.body,
      fontSize: 14,
      color: theme.colors.inkSecondary,
      lineHeight: 22,
      marginBottom: theme.spacing[2],
    }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { readonly children: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
      <Text style={{ color: theme.colors.brand, fontSize: 14, lineHeight: 22 }}>•</Text>
      <Text style={{ flex: 1, fontFamily: theme.fontFamily.body, fontSize: 14, color: theme.colors.inkSecondary, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border, marginTop: theme.spacing[4] }} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TermsScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* Nav */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing[4],
          paddingTop: theme.spacing[2],
          paddingBottom: theme.spacing[3],
        }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => { router.back(); }}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
          </Pressable>
          <Text style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: theme.fontFamily.headlineExtra,
            fontSize: 17,
            color: theme.colors.ink,
            letterSpacing: -0.2,
            marginRight: 40,
          }}>
            Terms & Privacy
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing[5],
            paddingBottom: 60,
          }}>

          {/* Header */}
          <Text style={{
            fontFamily: theme.fontFamily.headlineExtra,
            fontSize: 26,
            color: theme.colors.ink,
            letterSpacing: -0.4,
            marginTop: theme.spacing[2],
          }}>
            Terms of Service
          </Text>
          <Text style={{
            fontFamily: theme.fontFamily.body,
            fontSize: 13,
            color: theme.colors.inkMuted,
            marginTop: 4,
            marginBottom: theme.spacing[2],
          }}>
            Last updated: April 2026
          </Text>

          <Divider />

          {/* 1 */}
          <SectionHeading>1. About VouchrEx</SectionHeading>
          <Body>
            VouchrEx is a peer-to-peer marketplace that lets buyers and sellers trade gift cards and vouchers safely. The platform is operated as a private service and is currently available only in India.
          </Body>
          <Body>
            By creating an account or using any part of the app, you agree to these terms. If you do not agree, please do not use VouchrEx.
          </Body>

          <Divider />

          {/* 2 */}
          <SectionHeading>2. Eligibility</SectionHeading>
          <Bullet>You must be at least 18 years old.</Bullet>
          <Bullet>You must be a resident of India with a valid Indian mobile number.</Bullet>
          <Bullet>You must not have been previously banned or suspended from VouchrEx.</Bullet>

          <Divider />

          {/* 3 */}
          <SectionHeading>3. Account & OTP Authentication</SectionHeading>
          <Body>
            VouchrEx uses one-time passwords (OTP) sent to your mobile number as the only sign-in method. You are responsible for keeping your device secure. Do not share OTPs with anyone — VouchrEx will never ask for your OTP.
          </Body>
          <Body>
            You may not create accounts on behalf of others or use automation to create multiple accounts.
          </Body>

          <Divider />

          {/* 4 */}
          <SectionHeading>4. Listing Vouchers (Sellers)</SectionHeading>
          <Body>
            As a seller, you confirm that:
          </Body>
          <Bullet>The voucher is valid, unexpired, and fully usable at the time of listing.</Bullet>
          <Bullet>You are the rightful owner and have the authority to sell it.</Bullet>
          <Bullet>The face value, expiry date, and voucher code you provide are accurate.</Bullet>
          <Bullet>The voucher is not stolen, fraudulently obtained, or subject to any dispute.</Bullet>
          <Body>
            Listings found to violate these conditions will be removed and your account may be suspended. VouchrEx reserves the right to withhold seller payouts pending investigation of reported fraud.
          </Body>

          <Divider />

          {/* 5 */}
          <SectionHeading>5. Buying Vouchers</SectionHeading>
          <Body>
            All payments are held in escrow until the buyer confirms the voucher is valid. After the voucher code is revealed, you have a verification window (shown on each listing) to raise a dispute. If no dispute is raised, the order is auto-confirmed and funds are released to the seller.
          </Body>
          <Bullet>Do not share revealed voucher codes with anyone outside of the intended use.</Bullet>
          <Bullet>Attempting to abuse the dispute system to get a free voucher is fraud and will result in a permanent ban.</Bullet>

          <Divider />

          {/* 6 */}
          <SectionHeading>6. Payments & Escrow</SectionHeading>
          <Body>
            Payments are processed by Razorpay. VouchrEx holds buyer funds in escrow and releases them to the seller only after successful order confirmation. A platform fee and commission are deducted per transaction — these are displayed before you complete a purchase.
          </Body>
          <Body>
            Refunds are processed only when a dispute is resolved in the buyer's favour or when VouchrEx determines the listing was fraudulent. Refunds are credited to your original payment method within 5–7 business days.
          </Body>

          <Divider />

          {/* 7 */}
          <SectionHeading>7. Disputes</SectionHeading>
          <Body>
            If you believe a voucher is invalid, expired, or does not match its listing, raise a dispute within the verification window. VouchrEx will review evidence from both parties and make a final decision within 7 business days. VouchrEx's decision is binding.
          </Body>

          <Divider />

          {/* 8 */}
          <SectionHeading>8. Prohibited Conduct</SectionHeading>
          <Bullet>Listing vouchers you do not own or have no right to sell.</Bullet>
          <Bullet>Manipulating prices or colluding with other users.</Bullet>
          <Bullet>Using the platform for money laundering or any illegal activity.</Bullet>
          <Bullet>Attempting to circumvent escrow or dispute systems.</Bullet>
          <Bullet>Harassing or threatening other users or VouchrEx staff.</Bullet>

          <Divider />

          {/* 9 */}
          <SectionHeading>9. Suspension & Termination</SectionHeading>
          <Body>
            VouchrEx may suspend or permanently ban any account that violates these terms, with or without prior notice. Pending payouts may be withheld during investigation. You may delete your account at any time by contacting support, subject to resolution of any open orders or disputes.
          </Body>

          <Divider />

          {/* 10 */}
          <SectionHeading>10. Privacy & Data</SectionHeading>
          <Body>
            We collect your mobile number, name, and transaction data to operate the platform. We do not sell your data to third parties. Payment data is handled by Razorpay under their own privacy policy.
          </Body>
          <Body>
            By using VouchrEx you consent to the collection and use of data as described, in accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
          </Body>

          <Divider />

          {/* 11 */}
          <SectionHeading>11. Limitation of Liability</SectionHeading>
          <Body>
            VouchrEx is a marketplace facilitator. We are not responsible for the quality or validity of vouchers listed by sellers. Our liability in any dispute is limited to the transaction value. VouchrEx is not liable for indirect, incidental, or consequential losses.
          </Body>

          <Divider />

          {/* 12 */}
          <SectionHeading>12. Governing Law</SectionHeading>
          <Body>
            These terms are governed by the laws of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of courts in Hyderabad, Telangana.
          </Body>

          <Divider />

          {/* 13 */}
          <SectionHeading>13. Changes to These Terms</SectionHeading>
          <Body>
            We may update these terms from time to time. Continued use of VouchrEx after changes are posted constitutes your acceptance of the new terms. We will notify you of significant changes via in-app notification.
          </Body>

          <Divider />

          {/* Contact */}
          <SectionHeading>Contact Us</SectionHeading>
          <Body>
            For questions, disputes, or support: support@vouchrex.com
          </Body>

          <View style={{ height: theme.spacing[6] }} />

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
