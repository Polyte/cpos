import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { api } from '../services/api';
import { getUserData } from '../services/storage';
import { COLORS, MERCHANT_IDS } from '../utils/constants';

type Table = {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved' | 'dirty';
  seats: number;
  guestCount?: number;
  serverName?: string;
  orderId?: string;
};

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  available: { color: COLORS.success, icon: 'checkmark-circle', label: 'Available' },
  occupied: { color: COLORS.primary, icon: 'people', label: 'Occupied' },
  reserved: { color: COLORS.info, icon: 'bookmark', label: 'Reserved' },
  dirty: { color: COLORS.danger, icon: 'warning', label: 'Needs Cleaning' },
};

export default function WaiterScreen() {
  const navigation = useNavigation<any>();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [merchantId, setMerchantId] = useState('merchant:M4');

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const user = await getUserData();
      const mid = MERCHANT_IDS[user?.merchantProfile || 'Restaurant'] || 'merchant:M4';
      setMerchantId(mid);
      const data = await api.getTables(mid);
      if (Array.isArray(data)) {
        setTables(data);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load tables' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTables();
  }, []);

  const handleTablePress = (table: Table) => {
    if (table.status === 'available') {
      // Seat guests and take order
      navigation.navigate('Order', { table });
    } else if (table.status === 'occupied') {
      // View/modify existing order
      navigation.navigate('Order', { table });
    } else {
      Toast.show({
        type: 'info',
        text1: table.name,
        text2: `Status: ${STATUS_CONFIG[table.status]?.label || table.status}`,
      });
    }
  };

  const filteredTables = tables.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    total: tables.length,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TABLE MAP</Text>
          <Text style={styles.headerSubtitle}>
            {stats.available} available • {stats.occupied} occupied
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All', count: tables.length },
          { key: 'available', label: 'Free', count: stats.available },
          { key: 'occupied', label: 'Busy', count: stats.occupied },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
            <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
              <Text style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                {f.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tables Grid */}
      <FlatList
        data={filteredTables}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading tables...' : 'No tables configured'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.available;
          return (
            <TouchableOpacity
              style={[styles.tableCard, { borderColor: config.color + '40' }]}
              onPress={() => handleTablePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusIndicator, { backgroundColor: config.color }]} />
              <View style={styles.tableIcon}>
                <Ionicons name={config.icon as any} size={24} color={config.color} />
              </View>
              <Text style={styles.tableName}>{item.name}</Text>
              <Text style={styles.tableStatus}>{config.label}</Text>
              <View style={styles.tableInfo}>
                <Ionicons name="people-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.tableSeats}>
                  {item.guestCount || 0}/{item.seats}
                </Text>
              </View>
              {item.serverName && (
                <Text style={styles.serverName}>{item.serverName}</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  filterTextActive: {
    color: '#000',
  },
  filterBadge: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  filterCount: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.textMuted,
  },
  filterCountActive: {
    color: '#000',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  tableCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tableIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableName: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
  },
  tableStatus: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  tableSeats: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  serverName: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
