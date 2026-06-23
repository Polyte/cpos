import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

type Props = {
  count: number;
  total: number;
  onPress: () => void;
};

export default function CartFAB({ count, total, onPress }: Props) {
  const vat = total * 0.15;
  const grandTotal = total + vat;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.left}>
          <View style={styles.iconWrapper}>
            <Ionicons name="cart" size={20} color="#000" />
          </View>
          <View>
            <Text style={styles.countLabel}>ITEMS</Text>
            <Text style={styles.count}>{count}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.totalAmount}>R {grandTotal.toFixed(2)}</Text>
          <Ionicons name="chevron-up" size={18} color="rgba(0,0,0,0.4)" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 2,
  },
  count: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
});
