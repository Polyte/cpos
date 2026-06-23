import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api } from '../services/api';
import {
  getUserData,
  getActiveShift,
  setActiveShift,
  removeActiveShift,
  getOfflineQueue,
} from '../services/storage';
import { COLORS, MERCHANT_IDS } from '../utils/constants';

export default function ShiftScreen() {
  const [shift, setShift] = useState<any>(null);
  const [shiftReport, setShiftReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadShiftData();
    loadOfflineCount();
  }, []);

  const loadShiftData = async () => {
    const userData = await getUserData();
    setUser(userData);
    const saved = await getActiveShift();
    if (saved) {
      setShift(saved);
      // Load shift report
      const report = await api.getShiftReport(saved.id);
      if (report) setShiftReport(report);
    } else if (userData?.id) {
      // Check server for active shift
      const result = await api.getActiveShift(userData.id);
      if (result.active && result.shift) {
        setShift(result.shift);
        await setActiveShift(result.shift);
      }
    }
  };

  const loadOfflineCount = async () => {
    const queue = await getOfflineQueue();
    setOfflineCount(queue.length);
  };

  const handleStartShift = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const mid = MERCHANT_IDS[user.merchantProfile || 'Retail'] || 'merchant:M1';
      const result = await api.startShift(user.id, mid, user.name);
      if (result.success !== false && result.shift) {
        setShift(result.shift);
        await setActiveShift(result.shift);
        Toast.show({ type: 'success', text1: 'Shift Started', text2: `Good luck, ${user.name}!` });
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: result.error || 'Could not start shift' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = () => {
    Alert.alert(
      'End Shift',
      'Are you sure you want to end your current shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Shift', style: 'destructive', onPress: confirmEndShift },
      ]
    );
  };

  const confirmEndShift = async () => {
    if (!shift) return;
    setLoading(true);
    try {
      const result = await api.endShift(shift.id);
      if (result.success !== false) {
        setShiftReport(result.report || null);
        setShift(null);
        await removeActiveShift();
        Toast.show({ type: 'success', text1: 'Shift Ended', text2: 'Great work today!' });
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: result.error || 'Could not end shift' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const shiftDuration = shift
    ? Math.floor((Date.now() - new Date(shift.startedAt || shift.createdAt).getTime()) / 60000)
    : 0;
  const hours = Math.floor(shiftDuration / 60);
  const minutes = shiftDuration % 60;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SHIFT MANAGEMENT</Text>
        <Text style={styles.headerSubtitle}>{user?.name || 'User'}</Text>
      </View>

      {/* Shift Status Card */}
      <View style={[styles.statusCard, shift && styles.statusCardActive]}>
        <View style={styles.statusIcon}>
          <Ionicons
            name={shift ? 'timer' : 'timer-outline'}
            size={32}
            color={shift ? COLORS.success : COLORS.textMuted}
          />
        </View>
        <Text style={styles.statusTitle}>
          {shift ? 'SHIFT ACTIVE' : 'NO ACTIVE SHIFT'}
        </Text>
        {shift && (
          <>
            <Text style={styles.duration}>
              {hours}h {minutes.toString().padStart(2, '0')}m
            </Text>
            <Text style={styles.shiftStart}>
              Started: {new Date(shift.startedAt || shift.createdAt).toLocaleTimeString()}
            </Text>
          </>
        )}
      </View>

      {/* Stats */}
      {shift && shiftReport && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{shiftReport.transactionCount || 0}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color={COLORS.success} />
            <Text style={styles.statValue}>R {(shiftReport.totalSales || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="card-outline" size={20} color={COLORS.info} />
            <Text style={styles.statValue}>{shiftReport.cardCount || 0}</Text>
            <Text style={styles.statLabel}>Card Payments</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color={COLORS.warning} />
            <Text style={styles.statValue}>{shiftReport.cashCount || 0}</Text>
            <Text style={styles.statLabel}>Cash Payments</Text>
          </View>
        </View>
      )}

      {/* Offline Queue */}
      {offlineCount > 0 && (
        <View style={styles.offlineCard}>
          <Ionicons name="cloud-upload-outline" size={20} color={COLORS.warning} />
          <View style={styles.offlineInfo}>
            <Text style={styles.offlineTitle}>Offline Queue</Text>
            <Text style={styles.offlineSubtitle}>
              {offlineCount} transactions pending sync
            </Text>
          </View>
        </View>
      )}

      {/* Action Button */}
      <View style={styles.actionSection}>
        {shift ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={handleEndShift}
            disabled={loading}
          >
            <Ionicons name="stop-circle" size={20} color="#fff" />
            <Text style={styles.endButtonText}>
              {loading ? 'ENDING...' : 'END SHIFT'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartShift}
            disabled={loading}
          >
            <Ionicons name="play-circle" size={20} color="#000" />
            <Text style={styles.startButtonText}>
              {loading ? 'STARTING...' : 'START SHIFT'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Shift Info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Information</Text>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Start a shift before processing transactions. All sales will be tracked under your shift.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Offline transactions are queued and synced automatically when connection is restored.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 100 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  headerSubtitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  statusCard: {
    margin: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusCardActive: {
    borderColor: COLORS.success + '40',
    backgroundColor: COLORS.success + '08',
  },
  statusIcon: { marginBottom: 12 },
  statusTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 3 },
  duration: { fontSize: 36, fontWeight: '900', color: COLORS.text, marginTop: 8 },
  shiftStart: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 4 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: COLORS.warning + '10',
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  offlineInfo: { flex: 1 },
  offlineTitle: { fontSize: 12, fontWeight: '800', color: COLORS.warning },
  offlineSubtitle: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  actionSection: { paddingHorizontal: 16, marginTop: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 18,
    gap: 10,
  },
  startButton: { backgroundColor: COLORS.primary },
  endButton: { backgroundColor: COLORS.danger },
  startButtonText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 2 },
  endButtonText: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  infoSection: { padding: 16, marginTop: 16, gap: 12 },
  infoTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 2 },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 11, fontWeight: '600', color: COLORS.textMuted, lineHeight: 16 },
});
