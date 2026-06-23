# Clinton POS Mobile

> 📱 Android/Handheld application for cashiers, waiters, and floor staff — connects to the Clinton POS backend system.

## Overview

This is a React Native (Expo) mobile application designed for use on:
- **Handheld POS devices** (speedpoint machines)
- **Android tablets** used by waiters
- **Mobile phones** for on-the-go sales
- **Rugged handhelds** for stock operations

The app connects to the same Supabase backend as the web POS system, sharing the same products, transactions, users, and configuration.

---

## Features

### 🛒 Point of Sale (Cashier)
- Product grid with category filtering
- Barcode scanning via camera
- Cart management with quantity controls
- Cash payment with numpad and quick tenders
- Card payment processing (NFC/tap simulation)
- Change calculation
- Offline transaction queueing

### 🍽️ Waiter / Restaurant
- Table map with real-time status
- Order creation with menu browsing
- Send orders to kitchen (KOT)
- Guest count management
- Kitchen notes / special requests
- Table status updates

### ⏱️ Shift Management
- Start/end shifts
- Shift duration tracking
- Transaction count & totals per shift
- Shift reports

### 📷 Barcode Scanner
- Camera-based barcode scanning
- Supports EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39, QR
- Auto-add to cart on scan
- Visual/haptic feedback

### 📴 Offline Support
- Products cached locally for offline access
- Transactions queued when offline
- Auto-sync when connection returns
- Queue visible in Settings

### 🧾 Receipts
- Digital receipt display
- Share via device share sheet
- Print support (Bluetooth/USB thermal printers)

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile framework |
| Expo (SDK 51) | Build tooling & native APIs |
| TypeScript | Type-safe development |
| AsyncStorage | Local persistence & offline cache |
| Expo Camera | Barcode scanning |
| Expo Haptics | Tactile feedback |
| Expo Network | Connectivity detection |
| React Navigation | Screen routing |

---

## Project Structure

```
mobile-app/
├── App.tsx                    # Entry point & navigation setup
├── app.json                   # Expo configuration
├── eas.json                   # EAS Build configuration
├── package.json
├── tsconfig.json
├── babel.config.js
├── assets/                    # App icons & splash screen
└── src/
    ├── components/
    │   ├── CartFAB.tsx        # Floating cart button
    │   ├── CartItemRow.tsx    # Cart list item
    │   ├── NumPad.tsx         # Cash entry numpad
    │   └── ProductCard.tsx    # Product grid card
    ├── hooks/
    │   └── useCart.ts         # Global cart state management
    ├── screens/
    │   ├── LoginScreen.tsx    # Authentication
    │   ├── POSScreen.tsx      # Main sales interface
    │   ├── CartScreen.tsx     # Cart review & checkout
    │   ├── PaymentScreen.tsx  # Cash/card payment
    │   ├── ReceiptScreen.tsx  # Transaction receipt
    │   ├── WaiterScreen.tsx   # Table map (restaurant)
    │   ├── OrderScreen.tsx    # Order creation for tables
    │   ├── ShiftScreen.tsx    # Shift management
    │   ├── SettingsScreen.tsx # Device info & logout
    │   └── BarcodeScannerScreen.tsx  # Camera barcode scanner
    ├── services/
    │   ├── api.ts             # Backend API client
    │   └── storage.ts         # AsyncStorage helpers
    └── utils/
        └── constants.ts       # Config, colors, types
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Android device or emulator (Android Studio)

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure Backend URL

Edit `src/utils/constants.ts` and set your Supabase project details:

```typescript
export const PROJECT_ID = 'your-supabase-project-id';
export const ANON_KEY = 'your-supabase-anon-key';
```

### 3. Run in Development

```bash
# Start Expo dev server
npm start

# Or directly on Android
npm run android
```

### 4. Build APK for Handheld Devices

```bash
# Login to EAS
eas login

# Build APK (for direct install on speedpoint/handheld)
npm run build:apk

# Or build production AAB for Play Store
npm run build:android
```

---

## Deployment to Handheld Devices

### Speedpoint / POS Terminals

1. Build the APK: `npm run build:apk`
2. Download the APK from EAS build dashboard
3. Transfer APK to device via:
   - USB cable
   - MDM (Mobile Device Management)
   - QR code download link
4. Install APK on device (enable "Install from Unknown Sources")

### Recommended Devices
- Sunmi V2 / V2 Pro (built-in printer)
- PAX A920 / A910
- Ingenico APOS A8
- Verifone X990
- Any Android 8+ handheld with:
  - 5"+ touchscreen
  - Wi-Fi / 4G connectivity
  - Camera (for barcode scanning)

---

## API Connection

This mobile app connects to the **same backend** as the web Clinton POS system:

```
https://{PROJECT_ID}.supabase.co/functions/v1/make-server-69ad2d15
```

All endpoints are shared:
- `/login` - Authentication
- `/stock` - Products/inventory
- `/process-payment` - Transaction processing
- `/shifts/*` - Shift management
- `/tables/*` - Restaurant tables
- `/kot` - Kitchen order tickets
- `/settle-bill` - Bill settlement

---

## Offline Mode

When the device loses connectivity:

1. **Products** — Served from local cache (AsyncStorage)
2. **Transactions** — Queued locally with idempotency keys
3. **Auto-sync** — Queued transactions sent when connection returns
4. **Visual indicator** — Offline status shown in UI

Idempotency keys ensure no duplicate transactions during sync.

---

## Security

- Auth tokens stored securely
- Session-based authentication
- Terminal ID tracked per device
- Audit trail for all transactions
- Supervisor override for voids/cancellations

---

## Customization

### Changing Colors/Theme
Edit `src/utils/constants.ts` → `COLORS` object.

### Adding Merchant Profiles
Add new entries to `MERCHANT_IDS` in constants.

### Bluetooth Printer Support
For thermal receipt printing on handheld devices, integrate:
- `react-native-ble-plx` for Bluetooth
- ESC/POS commands for thermal printers

---

## License

Part of the Clinton Point of Sale System. Internal use only.
