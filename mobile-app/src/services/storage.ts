import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY,
  USER_DATA_KEY,
  CACHED_PRODUCTS_KEY,
  SHIFT_KEY,
  TERMINAL_ID_KEY,
  OFFLINE_QUEUE_KEY,
} from '../utils/constants';

// Auth Token
export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
};

export const setToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
};

// User Data
export const getUserData = async (): Promise<any | null> => {
  const data = await AsyncStorage.getItem(USER_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

export const setUserData = async (user: any): Promise<void> => {
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
};

export const removeUserData = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_DATA_KEY);
};

// Cached Products (for offline mode)
export const getCachedProducts = async (merchantId: string): Promise<any[]> => {
  const data = await AsyncStorage.getItem(`${CACHED_PRODUCTS_KEY}_${merchantId}`);
  return data ? JSON.parse(data) : [];
};

export const setCachedProducts = async (merchantId: string, products: any[]): Promise<void> => {
  await AsyncStorage.setItem(`${CACHED_PRODUCTS_KEY}_${merchantId}`, JSON.stringify(products));
};

// Active Shift
export const getActiveShift = async (): Promise<any | null> => {
  const data = await AsyncStorage.getItem(SHIFT_KEY);
  return data ? JSON.parse(data) : null;
};

export const setActiveShift = async (shift: any): Promise<void> => {
  await AsyncStorage.setItem(SHIFT_KEY, JSON.stringify(shift));
};

export const removeActiveShift = async (): Promise<void> => {
  await AsyncStorage.removeItem(SHIFT_KEY);
};

// Terminal ID
export const getTerminalId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(TERMINAL_ID_KEY);
  if (!id) {
    id = `HPOS-${Math.floor(1000 + Math.random() * 9000)}`;
    await AsyncStorage.setItem(TERMINAL_ID_KEY, id);
  }
  return id;
};

// Offline Queue
export const getOfflineQueue = async (): Promise<any[]> => {
  const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

export const addToOfflineQueue = async (transaction: any): Promise<void> => {
  const queue = await getOfflineQueue();
  queue.push({ ...transaction, queuedAt: new Date().toISOString() });
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

export const removeFromOfflineQueue = async (id: string): Promise<void> => {
  const queue = await getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
};

export const clearOfflineQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
};

// Clear all storage (logout)
export const clearAll = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    USER_DATA_KEY,
    SHIFT_KEY,
  ]);
};
