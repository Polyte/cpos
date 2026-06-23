import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../utils/constants';

export default function ReceiptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { transaction } = route.params;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Receipt #${transaction.id || transaction.receiptNo}\nTotal: R ${transaction.amount?.toFixed(2)}\nMethod: ${transaction.method}\nDate: ${new Date(transaction.time).toLocaleString()}`,
        title: 'Clinton POS Receipt',
      });
    } catch {}
  };

  const handleNewSale = () => {
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  return (
    <View style={styles.container}>
      {/* Success Banner */}
      <View style={styles.successBanner}>
        <View style={styles.checkIcon}>
          <Ionicons name="checkmark-circle" size={56} color="#fff" />
        </View>
        <Text style={styles.successTitle}>
          {transaction.offlineQueued ? 'QUEUED OFFLINE' : 'APPROVED'}
        </Text>
        <Text style={styles.refNumber}>
          {transaction.receiptNo || transaction.id}
        </Text>
      </View>

      {/* Receipt Card */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.receiptCard}>
          {/* Header */}
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptStore}>CLINTON POS</Text>
            <Text style={styles.receiptLabel}>RECEIPT</Text>
            <View style={styles.receiptDivider} />
            <Text style={styles.receiptDate}>
              {new Date(transaction.time).toLocaleString()}
            </Text>
          </View>

          {/* Items */}
          <View style={styles.itemsSection}>
            {(transaction.items || []).map((item: any, index: number) => (
              <View key={index} style={styles.receiptItem}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  R {(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.receiptDivider} />

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLineLabel}>TOTAL</Text>
              <Text style={styles.totalLineValue}>
                R {transaction.amount?.toFixed(2)}
              </Text>
            </View>
            {transaction.method === 'Cash' && transaction.change > 0 && (
              <View style={styles.totalLine}>
                <Text style={styles.totalLineLabel}>CHANGE</Text>
                <Text style={[styles.totalLineValue, { color: COLORS.success }]}>
                  R {transaction.change?.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.receiptDivider} />

          {/* Footer Info */}
          <View style={styles.receiptFooter}>
            <Text style={styles.footerInfo}>Ref: {transaction.id}</Text>
            <Text style={styles.footerInfo}>{transaction.method} Payment</Text>
            {transaction.offlineQueued && (
              <Text style={[styles.footerInfo, { color: COLORS.warning }]}>
                ** OFFLINE - PENDING SYNC **
              </Text>
            )}
          </View>

          <View style={styles.receiptDivider} />
          <Text style={styles.poweredBy}>Powered by Clinton POS v1.0</Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={COLORS.text} />
            <Text style={styles.shareText}>SHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.printButton} onPress={() => {}}>
            <Ionicons name="print-outline" size={18} color={COLORS.text} />
            <Text style={styles.printText}>PRINT</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.newSaleButton} onPress={handleNewSale}>
          <Ionicons name="add-circle-outline" size={20} color="#000" />
          <Text style={styles.newSaleText}>NEW TRANSACTION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  successBanner: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 24,
    backgroundColor: COLORS.success,
  },
  checkIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  refNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginTop: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  receiptCard: {
    backgroundColor: '#FFFFF8',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptStore: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 4,
  },
  receiptLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    marginTop: 2,
  },
  receiptDate: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  itemsSection: {
    gap: 6,
  },
  receiptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQty: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    width: 28,
  },
  itemName: {
    flex: 1,
    fontSize: 10,
    color: '#333',
  },
  itemPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  totalsSection: {
    gap: 4,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLineLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  totalLineValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  receiptFooter: {
    alignItems: 'center',
    gap: 2,
  },
  footerInfo: {
    fontSize: 9,
    color: '#888',
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 8,
    color: '#bbb',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: COLORS.background,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  shareText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  printText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  newSaleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  newSaleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
});
