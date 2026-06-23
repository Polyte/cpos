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
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { getUserData, getTerminalId, clearAll, getOfflineQueue, clearOfflineQueue } from '../services/storage';
import { api } from '../services/api';
import { COLORS, APP_VERSION } from '../utils/constants';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [terminalId, setTerminalId] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const userData = await getUserData();
    setUser(userData);
    const tid = await getTerminalId();
    setTerminalId(tid);
    const queue = await getOfflineQueue();
    setOfflineCount(queue.length);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAll();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleSyncQueue = async () => {
    if (offlineCount === 0) {
      Toast.show({ type: 'info', text1: 'Queue Empty', text2: 'Nothing to sync' });
      return;
    }
    setSyncing(true);
    try {
      const queue = await getOfflineQueue();
      let synced = 0;
      for (const txn of queue) {
        try {
          const result = await api.processPayment({
            merchantId: txn.merchantId,
            items: txn.items.map((i: any) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            paymentMethod: txn.method,
            amountTendered: txn.method === 'Cash' ? txn.amount : undefined,
            cashierName: txn.cashierName,
            terminalId: txn.terminalId,
            idempotencyKey: txn.idempotencyKey,
          });
          if (result.success !== false) synced++;
        } catch {}
      }
      await clearOfflineQueue();
      setOfflineCount(0);
      Toast.show({ type: 'success', text1: 'Sync Complete', text2: `${synced}/${queue.length} transactions synced` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync Failed', text2: e?.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      {/* User Info */}
      <View style={styles.section}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Cashier'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>
        </View>
      </View>

      {/* Device Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEVICE</Text>
        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Terminal ID</Text>
            <Text style={styles.infoValue}>{terminalId}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="code-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>v{APP_VERSION}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="business-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Profile</Text>
            <Text style={styles.infoValue}>{user?.merchantProfile || 'Retail'}</Text>
          </View>
        </View>
      </View>

      {/* Sync */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATA SYNC</Text>
        <View style={styles.syncCard}>
          <View style={styles.syncInfo}>
            <Ionicons name="cloud-upload-outline" size={20} color={offlineCount > 0 ? COLORS.warning : COLORS.success} />
            <View>
              <Text style={styles.syncTitle}>
                {offlineCount > 0 ? `${offlineCount} pending` : 'All synced'}
              </Text>
              <Text style={styles.syncSubtitle}>Offline transaction queue</Text>
            </View>
          </View>
          {offlineCount > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSyncQueue}
              disabled={syncing}
            >
              <Ionicons name="sync" size={16} color="#000" />
              <Text style={styles.syncButtonText}>{syncing ? '...' : 'SYNC'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.danger + '15' }]}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          </View>
          <Text style={[styles.actionLabel, { color: COLORS.danger }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Clinton POS Mobile</Text>
        <Text style={styles.footerSub}>Handheld Terminal Application</Text>
        <Text style={styles.footerVersion}>v{APP_VERSION}</Text>
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
  section: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  userRole: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  userEmail: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  infoList: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  infoLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  infoValue: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  syncInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  syncSubtitle: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, marginTop: 1 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  syncButtonText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '800' },
  footer: { alignItems: 'center', padding: 24, gap: 2 },
  footerText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
  footerSub: { fontSize: 9, fontWeight: '600', color: COLORS.border },
  footerVersion: { fontSize: 9, fontWeight: '700', color: COLORS.border, marginTop: 4 },
});
