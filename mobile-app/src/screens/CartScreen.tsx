import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { COLORS } from '../utils/constants';
import { useCart } from '../hooks/useCart';
import CartItemRow from '../components/CartItemRow';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { cart, addToCart, removeFromCart, clearCart, cartCount, cartTotal } = useCart();

  const vat = cartTotal * 0.15;
  const grandTotal = cartTotal + vat;

  const handleClearCart = () => {
    clearCart();
    Vibration.vibrate(30);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          <Text style={styles.backText}>Products</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="cart" size={18} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{cartCount} Items</Text>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearCart}
          disabled={cart.length === 0}
        >
          <Ionicons name="trash-outline" size={18} color={cart.length > 0 ? COLORS.danger : COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Cart Items */}
      <FlatList
        data={cart}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add products from the POS screen</Text>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onAdd={() => { addToCart(item); Vibration.vibrate(10); }}
            onRemove={() => { removeFromCart(item.id); Vibration.vibrate(10); }}
          />
        )}
      />

      {/* Totals & Payment Actions */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>R {cartTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (15%)</Text>
              <Text style={styles.totalValue}>R {vat.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>R {grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.paymentButtons}>
            <TouchableOpacity
              style={[styles.payButton, styles.cardButton]}
              onPress={() =>
                navigation.navigate('Payment', { method: 'Card', total: grandTotal, cart })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={20} color={COLORS.info} />
              <Text style={styles.cardButtonText}>CARD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payButton, styles.cashButton]}
              onPress={() =>
                navigation.navigate('Payment', { method: 'Cash', total: grandTotal, cart })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="cash-outline" size={20} color="#000" />
              <Text style={styles.cashButtonText}>CASH</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 250,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
  },
  totals: {
    gap: 6,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  paymentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 8,
  },
  cardButton: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cashButton: {
    backgroundColor: COLORS.primary,
  },
  cardButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  cashButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
});
