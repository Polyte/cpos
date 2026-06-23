import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import Toast from 'react-native-toast-message';

import { COLORS } from '../utils/constants';
import { useCart } from '../hooks/useCart';
import { api } from '../services/api';
import { getUserData, getCachedProducts } from '../services/storage';
import { MERCHANT_IDS } from '../utils/constants';

export default function BarcodeScannerScreen() {
  const navigation = useNavigation<any>();
  const { addToCart } = useCart();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    requestPermission();
    loadProducts();
  }, []);

  const requestPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadProducts = async () => {
    const user = await getUserData();
    const mid = MERCHANT_IDS[user?.merchantProfile || 'Retail'] || 'merchant:M1';
    // Try cached first for speed
    let data = await getCachedProducts(mid);
    if (!data || data.length === 0) {
      data = await api.getStock(mid);
    }
    if (Array.isArray(data)) {
      setProducts(data);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLastScanned(data);

    const product = products.find(
      (p: any) => p.barcode === data || p.id === data
    );

    if (product) {
      Vibration.vibrate([0, 50, 30, 50]);
      addToCart({
        id: product.id,
        name: product.name,
        price: product.selling || product.price || 0,
        category: product.category || 'General',
        barcode: product.barcode,
      });
      Toast.show({
        type: 'success',
        text1: `✓ ${product.name}`,
        text2: `R ${(product.selling || product.price || 0).toFixed(2)} added to cart`,
        visibilityTime: 2000,
      });
    } else {
      Vibration.vibrate(200);
      Toast.show({
        type: 'error',
        text1: 'Unknown Barcode',
        text2: `Code: ${data}`,
        visibilityTime: 3000,
      });
    }

    // Allow re-scanning after 1.5s
    setTimeout(() => setScanned(false), 1500);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionDenied}>
          <Ionicons name="camera-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionSubtitle}>
            Grant camera access to scan barcodes
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>GRANT PERMISSION</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeLink} onPress={() => navigation.goBack()}>
            <Text style={styles.closeLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scanTitle}>SCAN BARCODE</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanned && (
              <View style={styles.scannedOverlay}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              </View>
            )}
          </View>

          {/* Bottom Info */}
          <View style={styles.bottomBar}>
            <Text style={styles.scanHint}>
              Point camera at barcode on product
            </Text>
            {lastScanned && (
              <View style={styles.lastScannedBadge}>
                <Ionicons name="barcode-outline" size={14} color={COLORS.primary} />
                <Text style={styles.lastScannedText}>{lastScanned}</Text>
              </View>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 3,
  },
  scanFrame: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 60,
    gap: 12,
  },
  scanHint: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  lastScannedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  lastScannedText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  permissionText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 100,
  },
  permissionDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  permissionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  grantButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  grantButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  closeLink: { marginTop: 12, padding: 8 },
  closeLinkText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
});
