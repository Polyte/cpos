import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

import { api } from '../services/api';
import { getUserData, setCachedProducts, getCachedProducts } from '../services/storage';
import { COLORS, MERCHANT_IDS } from '../utils/constants';
import ProductCard from '../components/ProductCard';
import CartFAB from '../components/CartFAB';
import { useCart } from '../hooks/useCart';

const CATEGORY_ICONS: Record<string, string> = {
  All: 'apps',
  Fuel: 'flame',
  Dairy: 'water',
  Mains: 'fast-food',
  Beverage: 'beer',
  Food: 'pizza',
  Workshop: 'construct',
  General: 'cube',
};

export default function POSScreen() {
  const navigation = useNavigation<any>();
  const { cart, addToCart, cartCount, cartTotal } = useCart();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [merchantId, setMerchantId] = useState('merchant:M1');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const user = await getUserData();
    if (user?.merchantProfile) {
      const mid = MERCHANT_IDS[user.merchantProfile] || 'merchant:M1';
      setMerchantId(mid);
      await loadProducts(mid);
    } else {
      await loadProducts(merchantId);
    }
  };

  const loadProducts = async (mid: string) => {
    try {
      setLoading(true);
      let data: any[] = [];

      // Try online first
      const online = await api.isOnline();
      setIsOnline(online);

      if (online) {
        data = await api.getStock(mid);
        if (Array.isArray(data) && data.length > 0) {
          await setCachedProducts(mid, data);
        }
      }

      // Fallback to cache
      if (!data || data.length === 0) {
        data = await getCachedProducts(mid);
        if (data.length > 0) {
          Toast.show({ type: 'info', text1: 'Offline Mode', text2: `${data.length} products from cache` });
        }
      }

      if (Array.isArray(data)) {
        setProducts(
          data.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.selling || item.price || 0,
            category: item.category || 'General',
            barcode: item.barcode || '',
            stock: item.quantity ?? item.stock ?? null,
          }))
        );
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load products' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts(merchantId);
  }, [merchantId]);

  const handleAddToCart = (item: any) => {
    addToCart(item);
    Vibration.vibrate(15);
    Toast.show({
      type: 'success',
      text1: item.name,
      text2: `Added to cart • R ${item.price.toFixed(2)}`,
      visibilityTime: 1500,
    });
  };

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot}>
            <View style={[styles.dot, { backgroundColor: isOnline ? COLORS.success : COLORS.danger }]} />
          </View>
          <View>
            <Text style={styles.headerTitle}>POINT OF SALE</Text>
            <Text style={styles.headerSubtitle}>
              {isOnline ? 'ONLINE' : 'OFFLINE'} • {products.length} items
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('BarcodeScanner')}
        >
          <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={COLORS.primary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products or scan barcode..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                activeCategory === item && styles.categoryPillActive,
              ]}
              onPress={() => setActiveCategory(item)}
            >
              <Ionicons
                name={(CATEGORY_ICONS[item] || 'cube') as any}
                size={14}
                color={activeCategory === item ? '#000' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.productRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading products...' : 'No products found'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            onPress={() => handleAddToCart(item)}
            cartQty={cart.find((c: any) => c.id === item.id)?.quantity || 0}
          />
        )}
      />

      {/* Cart FAB */}
      {cartCount > 0 && (
        <CartFAB
          count={cartCount}
          total={cartTotal}
          onPress={() => navigation.navigate('Cart')}
        />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 1,
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  categoryContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  categoryTextActive: {
    color: '#000',
  },
  productGrid: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  productRow: {
    gap: 10,
    marginBottom: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
});
