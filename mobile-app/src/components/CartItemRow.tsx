import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

type Props = {
  item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  };
  onAdd: () => void;
  onRemove: () => void;
};

export default function CartItemRow({ item, onAdd, onRemove }: Props) {
  return (
    <View style={styles.row}>
      {/* Item Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.price}>R {item.price.toFixed(2)} each</Text>
      </View>

      {/* Quantity Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.qtyButton} onPress={onRemove}>
          <Ionicons
            name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
            size={16}
            color={item.quantity <= 1 ? COLORS.danger : COLORS.textSecondary}
          />
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={onAdd}>
          <Ionicons name="add" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Line Total */}
      <Text style={styles.total}>R {(item.price * item.quantity).toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  price: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyButton: {
    padding: 10,
  },
  quantity: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    minWidth: 24,
    textAlign: 'center',
  },
  total: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    minWidth: 68,
    textAlign: 'right',
  },
});
