// API Configuration - Same backend as the web POS system
export const PROJECT_ID = 'ujgeqvqkvxuhrciketvo';
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZ2VxdnFrdnh1aHJjaWtldHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNTcwNDMsImV4cCI6MjA2OTYzMzA0M30.zgEyAVwkN_4m7p0224Nva40p3As-O-KtWh-madOcir0';
export const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-69ad2d15`;

// App Constants
export const APP_VERSION = '1.0.0';
export const DEVICE_TYPE = 'Handheld';
export const OFFLINE_QUEUE_KEY = 'clintpos_offline_queue';
export const AUTH_TOKEN_KEY = 'clintpos_auth_token';
export const USER_DATA_KEY = 'clintpos_user_data';
export const CACHED_PRODUCTS_KEY = 'clintpos_cached_products';
export const SHIFT_KEY = 'clintpos_active_shift';
export const TERMINAL_ID_KEY = 'clintpos_terminal_id';

// Theme Colors
export const COLORS = {
  primary: '#F59E0B',       // Amber-500
  primaryDark: '#D97706',   // Amber-600
  success: '#10B981',       // Emerald-500
  danger: '#EF4444',        // Red-500
  warning: '#F59E0B',       // Amber-500
  info: '#6366F1',          // Indigo-500
  background: '#0A0A0A',   // Near black
  surface: '#171717',       // Neutral-900
  surfaceLight: '#262626',  // Neutral-800
  border: '#404040',        // Neutral-700
  text: '#FFFFFF',
  textSecondary: '#A3A3A3', // Neutral-400
  textMuted: '#737373',     // Neutral-500
  card: '#1C1C1E',
};

// Merchant IDs (same as web system)
export const MERCHANT_IDS: Record<string, string> = {
  Retail: 'merchant:M1',
  Forecourt: 'merchant:M2',
  Workshop: 'merchant:M3',
  Restaurant: 'merchant:M4',
};

export type UserRole = 'Admin' | 'Manager' | 'Supervisor' | 'Cashier' | 'StockController';
export type MerchantProfile = 'Retail' | 'Forecourt' | 'Restaurant' | 'Workshop';
