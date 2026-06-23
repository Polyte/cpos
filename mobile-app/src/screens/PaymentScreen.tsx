import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { api, generateUUID } from '../services/api';
import { getUserData, getTerminalId, getActiveShift, addToOfflineQueue } from '../services/storage';
import { useCart } from '../hooks/useCart';
import { COLORS, MERCHANT_IDS } from '../utils/constants';
import NumPad from '../components/NumPad';

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { method, total, cart: cartItems } = route.params;
  const { clearCart } = useCart();

  const [amountEntered, setAmountEntered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [cardPhase, setCardPhase] = useState<'idle' | 'connecting' | 'authorizing' | 'approved'>('idle');

  const tendered = parseFloat(amountEntered) || 0;
  const changeDue = tendered - total;
  const isSufficient = tendered >= total && amountEntered !== '';

  const quickTenders = [
    { label: 'Exact', value: Math.ceil(total * 100) / 100 },
    ...([10, 20, 50, 100, 200, 500]
      .map((d) => ({ label: `R${Math.ceil(total / d) * d}`, value: Math.ceil(total / d) * d }))
      .filter((qt) => qt.value > total)
      .slice(0, 3)),
  ];

  useEffect(() => {
    if (method === 'Card') {
      processCardPayment();
    }
  }, []);

  const processCardPayment = async () => {
    setProcessing(true);
    setCardPhase('connecting');
    await delay(1200);
    setCardPhase('authorizing');
    await delay(1500);
    await submitPayment('Card');
  };

  const processCashPayment = async () => {
    if (!isSufficient) return;
    setProcessing(true);
    await submitPayment('Cash');
  };

  const submitPayment = async (payMethod: 'Cash' | 'Card') => {
    try {
      const user = await getUserData();
      const terminalId = await getTerminalId();
      const shift = await getActiveShift();
      const merchantId = MERCHANT_IDS[user?.merchantProfile || 'Retail'] || 'merchant:M1';
      const idempotencyKey = generateUUID();

      const isOnline = await api.isOnline();

      if (!isOnline) {
        // Queue offline
        const txn = {
          id: `TXN-OFF-${Date.now()}`,
          amount: total,
          method: payMethod,
          change: payMethod === 'Cash' ? Math.max(0, changeDue) : 0,
          items: cartItems,
          merchantId,
          cashierName: user?.name || 'System',
          terminalId,
          offlineQueued: true,
          idempotencyKey,
          time: new Date().toISOString(),
        };
        await addToOfflineQueue(txn);
        Vibration.vibrate([0, 100, 50, 100]);
        clearCart();
        navigation.navigate('Receipt', { transaction: txn });
        return;
      }

      const result = await api.processPayment({
        merchantId,
        items: cartItems.map((i: any) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        paymentMethod: payMethod,
        amountTendered: payMethod === 'Cash' ? tendered : undefined,
        cashierName: user?.name || 'System',
        terminalId,
        shiftId: shift?.id || undefined,
        idempotencyKey,
      });

      if (!result.success) {
        setCardPhase('idle');
        Toast.show({
          type: 'error',
          text1: 'Payment Declined',
          text2: result.error || 'Transaction was not approved',
        });
        setProcessing(false);
        return;
      }

      setCardPhase('approved');
      Vibration.vibrate([0, 80, 50, 80, 50, 80]);
      clearCart();

      const txn = {
        ...(result.transaction || {}),
        amount: total,
        method: payMethod,
        change: payMethod === 'Cash' ? Math.max(0, changeDue) : 0,
        items: cartItems,
        time: new Date().toISOString(),
        offlineQueued: false,
      };

      await delay(500);
      navigation.navigate('Receipt', { transaction: txn });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Payment failed' });
      setProcessing(false);
    }
  };

  const handleNumPadPress = (key: string) => {
    Vibration.vibrate(10);
    if (key === 'CLR') {
      setAmountEntered('');
    } else if (key === 'DEL') {
      setAmountEntered((prev) => prev.slice(0, -1));
    } else if (key === '.') {
      if (!amountEntered.includes('.')) {
        setAmountEntered((prev) => (prev || '0') + '.');
      }
    } else {
      const parts = amountEntered.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      setAmountEntered((prev) => prev + key);
    }
  };

  // Card Payment View
  if (method === 'Card') {
    return (
      <View style={styles.container}>
        <View style={styles.cardView}>
          {processing ? (
            <>
              {cardPhase === 'approved' ? (
                <View style={styles.approvedContainer}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={48} color="#fff" />
                  </View>
                  <Text style={styles.approvedText}>APPROVED</Text>
                  <Text style={styles.approvedAmount}>R {total.toFixed(2)}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.nfcIcon}>
                    <Ionicons name="radio-outline" size={64} color={COLORS.info} />
                  </View>
                  <Text style={styles.cardPhaseText}>
                    {cardPhase === 'connecting' ? 'Connecting to terminal...' : 'Authorizing payment...'}
                  </Text>
                  <Text style={styles.cardAmount}>R {total.toFixed(2)}</Text>
                  <ActivityIndicator color={COLORS.info} size="large" style={{ marginTop: 24 }} />
                  <Text style={styles.cardHint}>Present card, phone or watch</Text>
                </>
              )}
            </>
          ) : (
            <>
              <Ionicons name="close-circle" size={64} color={COLORS.danger} />
              <Text style={styles.declinedText}>Payment Failed</Text>
              <TouchableOpacity style={styles.retryButton} onPress={processCardPayment}>
                <Ionicons name="refresh" size={18} color="#000" />
                <Text style={styles.retryText}>RETRY</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // Cash Payment View
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.cashHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.cashTitle}>CASH ENTRY</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Total Due */}
      <View style={styles.totalDueBox}>
        <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
        <Text style={styles.totalDueAmount}>R {total.toFixed(2)}</Text>
      </View>

      {/* Quick Tenders */}
      <View style={styles.quickTenders}>
        {quickTenders.map((qt) => (
          <TouchableOpacity
            key={qt.label}
            style={[
              styles.quickTenderPill,
              amountEntered === qt.value.toFixed(2) && styles.quickTenderActive,
            ]}
            onPress={() => {
              setAmountEntered(qt.value.toFixed(2));
              Vibration.vibrate(15);
            }}
          >
            <Text
              style={[
                styles.quickTenderText,
                amountEntered === qt.value.toFixed(2) && styles.quickTenderTextActive,
              ]}
            >
              {qt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount Display */}
      <View style={styles.amountDisplay}>
        <Text style={styles.amountLabel}>AMOUNT TENDERED</Text>
        <Text
          style={[
            styles.amountValue,
            isSufficient && styles.amountSufficient,
            !isSufficient && amountEntered !== '' && styles.amountInsufficient,
          ]}
        >
          R {amountEntered || '0.00'}
        </Text>
        {isSufficient && (
          <Text style={styles.changeText}>Change: R {changeDue.toFixed(2)}</Text>
        )}
        {!isSufficient && amountEntered !== '' && (
          <Text style={styles.shortText}>Short: R {Math.abs(changeDue).toFixed(2)}</Text>
        )}
      </View>

      {/* NumPad */}
      <NumPad onPress={handleNumPadPress} />

      {/* Actions */}
      <View style={styles.cashActions}>
        <TouchableOpacity style={styles.clearBtn} onPress={() => handleNumPadPress('CLR')}>
          <Text style={styles.clearBtnText}>CLEAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptBtn, !isSufficient && styles.acceptBtnDisabled]}
          onPress={processCashPayment}
          disabled={!isSufficient || processing}
        >
          {processing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="cash-outline" size={18} color="#000" />
              <Text style={styles.acceptBtnText}>ACCEPT CASH</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Card styles
  cardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  nfcIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.info}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardPhaseText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.text,
  },
  cardHint: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 24,
    letterSpacing: 1,
  },
  approvedContainer: {
    alignItems: 'center',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  approvedText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.success,
    letterSpacing: 4,
    marginBottom: 8,
  },
  approvedAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  declinedText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.danger,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  cancelLink: {
    marginTop: 16,
    padding: 12,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  // Cash styles
  cashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  cashTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  totalDueBox: {
    backgroundColor: COLORS.surfaceLight,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalDueLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  totalDueAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  quickTenders: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
  quickTenderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  quickTenderActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  quickTenderText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  quickTenderTextActive: {
    color: '#000',
  },
  amountDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  amountLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.textMuted,
  },
  amountSufficient: {
    color: COLORS.success,
  },
  amountInsufficient: {
    color: COLORS.text,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.success,
    marginTop: 4,
  },
  shortText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.danger,
    marginTop: 4,
  },
  cashActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: 8,
  },
  clearBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  acceptBtn: {
    flex: 2,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.4,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
});
