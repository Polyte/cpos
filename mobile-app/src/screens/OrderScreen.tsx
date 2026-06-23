import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { api } from '../services/api';
import { getUserData } from '../services/storage';
import { COLORS, MERCHANT_IDS } from '../utils/constants';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  category?: string;
};

export default function OrderScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const table = route.params?.table;

  const [products, setProducts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [guestCount, setGuestCount] = useState(table?.guestCount || 2);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu');

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    const user = await getUserData();
    const mid = MERCHANT_IDS[user?.merchantProfile || 'Restaurant'] || 'merchant:M4';
    const data = await api.getStock(mid);
    if (Array.isArray(data)) {
      setProducts(
        data
          .filter((item: any) => item.category === 'Food' || item.category === 'Beverage' || item.category === 'Mains')
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.selling || item.price || 0,
            category: item.category || 'General',
          }))
      );
    }
  };

  const addItem = (product: any) => {
    Vibration.vibrate(10);
    const existing = orderItems.find((i) => i.id === product.id);
    if (existing) {
      setOrderItems(
        orderItems.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setOrderItems([...orderItems, { ...product, quantity: 1 }]);
    }
  };

  const removeItem = (id: string) => {
    const item = orderItems.find((i) => i.id === id);
    if (!item) return;
    if (item.quantity <= 1) {
      setOrderItems(orderItems.filter((i) => i.id !== id));
    } else {
      setOrderItems(
        orderItems.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
      );
    }
  };

  const sendToKitchen = async () => {
    if (orderItems.length === 0) {
      Toast.show({ type: 'error', text1: 'Empty Order', text2: 'Add items to the order first' });
      return;
    }

    setSending(true);
    try {
      const user = await getUserData();
      const mid = MERCHANT_IDS[user?.merchantProfile || 'Restaurant'] || 'merchant:M4';

      const result = await api.createKOT({
        merchantId: mid,
        tableId: table?.id,
        tableName: table?.name || 'Takeaway',
        items: orderItems.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          notes: i.notes || '',
        })),
        orderType: table ? 'dine-in' : 'takeaway',
        serverName: user?.name || 'Waiter',
        notes,
        guestCount,
      });

      if (result.success !== false) {
        // Update table status
        if (table) {
          await api.updateTableStatus(mid, table.id, {
            status: 'occupied',
            guestCount,
            serverName: user?.name,
          });
        }

        Vibration.vibrate([0, 80, 50, 80]);
        Toast.show({
          type: 'success',
          text1: 'Order Sent to Kitchen! 🍳',
          text2: `${orderItems.length} items • ${table?.name || 'Takeaway'}`,
        });
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: result.error || 'Could not send order' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Failed to send order' });
    } finally {
      setSending(false);
    }
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const orderCount = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  const filteredProducts = products.filter(
    (p) =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {table ? table.name : 'TAKEAWAY ORDER'}
          </Text>
          {table && (
            <Text style={styles.headerSubtitle}>
              Guests: {guestCount} • {table.seats} seats
            </Text>
          )}
        </View>
        <View style={styles.guestControl}>
          <TouchableOpacity
            onPress={() => setGuestCount(Math.max(1, guestCount - 1))}
            style={styles.guestBtn}
          >
            <Ionicons name="remove" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <TouchableOpacity
            onPress={() => setGuestCount(guestCount + 1)}
            style={styles.guestBtn}
          >
            <Ionicons name="add" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'menu' && styles.tabActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Ionicons name="restaurant" size={16} color={activeTab === 'menu' ? '#000' : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>
            Menu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'order' && styles.tabActive]}
          onPress={() => setActiveTab('order')}
        >
          <Ionicons name="receipt" size={16} color={activeTab === 'order' ? '#000' : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'order' && styles.tabTextActive]}>
            Order ({orderCount})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'menu' ? (
        <>
          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Menu Items */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.menuList}
            renderItem={({ item }) => {
              const inOrder = orderItems.find((o) => o.id === item.id);
              return (
                <TouchableOpacity style={styles.menuItem} onPress={() => addItem(item)}>
                  <View style={styles.menuItemLeft}>
                    <Text style={styles.menuItemName}>{item.name}</Text>
                    <Text style={styles.menuItemCategory}>{item.category}</Text>
                  </View>
                  <Text style={styles.menuItemPrice}>R {item.price.toFixed(2)}</Text>
                  {inOrder && (
                    <View style={styles.menuItemBadge}>
                      <Text style={styles.menuItemBadgeText}>{inOrder.quantity}</Text>
                    </View>
                  )}
                  <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                </TouchableOpacity>
              );
            }}
          />
        </>
      ) : (
        <>
          {/* Order Items */}
          <FlatList
            data={orderItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.orderList}
            ListEmptyComponent={
              <View style={styles.emptyOrder}>
                <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyOrderText}>No items in order</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.orderItem}>
                <View style={styles.orderItemLeft}>
                  <Text style={styles.orderItemName}>{item.name}</Text>
                  <Text style={styles.orderItemPrice}>
                    R {item.price.toFixed(2)} × {item.quantity}
                  </Text>
                </View>
                <Text style={styles.orderItemTotal}>
                  R {(item.price * item.quantity).toFixed(2)}
                </Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => addItem(item)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={16} color={COLORS.success} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListFooterComponent={
              orderItems.length > 0 ? (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Kitchen Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Special requests, allergies, etc..."
                    placeholderTextColor={COLORS.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>
              ) : null
            }
          />
        </>
      )}

      {/* Send to Kitchen Button */}
      {orderItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerCount}>{orderCount} items</Text>
            <Text style={styles.footerTotal}>R {orderTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.sendButton, sending && { opacity: 0.6 }]}
            onPress={sendToKitchen}
            disabled={sending}
          >
            <Ionicons name="flame" size={18} color="#000" />
            <Text style={styles.sendButtonText}>
              {sending ? 'SENDING...' : 'SEND TO KITCHEN'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  headerSubtitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 1 },
  guestControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  guestBtn: { padding: 8 },
  guestCount: { fontSize: 14, fontWeight: '900', color: COLORS.text, minWidth: 20, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    margin: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  tabText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  tabTextActive: { color: '#000' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  menuList: { paddingHorizontal: 12, paddingBottom: 120 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  menuItemLeft: { flex: 1 },
  menuItemName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  menuItemCategory: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginTop: 2 },
  menuItemPrice: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  menuItemBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
  orderList: { paddingHorizontal: 12, paddingBottom: 140 },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  orderItemLeft: { flex: 1 },
  orderItemName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  orderItemPrice: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  orderItemTotal: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: { padding: 8 },
  qtyText: { fontSize: 13, fontWeight: '900', color: COLORS.text, minWidth: 20, textAlign: 'center' },
  emptyOrder: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyOrderText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  notesSection: { marginTop: 12, padding: 12 },
  notesLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 6 },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    padding: 16,
    paddingBottom: 34,
    gap: 12,
  },
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerCount: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  footerTotal: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  sendButtonText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 2 },
});
