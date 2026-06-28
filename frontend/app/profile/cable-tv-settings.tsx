/**
 * Cable TV Settings & GETV Coins Wallet
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const BRAND = '#2D8B47';
const BRAND_LIGHT = '#ECFDF5';

type LedgerRow = {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_type: string;
  created_at: string;
};

export default function CableTVSettingsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [eligibility, setEligibility] = useState<{
    tier: string;
    tier_max_redeemable: number;
    current_month_spend: number;
    available_to_redeem: number;
    can_redeem: boolean;
    already_redeemed: number;
    next_tier: { name: string; spend_needed: number; unlocks: number } | null;
    coins_suspended: boolean;
  } | null>(null);

  const fetchWalletData = useCallback(async () => {
    if (!user?.cable_tv_linked) return;
    try {
      const [balRes, ledgerRes] = await Promise.all([
        api.get('/user/loop-balance'),
        api.get('/user/loop-ledger?limit=30'),
      ]);
      const bal: number = balRes.data.loop_balance ?? 0;
      setBalance(bal);
      const rows: LedgerRow[] = ledgerRes.data.rows ?? [];
      setLedgerRows(rows);
      let earned = 0; let spent = 0;
      rows.forEach(r => {
        if (r.type === 'credit') earned += r.amount;
        else spent += Math.abs(r.amount);
      });
      setTotalEarned(earned);
      setTotalSpent(spent);
      // Fetch tier eligibility
      const eligRes = await api.get('/user/loop-eligibility').catch(() => null);
      if (eligRes) setEligibility(eligRes.data);
    } catch (err) {
      console.warn('Wallet fetch error:', err);
    }
  }, [user?.cable_tv_linked]);

  useFocusEffect(useCallback(() => { fetchWalletData(); }, [fetchWalletData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(), refreshUser()]);
    setRefreshing(false);
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Cable TV',
      'This will disconnect your cable TV. Your existing GETV coins will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await api.post('/cable-tv/unlink').catch(() => {});
              await refreshUser();
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to unlink. Please try again.');
            } finally {
              setUnlinking(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  if (!user?.cable_tv_linked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cable TV & GETV Coins</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notLinkedWrap}>
          <Ionicons name="tv-outline" size={64} color="#9CA3AF" />
          <Text style={styles.notLinkedTitle}>Cable TV Not Linked</Text>
          <Text style={styles.notLinkedText}>
            Link your cable TV account to start earning GETV coins on every bill payment.
          </Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(tabs)/home')}>
            <Text style={styles.linkBtnText}>Link on Home Screen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cable TV & GETV Coins</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
      >
        {/* Provider status */}
        <View style={styles.providerCard}>
          <View style={styles.providerRow}>
            <View style={styles.tvIconWrap}>
              <Ionicons name="tv" size={26} color={BRAND} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName}>
                {user.cable_tv_details?.service_provider || 'Cable TV'}
              </Text>
              <Text style={styles.providerSub}>
                NUID: {user.cable_tv_details?.user_id_nuid || 'N/A'}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={13} color={BRAND} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Wallet */}
        <View style={styles.walletCard}>
          <Text style={styles.cardTitle}>GETV Coins Wallet</Text>

          <View style={styles.balanceHero}>
            <Text style={styles.balanceLabel}>GETV Coin Balance</Text>
            <Text style={styles.balanceAmount}>₹{balance.toFixed(0)}</Text>
            <Text style={styles.balanceHint}>
              {eligibility?.coins_suspended
                ? '⚠️ Auto-credit paused — pay cable bill to resume'
                : eligibility?.can_redeem
                  ? `Redeem up to ₹${eligibility.available_to_redeem.toFixed(0)} this month`
                  : 'Spend ₹7,000/month to unlock redemption'}
            </Text>
          </View>

          {/* Tier progress */}
          {eligibility && (
            <View style={styles.tierBox}>
              <View style={styles.tierRow}>
                <Text style={styles.tierLabel}>Current Tier</Text>
                <Text style={styles.tierName}>{eligibility.tier}</Text>
              </View>
              <View style={styles.tierRow}>
                <Text style={styles.tierLabel}>This Month's Spend</Text>
                <Text style={styles.tierSpend}>₹{eligibility.current_month_spend.toFixed(0)}</Text>
              </View>
              {eligibility.can_redeem && (
                <View style={styles.tierRow}>
                  <Text style={styles.tierLabel}>Redeemable This Month</Text>
                  <Text style={styles.tierRedeem}>
                    ₹{eligibility.available_to_redeem.toFixed(0)} / ₹{eligibility.tier_max_redeemable.toFixed(0)}
                    {eligibility.already_redeemed > 0 ? ` (₹${eligibility.already_redeemed.toFixed(0)} used)` : ''}
                  </Text>
                </View>
              )}
              {eligibility.next_tier && !eligibility.can_redeem && (
                <View style={styles.nextTierHint}>
                  <Text style={styles.nextTierText}>
                    Spend ₹{eligibility.next_tier.spend_needed.toFixed(0)} more → unlock {eligibility.next_tier.name} (₹{eligibility.next_tier.unlocks}/month)
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {
                      width: `${Math.min(100, (eligibility.current_month_spend / 7000) * 100)}%`
                    }]} />
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="trending-up-outline" size={20} color={BRAND} />
              <Text style={styles.statValue}>{'₹'}{totalEarned.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Received</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Ionicons name="wallet-outline" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{'₹'}{balance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Activated</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Ionicons name="bag-handle-outline" size={20} color="#EF4444" />
              <Text style={styles.statValue}>{'₹'}{totalSpent.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Spent</Text>
            </View>
          </View>

          <View style={styles.earnInfo}>
            <Ionicons name="information-circle-outline" size={15} color="#6B7280" />
            <Text style={styles.earnInfoText}>
              1,000 GETV coins (₹1,000) credited every month when your cable+broadband bill is ₹1,000+. 1 coin = ₹1.
            </Text>
          </View>
        </View>

        {/* Transaction history */}
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Transaction History</Text>
          {ledgerRows.length === 0 ? (
            <View style={styles.emptyTx}>
              <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyTxText}>No transactions yet</Text>
              <Text style={styles.emptyTxSub}>Coins appear here after your cable bill is processed</Text>
            </View>
          ) : (
            ledgerRows.map((row, i) => (
              <View key={row.id ?? i} style={[styles.txRow, i === ledgerRows.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons
                  name={row.type === 'credit' ? 'add-circle' : 'remove-circle'}
                  size={22}
                  color={row.type === 'credit' ? BRAND : '#EF4444'}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{row.description || row.reference_type}</Text>
                  <Text style={styles.txDate}>{formatDate(row.created_at)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: row.type === 'credit' ? BRAND : '#EF4444' }]}>
                  {row.type === 'credit' ? '+' : '-'}{'₹'}{Math.abs(row.amount).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Unlink */}
        <TouchableOpacity style={styles.unlinkBtn} onPress={handleUnlink} disabled={unlinking}>
          {unlinking
            ? <ActivityIndicator color="#EF4444" size="small" />
            : <>
                <Ionicons name="unlink" size={17} color="#EF4444" />
                <Text style={styles.unlinkText}>Unlink Cable TV</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },

  notLinkedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  notLinkedTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginTop: 16 },
  notLinkedText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  linkBtn: { backgroundColor: BRAND, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  linkBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  providerCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tvIconWrap: { backgroundColor: BRAND_LIGHT, borderRadius: 10, padding: 10 },
  providerName: { fontSize: 14, fontWeight: '700', color: '#111' },
  providerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND_LIGHT, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  activeText: { fontSize: 11, fontWeight: '700', color: BRAND },

  walletCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 14 },

  balanceHero: { backgroundColor: BRAND, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: '#fff' },
  balanceHint: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  tierBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 12, gap: 6 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierLabel: { fontSize: 12, color: '#6B7280' },
  tierName: { fontSize: 13, fontWeight: '700', color: BRAND },
  tierSpend: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tierRedeem: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  nextTierHint: { marginTop: 4 },
  nextTierText: { fontSize: 11, color: '#6B7280', marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: BRAND, borderRadius: 3 },

  statsRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center' },

  earnInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
  earnInfoText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 16 },

  section: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },

  emptyTx: { alignItems: 'center', paddingVertical: 20 },
  emptyTxText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginTop: 10 },
  emptyTxSub: { fontSize: 11, color: '#D1D5DB', marginTop: 4, textAlign: 'center' },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#111' },
  txDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  unlinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 12,
    paddingVertical: 13, marginTop: 4,
  },
  unlinkText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});
