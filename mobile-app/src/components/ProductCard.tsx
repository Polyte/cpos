import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Fuel: 'flame',
  Dairy: 'water',
  Mains: 'fast-food',
  Beverage: 'beer',
  Food: 'pizza',
  Workshop: 'construct',
  General: 'cube',
};

type Props = {
  item: {
    id: string;
    name: string;
    price: number;
    category?: string;
    stock?: number | null;
  };
  onPress: () => void;
  cartQty: number;
};

export default function ProductCard({ item, onPress, cartQty }: Props) {
  const icon = CATEGORY_ICONS[item.category || 'General'] || 'cube';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Cart Badge */}
      {cartQty > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cartQty}</Text>
        </View>
      )}

      {/* Low Stock Warning */}
      {item.stock !== null && item.stock !== undefined && item.stock <= 5 && item.stock > 0 && (
        <View style={styles.lowStock}>
          <Text style={styles.lowStockText}>LOW</Text>
        </View>
      )}

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={COLORS.textMuted} />
      </View>

      {/* Info */}
      <Text style={styles.category}>{item.category || 'General'}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.price}>R {item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  lowStock: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 7,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  name: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 4,
    minHeight: 28,
  },
  price: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },
});
