<script lang="ts">
  import {
    RefreshCw, Search, Trash2, Minus, Plus, CreditCard, Banknote, Wifi, Globe, ShieldAlert,
    History as HistoryIcon, LayoutGrid, Settings2, ChevronRight, Upload, UserCheck, Fingerprint,
    Barcode as ScanIcon, ShoppingCart, RotateCcw, AlertTriangle, Lock, Printer, X, Tag,
    Sun, Moon,
    Monitor, Smartphone, Server, Delete, CheckCircle2, Table as TableIcon, Fuel, Wrench,
    Smartphone as Phone, CreditCard as PaymentIcon, WifiOff, Radio, Network, Package, CheckSquare,
    Layout, Cpu, ArrowRightLeft, Activity, Zap, Loader2, Heart, User, Phone as PhoneIcon,
    Shield, Hash, CloudOff, CloudUpload, Eye, ReceiptText, LogOut
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
import type { UserRole, MerchantProfile } from '../types';
import { api } from '../api';
import { calculatePromotions } from '../PromotionEngine';
import type { PromotionResult } from '../PromotionEngine';
import { syncManager } from '../SyncManager';
import type { SyncState } from '../SyncManager';
import { queueTransaction, queueAuditEvent, cacheProducts, getCachedProducts } from '../LocalDB';
import { publishDisplayState } from '../customerDisplay';
import NetworkSwarm from './NetworkSwarm.svelte';
import ShiftReport from './ShiftReport.svelte';
import CloseDayWizard from './CloseDayWizard.svelte';
import SupervisorOverrideModal from './SupervisorOverrideModal.svelte';
import { printService } from '../PrintService';

  let { profile, role, userName, shiftId: externalShiftId, darkMode: isDarkMode, setDarkMode, onLockTerminal, onLogout } = $props();

  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    category?: string;
    barcode?: string;
  }

  interface Session {
    id: number;
    cart: CartItem[];
    customer?: any | null;
  }

  // --- Main State ---
  let zenMode = $state(false);
  let cartPanelOpen = $state(true);
  let sessions: Session[] = $state([
    { id: 1, cart: [] }, { id: 2, cart: [] }, { id: 3, cart: [] }, { id: 4, cart: [] },
  ]);
  let activeSessionId = $state(1);
  let searchQuery = $state('');
  let products: any[] = $state([]);
  let loading = $state(false);
  let terminal = $state<any>(null);
  let paymentStep: 'checkout' | 'card-waiting' | 'card-processing' | 'cash-processing' | 'completion' | 'declined' = $state('checkout');
  let transactionSuccess = $state<any>(null);
  let showReceipt = $state(false);
  let paymentError = $state<string | null>(null);
  let cardPhase: 'idle' | 'connecting' | 'authorizing' | 'approved' | 'declined' = $state('idle');
  let showLoyaltyModal = $state(false);
  let loyaltySearch = $state('');
  let loyaltyLoading = $state(false);
  let redeemPoints = $state(0);
  let isOnline = $state(navigator.onLine);
  let syncState: SyncState = $state({ status: 'idle', pendingCount: 0, lastSyncAt: null, lastError: null });
  let amountReceived = $state('');
  let showKeypad = $state(false);
  let overrideRequest: { action: 'void_item' | 'clear_cart'; targetItemId?: string } | null = $state(null);
  let showNetworkSwarm = $state(false);
  let showShiftReport = $state(false);
  let activeShiftId: string | null = $state(null);
  let heartbeatActive = $state(false);
  let lastHeartbeat: Date | null = $state(null);
  let processingPayment = $state(false);
  let paymentIdempotencyKey: string | null = $state(null);
  let paymentRetryCount = $state(0);
  let MAX_MANUAL_RETRIES = 3;
  let showRefundModal = $state(false);
  let drawerOpen = $state(false);
  let showDrawerModal = $state(false);
  let drawerFloat = $state('');
  let drawerCloseAmount = $state('');
  let showHotkeyOverlay = $state(false);
  let showCloseDayWizard = $state(false);
  let terminalLockedByCloseDay = $state(false);
  let receiptConfig = $state<any>(null);
  let showSupervisorModal = $state(false);
  let supervisorAction: {
    type: 'cash_drawer_open' | 'cash_drawer_close' | 'refund';
    description: string;
    callback: (supervisorId: string, supervisorName: string) => void | Promise<void>;
  } | null = $state(null);

  // --- Supervisor Override Modal State ---
  let supervisorPin = $state('');
  let supervisorMode: 'choose' | 'pin' | 'biometric' = $state('choose');
  let bioProgress = $state(0);
  let bioPhase: 'idle' | 'scanning' | 'verified' = $state('idle');
  let bioInterval: ReturnType<typeof setInterval> | null = null;
  let bioTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- Refund Modal State ---
  let refundSelectedTxn = $state<any>(null);
  let refundReason = $state('Customer return');
  let refundProcessing = $state(false);
  let recentTxns: any[] = $state([]);
  let refundLoading = $state(true);

  // --- Refs (non-reactive) ---
  let scanBuffer = '';
  let scanTimeout: ReturnType<typeof setTimeout> | null = null;
  let addToCartFn: (item: any) => void = () => {};
  let searchInput = $state<HTMLInputElement | null>(null);
  let receiptRef = $state<HTMLDivElement | null>(null);

  // --- Derived ---
  let activeSession = $derived(sessions.find(s => s.id === activeSessionId)!);
  let merchantId = $derived(profile === 'Forecourt' ? 'merchant:M2' : profile === 'Workshop' ? 'merchant:M3' : profile === 'Restaurant' ? 'merchant:M4' : 'merchant:M1');
  let promoResult: PromotionResult = $derived(calculatePromotions(activeSession.cart));
  let cartTotal = $derived(activeSession.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0));
  let promoDiscount = $derived(promoResult.totalDiscount);
  let adjustedSubtotal = $derived(cartTotal - promoDiscount);
  let pointsDiscount = $derived(redeemPoints * 0.1);
  let vat = $derived(Math.max(0, (adjustedSubtotal - pointsDiscount)) * 0.15);
  let derivedGrandTotal = $derived(Math.max(0, adjustedSubtotal - pointsDiscount + vat));
  let filteredProducts = $derived(products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  ));

  // --- Customer display sync ---
  // Mirror the active cart to the customer-facing display (#/display).
  $effect(() => {
    publishDisplayState({
      items: activeSession.cart.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        lineTotal: i.price * i.quantity,
      })),
      subtotal: cartTotal,
      promoDiscount,
      pointsDiscount,
      vat,
      grandTotal: derivedGrandTotal,
      customerName: activeSession.customer?.name || null,
      terminalId: terminal?.id || null,
      status: paymentStep === 'completion' ? 'paid' : (activeSession.cart.length > 0 ? 'active' : 'idle'),
      updatedAt: Date.now(),
    });
  });

  // --- Keypad derived ---
  let tendered = $derived(parseFloat(amountReceived) || 0);
  let changeDue = $derived(tendered - derivedGrandTotal);
  let isSufficient = $derived(tendered >= derivedGrandTotal && amountReceived !== '');
  let isShort = $derived(tendered < derivedGrandTotal && amountReceived !== '');
  let quickTenders = $derived.by(() => {
    const qts: { label: string; value: number }[] = [
      { label: 'Exact', value: Math.ceil(derivedGrandTotal * 100) / 100 }
    ];
    [10, 20, 50, 100, 200, 500].forEach(d => {
      const rounded = Math.ceil(derivedGrandTotal / d) * d;
      if (rounded > derivedGrandTotal && !qts.find(q => q.value === rounded)) {
        qts.push({ label: `R${rounded}`, value: rounded });
      }
    });
    return qts.slice(0, 5);
  });

  // --- Stable IP ---
  function getStableIp(): string {
    const stored = localStorage.getItem(`roxton_terminal_ip_${merchantId}`);
    if (stored) return stored;
    const ip = '192.168.1.' + (Math.floor(Math.random() * 254) + 1);
    localStorage.setItem(`roxton_terminal_ip_${merchantId}`, ip);
    return ip;
  }

  // --- Customer Display window ---
  function openCustomerDisplay() {
    const url = `${location.origin}${location.pathname}#/display`;
    const win = window.open(url, 'clintpos-customer-display', 'width=1024,height=768');
    if (!win) {
      // Popup blocked â€” fall back to a new tab and inform the cashier.
      toast.error('Pop-up blocked', { description: 'Allow pop-ups, or opening Customer Display in a new tab.' });
      window.open(url, '_blank');
    } else {
      win.focus();
    }
  }

  // --- Toggle Dark Mode ---
  function toggleDarkMode() {
    if (setDarkMode) setDarkMode(!isDarkMode);
    else {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('clint_dark_mode', String(!isDarkMode));
    }
  }

  // --- Session Management ---
  function updateActiveSession(update: Partial<Session>) {
    sessions = sessions.map(s => s.id === activeSessionId ? { ...s, ...update } : s) as Session[];
  }

  function addToCart(item: any) {
    sessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      const existing = s.cart.find(i => i.id === item.id);
      const newCart = existing
        ? s.cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...s.cart, { ...item, quantity: 1 }];
      return { ...s, cart: newCart };
    }) as Session[];
  }

  function removeFromCart(id: string) {
    const item = activeSession.cart.find(i => i.id === id);
    if (!item) return;
    if (item.quantity === 1) {
      overrideRequest = { action: 'void_item', targetItemId: id };
      return;
    }
    sessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      return { ...s, cart: s.cart.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i) };
    }) as Session[];
  }

  function requestClearCart() {
    if (activeSession.cart.length === 0) return;
    overrideRequest = { action: 'clear_cart' };
  }

  function handleOverrideSubmit(method: 'biometric' | 'pin') {
    if (!overrideRequest) return;
    const voidedItem = overrideRequest.action === 'void_item' && overrideRequest.targetItemId
      ? activeSession.cart.find(i => i.id === overrideRequest.targetItemId)
      : null;

    if (overrideRequest.action === 'void_item' && overrideRequest.targetItemId) {
      sessions = sessions.map(s => {
        if (s.id !== activeSessionId) return s;
        return { ...s, cart: s.cart.filter(i => i.id !== overrideRequest.targetItemId) };
      }) as Session[];
      toast.success('Line item voided', { description: `Override authorized via ${method}` });
    } else if (overrideRequest.action === 'clear_cart') {
      updateActiveSession({ cart: [] });
      toast.success('Cart cleared', { description: `Override authorized via ${method}` });
    }

    const auditEvent = {
      id: `override:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      merchantId,
      userId: userName || 'unknown',
      action: overrideRequest.action === 'void_item' ? 'SUPERVISOR_OVERRIDE_VOID' : 'SUPERVISOR_OVERRIDE_CLEAR',
      category: 'OVERRIDE',
      details: {
        method,
        action: overrideRequest.action,
        voidedItem: voidedItem ? { id: voidedItem.id, name: voidedItem.name, price: voidedItem.price } : null,
        sessionId: activeSessionId,
        cashier: userName,
        terminalId: terminal?.id
      },
      timestamp: new Date().toISOString(),
      hash: btoa(`${merchantId}-${Date.now()}`).substring(0, 32)
    };

    queueAuditEvent(auditEvent).catch(() => {});
    api.saveAuditEvent(auditEvent).catch(() => {});
    overrideRequest = null;
  }

  function handleLoyaltySearch() {
    if (!loyaltySearch) return;
    (async () => {
      try {
        loyaltyLoading = true;
        const prof = await api.getLoyaltyProfile(loyaltySearch);
        updateActiveSession({ customer: prof });
        toast.success(`Loyalty Profile Found: ${prof.tier} Member`);
      } catch (e) {
        toast.error('Customer not found');
      } finally {
        loyaltyLoading = false;
      }
    })();
  }

  async function finalizeSale(method: 'Card' | 'Cash', retryKey?: string) {
    if (processingPayment) return;
    processingPayment = true;
    paymentError = null;

    const iKey = retryKey || paymentIdempotencyKey || crypto.randomUUID();
    if (!retryKey) {
      paymentIdempotencyKey = iKey;
      paymentRetryCount = 0;
    }

    try {
      if (method === 'Card') {
        paymentStep = 'card-processing';
        cardPhase = 'connecting';
        await new Promise(r => setTimeout(r, 1200));
        cardPhase = 'authorizing';
      } else {
        paymentStep = 'cash-processing';
      }

      if (!isOnline) {
        const txn = {
          id: `TXN-${Math.floor(Math.random() * 90000) + 10000}`,
          amount: derivedGrandTotal,
          method,
          time: new Date().toLocaleTimeString(),
          status: 'Queued',
          change: method === 'Cash' ? Math.max(0, parseFloat(amountReceived) - derivedGrandTotal) : 0,
          items: activeSession.cart,
          merchantId,
          pointsRedeemed: redeemPoints,
          promoDiscount,
          appliedPromotions: promoResult.applied,
          cashierName: userName || 'System',
          terminalId: terminal?.id,
          offlineQueued: true,
          idempotencyKey: iKey
        };
        await syncManager.queue(txn);
        toast('Transaction queued offline', { description: 'Will sync when connection restores' });
        transactionSuccess = txn;
        paymentStep = 'completion';
        updateActiveSession({ cart: [], customer: null });
        redeemPoints = 0;
        amountReceived = '';
        showKeypad = false;
        paymentIdempotencyKey = null;
        return;
      }

      const result = await api.processPayment({
        merchantId,
        items: activeSession.cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        paymentMethod: method,
        amountTendered: method === 'Cash' ? parseFloat(amountReceived) || 0 : undefined,
        cashierName: userName || 'System',
        terminalId: terminal?.id,
        shiftId: activeShiftId || undefined,
        customerId: activeSession.customer?.id || undefined,
        pointsToRedeem: redeemPoints > 0 ? redeemPoints : undefined,
        appliedPromotions: promoResult.applied,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        idempotencyKey: iKey
      });

      if (!result.success) {
        const errorMsg = result.details
          ? (Array.isArray(result.details) ? result.details.join('; ') : result.details)
          : result.error || 'Payment declined';
        paymentError = errorMsg;

        if (result._retriable && paymentRetryCount < MAX_MANUAL_RETRIES) {
          paymentIdempotencyKey = iKey;
        }

        if (method === 'Card') {
          cardPhase = 'declined';
          paymentStep = 'declined';
        } else {
          paymentStep = 'checkout';
          toast.error(errorMsg);
        }
        return;
      }

      if (method === 'Card') {
        cardPhase = 'approved';
        await new Promise(r => setTimeout(r, 800));
      }

      const txn = {
        ...result.transaction,
        time: new Date().toLocaleTimeString(),
        offlineQueued: false
      };

      transactionSuccess = txn;
      paymentStep = 'completion';
      updateActiveSession({ cart: [], customer: null });
      redeemPoints = 0;
      amountReceived = '';
      showKeypad = false;
      paymentIdempotencyKey = null;
      paymentRetryCount = 0;
      loadProducts();
      toast.success(`Sale approved â€” ${txn.receiptNo || txn.id}`);
    } catch (e: any) {
      paymentError = e?.message || 'Transaction failed';
      paymentIdempotencyKey = iKey;
      if (method === 'Card') {
        cardPhase = 'declined';
        paymentStep = 'declined';
      } else {
        paymentStep = 'checkout';
        toast.error('Transaction failed â€” please retry');
      }
    } finally {
      processingPayment = false;
    }
  }

  function retryPayment(method: 'Card' | 'Cash') {
    if (!paymentIdempotencyKey || paymentRetryCount >= MAX_MANUAL_RETRIES) return;
    paymentRetryCount += 1;
    toast.info(`Retrying payment (attempt ${paymentRetryCount + 2})...`, { description: 'Same idempotency key ensures no double-charge' });
    finalizeSale(method, paymentIdempotencyKey);
  }

  // --- Init & Effects ---
  async function loadProducts() {
    try {
      loading = true;
      let data: any[] = [];

      if (isOnline) {
        data = await api.getStock(merchantId);
        if (Array.isArray(data) && data.length > 0) {
          try {
            await cacheProducts(data.map(item => ({
              id: item.id,
              merchantId: item.merchantId || merchantId,
              name: item.name,
              price: item.selling || 0,
              category: item.category || 'General',
              barcode: item.barcode || '',
              cachedAt: Date.now()
            })));
          } catch {}
        }
      } else {
        try {
          const cached = await getCachedProducts(merchantId);
          data = cached.map(c => ({ ...c, selling: c.price }));
          if (data.length > 0) toast('Loaded from offline cache', { description: `${data.length} products` });
        } catch {}
      }

      if (Array.isArray(data)) {
        const filteredData = role === 'Admin' ? data : data.filter(item => {
          if (profile === 'Forecourt') return item.category === 'Fuel' || item.merchantId === 'merchant:M2';
          if (profile === 'Workshop') return item.category === 'Workshop' || item.merchantId === 'merchant:M3';
          if (profile === 'Restaurant') return item.category === 'Food' || item.category === 'Beverage';
          return item.category !== 'Fuel' && item.category !== 'Workshop';
        });
        products = filteredData.map(item => ({
          id: item.id,
          name: item.name,
          price: item.selling || 0,
          category: item.category || 'General',
          barcode: item.barcode || '',
          quantity: 0
        }));
      }
    } catch (e) {
      toast.error('Failed to load products');
    } finally {
      loading = false;
    }
  }

  async function initTerminal() {
    try {
      let tId = localStorage.getItem(`roxton_terminal_id_${merchantId}`);
      if (!tId) {
        tId = `TERM-${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem(`roxton_terminal_id_${merchantId}`, tId);
      }
      const existingTerminals = await api.getTerminals(merchantId);
      const myTerminal = existingTerminals.find((t: any) => t.id === tId);
      terminal = myTerminal || {
        id: tId,
        name: `${profile} Counter ${Math.floor(Math.random() * 5) + 1}`,
        type: 'Stationary',
        version: '4.2.1',
        status: 'Online'
      };
    } catch (e) {
      console.error('Terminal init failed:', e);
    }
  }

  // --- Online/Offline ---
  $effect(() => {
    const onOnline = () => { isOnline = true; };
    const onOffline = () => { isOnline = false; };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  });

  // --- Escape Key Handler ---
  $effect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showCloseDayWizard) { showCloseDayWizard = false; return; }
      if (showHotkeyOverlay) { showHotkeyOverlay = false; return; }
      if (overrideRequest) { overrideRequest = null; return; }
      if (showRefundModal) { showRefundModal = false; return; }
      if (showDrawerModal) { showDrawerModal = false; return; }
      if (showReceipt) { paymentStep = 'checkout'; transactionSuccess = null; showReceipt = false; paymentError = null; return; }
      if (paymentStep === 'completion' || paymentStep === 'declined') { paymentStep = 'checkout'; transactionSuccess = null; paymentError = null; return; }
      if (paymentStep === 'card-waiting' && !processingPayment) { paymentStep = 'checkout'; cardPhase = 'idle'; return; }
      if (paymentStep === 'card-processing' || paymentStep === 'cash-processing') return;
      if (showKeypad) { showKeypad = false; return; }
      if (showLoyaltyModal) { showLoyaltyModal = false; return; }
      if (showNetworkSwarm) { showNetworkSwarm = false; return; }
      if (showShiftReport) { showShiftReport = false; return; }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  });

  // --- Physical Keyboard -> Cash Keypad ---
  $effect(() => {
    if (!showKeypad) return;
    const handleKeypadInput = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        amountReceived = (() => {
          const parts = amountReceived.split('.');
          if (parts[1] && parts[1].length >= 2) return amountReceived;
          return amountReceived + e.key;
        })();
      }
      if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        amountReceived = amountReceived.includes('.') ? amountReceived : (amountReceived || '0') + '.';
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        amountReceived = amountReceived.slice(0, -1);
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        amountReceived = '';
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const t = parseFloat(amountReceived) || 0;
        if (t >= derivedGrandTotal && amountReceived !== '' && !processingPayment) {
          finalizeSale('Cash');
        }
      }
    };
    window.addEventListener('keydown', handleKeypadInput);
    return () => window.removeEventListener('keydown', handleKeypadInput);
  });

  // --- Keyboard Shortcuts ---
  $effect(() => {
    const handleHotkey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.shiftKey && e.key === '?') { e.preventDefault(); showHotkeyOverlay = !showHotkeyOverlay; return; }

      switch (e.key) {
        case 'F1': e.preventDefault(); searchInput?.focus(); break;
        case 'F2': e.preventDefault(); if (activeSession.cart.length > 0) paymentStep = 'card-waiting'; break;
        case 'F3': e.preventDefault(); if (activeSession.cart.length > 0) showKeypad = true; break;
        case 'F5': e.preventDefault();
          const nextId = sessions.find(s => s.id !== activeSessionId && s.cart.length > 0)?.id || sessions.find(s => s.id !== activeSessionId)?.id;
          if (nextId) { activeSessionId = nextId; toast(`Switched to Session ${nextId}`); }
          break;
        case 'F8': e.preventDefault(); requestClearCart(); break;
        case 'F10': e.preventDefault();
          if (activeSession.cart.length > 0) { paymentStep = 'card-waiting'; }
          break;
        case 'F12': e.preventDefault(); showRefundModal = true; break;
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  });

  // --- Load Receipt Config ---
  $effect(() => {
    (async () => {
      try {
        const config = await api.getReceiptConfig(merchantId);
        if (config) receiptConfig = config;
      } catch {}
    })();
  });

  // --- Sync Manager ---
  $effect(() => {
    syncManager.start(15000);
    const unsub = syncManager.subscribe((state: SyncState) => { syncState = state; });
    return () => { syncManager.stop(); unsub(); };
  });

  // --- Init ---
  $effect(() => {
    loadProducts();
    initTerminal();
    if (externalShiftId) {
      activeShiftId = externalShiftId;
    }
  });

  // --- Terminal Heartbeat ---
  $effect(() => {
    if (!terminal?.id) return;
    let cancelled = false;
    const sendHeartbeat = async () => {
      if (cancelled) return;
      try {
        await api.pingTerminal(merchantId, {
          id: terminal.id,
          name: terminal.name,
          type: terminal.type,
          version: '4.2.1',
          ip: getStableIp(),
          status: 'Online'
        });
        if (!cancelled) {
          heartbeatActive = true;
          lastHeartbeat = new Date();
        }
      } catch (e) {
        if (!cancelled) heartbeatActive = false;
      }
    };
    const interval = setInterval(sendHeartbeat, 30000);
    sendHeartbeat();
    return () => { cancelled = true; clearInterval(interval); };
  });

  // --- Barcode Scanner ---
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (scanTimeout) clearTimeout(scanTimeout);

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBuffer += e.key;
      }

      scanTimeout = setTimeout(() => {
        const code = scanBuffer.trim();
        if (code.length >= 5) {
          const product = products.find(p => p.barcode === code);
          if (product) {
            addToCartFn(product);
            toast.success(`Scanned: ${product.name}`, { description: `Barcode: ${code}` });
          } else {
            toast.error(`Unknown barcode: ${code}`);
          }
        }
        scanBuffer = '';
      }, 80);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scanTimeout) clearTimeout(scanTimeout);
    };
  });

  // --- Search-based barcode autoadd ---
  $effect(() => {
    if (searchQuery && filteredProducts.length === 1 && searchQuery === filteredProducts[0].barcode) {
      addToCartFn(filteredProducts[0]);
      searchQuery = '';
      toast.success(`Scanned: ${filteredProducts[0].name}`);
    }
  });

  // --- Keep addToCartFn in sync ---
  $effect(() => {
    addToCartFn = addToCart;
  });

  // --- Refund Modal load transactions ---
  $effect(() => {
    if (!showRefundModal) return;
    (async () => {
      try {
        refundLoading = true;
        const data = await api.getTransactions(merchantId);
        recentTxns = Array.isArray(data) ? data.slice(0, 20) : [];
      } catch { recentTxns = []; }
      finally { refundLoading = false; }
    })();
  });

  // --- Reset supervisor override state when triggered ---
  $effect(() => {
    if (overrideRequest) {
      supervisorPin = '';
      supervisorMode = 'choose';
      bioProgress = 0;
      bioPhase = 'idle';
      if (bioInterval) clearInterval(bioInterval);
      if (bioTimeout) clearTimeout(bioTimeout);
    }
  });

  // --- Biometric handlers ---
  function handleBiometric() {
    supervisorMode = 'biometric';
    bioPhase = 'scanning';
    bioProgress = 0;
    if (bioInterval) clearInterval(bioInterval);
    bioInterval = setInterval(() => {
      bioProgress = (() => {
        if (bioProgress >= 100) {
          if (bioInterval) clearInterval(bioInterval);
          bioPhase = 'verified';
          bioTimeout = setTimeout(() => handleOverrideSubmit('biometric'), 600);
          return 100;
        }
        return bioProgress + 4;
      })();
    }, 50);
  }

  function handlePinSubmit() {
    if (supervisorPin.length === 4) {
      handleOverrideSubmit('pin');
    }
  }

  // --- Print/Download helpers ---
  function printReceiptElement(el: HTMLElement) {
    printService.print(el.innerHTML, {
      title: `CLINTPOS_Receipt_${Date.now()}`,
      width: '80mm',
      printableWidth: '72mm',
      fontFamily: "'JetBrains Mono', monospace"
    });
  }

  function downloadReceiptImage(el: HTMLElement, txnId: string) {
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(el, { backgroundColor: '#FFFEF5', scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `receipt_${txnId}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Receipt downloaded');
      }).catch(() => toast.error('Failed to capture receipt'));
    });
  }

  // --- Refund handlers ---
  async function handleRefund() {
    if (!refundSelectedTxn || refundProcessing) return;
    const txn = refundSelectedTxn;
    setSupervisorAction({
      type: 'refund',
      description: `Refund R${txn.amount?.toFixed(2)} for transaction ${txn.id} - Reason: ${refundReason}`,
      callback: async (supervisorId: string, supervisorName: string) => {
        refundProcessing = true;
        try {
          const result = await api.processRefund({
            merchantId,
            originalTxnId: txn.id,
            items: txn.items || [],
            reason: refundReason,
            refundAmount: txn.amount || 0,
            cashierName: userName,
            terminalId: terminal?.id
          });

          if (result.success) {
            await api.saveAuditEvent({
              id: `override:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
              merchantId,
              category: 'SUPERVISOR_OVERRIDE',
              action: 'REFUND_AUTHORIZED',
              details: {
                supervisorId,
                supervisorName,
                cashierId: userName,
                transactionId: txn.id,
                refundAmount: txn.amount,
                reason: refundReason,
                terminalId
              },
              timestamp: new Date().toISOString(),
              userId: supervisorId
            });
            toast.success('Refund Processed', { description: `R${txn.amount?.toFixed(2)} refunded for ${txn.id}` });
            refundSelectedTxn = null;
            showRefundModal = false;
          } else {
            toast.error('Refund Failed', { description: result.error || 'Unknown error' });
          }
        } catch (e: any) {
          toast.error('Refund Error', { description: e?.message || 'Network error' });
        } finally {
          refundProcessing = false;
        }
      }
    });
    showSupervisorModal = true;
    showRefundModal = false;
  }
</script>

{#if role !== 'Cashier'}
  <div class="flex h-full items-center justify-center bg-neutral-50 rounded-[32px] border border-neutral-200/60 shadow-2xl p-20 text-center">
    <div class="max-w-md">
      <div class="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldAlert class="w-10 h-10 text-rose-500" />
      </div>
      <h2 class="text-2xl font-black mb-4">Access Restricted</h2>
      <p class="text-neutral-500 font-medium">The Terminal Node is locked to Terminal Operator roles only. Your session as {role} has been logged.</p>
    </div>
  </div>
{:else}
<div class="flex h-full bg-neutral-100 dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl border border-neutral-200/40 dark:border-neutral-800 relative transition-all duration-700 {zenMode ? 'ring-[12px] ring-amber-500/10' : ''}">
  <!-- POS Top Context Bar -->
  <div class="absolute top-0 left-0 right-0 h-16 bg-neutral-50/90 dark:bg-black flex items-center justify-between px-8 z-40 border-b border-neutral-200/60 dark:border-white/5 transition-all duration-500 {zenMode ? 'opacity-40 hover:opacity-100' : ''}">
    <div class="flex items-center gap-8">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shadow-inner" style="background-color: rgba(250, 204, 21, 0.1);">
          <ShoppingCart class="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p class="text-[9px] font-black text-neutral-400 dark:text-white/30 uppercase tracking-[0.2em] leading-none mb-1">Terminal Node</p>
          <p class="text-[11px] font-black text-amber-400 font-mono leading-none">{terminal?.id || `POS-0${activeSessionId}`}</p>
        </div>
      </div>

      <div class="h-6 w-[1px] bg-neutral-200 dark:bg-white/10"></div>

      <div class="flex items-center gap-2">
        {#each sessions as s}
          <button
            onclick={() => activeSessionId = s.id}
            class="relative px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 {activeSessionId === s.id ? 'bg-amber-400 text-black scale-105 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5'}"
          >
            Session {s.id}
            {#if s.cart.length > 0}
              <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-neutral-950"></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-4">
      <button
        onclick={() => zenMode = !zenMode}
        class="w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-90 {zenMode ? 'bg-amber-400 border-amber-500 shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'bg-neutral-100 border-neutral-200 hover:bg-neutral-200 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10'}"
        title={zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode (Focus)'}
      >
        <Zap class="w-4 h-4 {zenMode ? 'text-black' : 'text-amber-400'}" />
      </button>

      <button
        onclick={openCustomerDisplay}
        class="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center border border-neutral-200 dark:border-white/10 hover:bg-neutral-200 dark:hover:bg-white/10 transition-all active:scale-90"
        title="Open Customer Display (new window)"
      >
        <Monitor class="w-4 h-4 text-amber-500 dark:text-amber-400" />
      </button>

      <button
        onclick={toggleDarkMode}
        class="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center border border-neutral-200 dark:border-white/10 hover:bg-neutral-200 dark:hover:bg-white/10 transition-all active:scale-90"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {#if isDarkMode}
          <Sun class="w-4 h-4 text-amber-400" />
        {:else}
          <Moon class="w-4 h-4 text-amber-400" />
        {/if}
      </button>

      <div class="h-6 w-[1px] bg-neutral-200 dark:bg-white/10 mx-1"></div>

      {#if syncState.pendingCount > 0}
        <div class="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <CloudUpload class="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span class="text-[9px] font-black text-amber-400 uppercase tracking-widest">{syncState.pendingCount} Pending</span>
        </div>
      {/if}

      {#if !isOnline}
        <div class="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <CloudOff class="w-3.5 h-3.5 text-rose-400" />
          <span class="text-[9px] font-black text-rose-400 uppercase tracking-widest">Offline Mode</span>
        </div>
      {/if}

      <div class="flex items-center gap-4">
        <div class="text-right hidden sm:block">
          <p class="text-[10px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-widest leading-none mb-1">Network State</p>
          <div class="flex items-center justify-end gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full {heartbeatActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}"></div>
            <p class="text-[10px] font-black leading-none {heartbeatActive ? 'text-emerald-400' : 'text-rose-400'}">
              {heartbeatActive ? 'Node Sync Active' : 'Sync Interrupted'}
            </p>
          </div>
        </div>
        <button
          onclick={() => showNetworkSwarm = true}
          title="Open Network Swarm Diagnostics"
          class="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center border transition-colors hover:bg-neutral-200 dark:hover:bg-white/10 cursor-pointer {heartbeatActive ? 'border-emerald-500/30' : 'border-rose-500/30'}"
        >
          {#if heartbeatActive}
            <Wifi class="w-5 h-5 text-emerald-500" />
          {:else}
            <WifiOff class="w-5 h-5 text-rose-500" />
          {/if}
        </button>
        <div class="h-6 w-[1px] bg-neutral-200 dark:bg-white/10 mx-2"></div>
        <button
          onclick={() => {
            if (window.confirm('Are you sure you want to LOGOUT of the Terminal Node?')) {
              if (onLogout) onLogout();
              else { localStorage.removeItem('clintpos_auth_token'); localStorage.removeItem('clintpos_auth_user'); }
            }
          }}
          title="Logout from Terminal"
          class="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 transition-all active:scale-90"
        >
          <LogOut class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>

  <!-- Product Selection Area -->
  <div class="flex-1 flex flex-col pt-16 bg-neutral-100 dark:bg-neutral-950 transition-all duration-700 relative overflow-hidden">
    {#if zenMode}
      <div transition:fade class="absolute inset-0 z-[100] flex flex-col items-center justify-center p-20 text-center backdrop-blur-3xl bg-neutral-950/80">
        <div class="w-24 h-24 bg-amber-500/10 rounded-[40px] border border-amber-500/20 flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(250,204,21,0.2)] animate-pulse">
          <ScanIcon class="w-10 h-10 text-amber-400" />
        </div>
        <h4 class="text-4xl font-black text-white uppercase tracking-tighter mb-4">ZEN MODE ACTIVE</h4>
        <p class="text-neutral-500 font-mono text-sm max-w-sm uppercase tracking-widest leading-relaxed">
          Visual noise suppressed. High-performance scanning mode enabled.
        </p>
        <div class="mt-12 flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span class="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Awaiting Barcode Input...</span>
        </div>

        <button
          onclick={() => zenMode = false}
          class="mt-20 px-8 py-4 bg-amber-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Exit Focus Mode
        </button>
      </div>
    {/if}

    <div class="flex-1 flex flex-col transition-all duration-500 {zenMode ? 'blur-xl opacity-20 pointer-events-none grayscale' : ''}">
      <div class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center bg-neutral-100/90 dark:bg-neutral-900/80 backdrop-blur-xl sticky top-0 z-30">
        <div class="relative flex-1 group">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 transition-colors"></Search>
          <input
            bind:this={searchInput}
            type="text"
            placeholder="Scan barcode or search... (F1)"
            class="w-full pl-11 pr-20 py-3.5 bg-white/70 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700 rounded-2xl font-mono text-[11px] font-black uppercase tracking-wider outline-none transition-all shadow-inner focus:ring-2 focus:ring-amber-500/20 dark:text-neutral-100 dark:placeholder-neutral-500"
            bind:value={searchQuery}
            aria-label="Search products or scan barcode"
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <kbd class="px-2 py-1 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-600 rounded-lg text-[8px] font-black text-neutral-400">F1</kbd>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 content-start custom-scrollbar">
        {#if loading}
          <div class="col-span-full flex items-center justify-center py-20">
            <Loader2 class="w-8 h-8 animate-spin text-neutral-400" />
          </div>
        {:else if filteredProducts.length === 0}
          <div class="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <Package class="w-16 h-16 text-neutral-300 mb-4" />
            <p class="text-sm font-black uppercase tracking-widest text-neutral-400 mb-2">
              {searchQuery ? 'No products match your search' : 'No products available'}
            </p>
            <p class="text-xs text-neutral-400 max-w-sm">
              {searchQuery ? 'Try a different search term' : 'Add products in the Inventory section to get started'}
            </p>
          </div>
        {:else}
          {#each filteredProducts as item, idx (item.id)}
            <button
              onclick={() => addToCart(item)}
              transition:scale={{delay: idx * 10, start: 0.9, duration: 200}}
              class="bg-neutral-50 dark:bg-neutral-900 p-6 aspect-square rounded-[36px] border border-neutral-200/60 dark:border-neutral-800 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:-translate-y-2 active:scale-95 transition-all text-center group flex flex-col items-center justify-center relative overflow-hidden"
            >
              {#if (promoResult.itemBadges[item.id] || []).length > 0}
                <div class="absolute top-4 left-4 z-10">
                  <span class="px-2 py-0.5 bg-amber-400 text-black rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">
                    {promoResult.itemBadges[item.id][0]}
                  </span>
                </div>
              {/if}
              <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all group-hover:scale-110">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-black bg-amber-400 shadow-lg">
                  <ShoppingCart class="w-4 h-4" />
                </div>
              </div>

              <div class="w-24 h-24 bg-white/50 dark:bg-neutral-800 rounded-3xl flex items-center justify-center text-4xl mb-4 transition-all duration-500 group-hover:scale-110 shadow-inner border border-neutral-200/30 dark:border-neutral-700">
                {item.category === 'Fuel' ? '\u26fd' : item.category === 'Dairy' ? '\ud83e\udd5b' : item.category === 'Mains' ? '\ud83c\udf54' : '\ud83d\udce6'}
              </div>

              <p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1 leading-none">{item.category}</p>
              <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 mb-3 truncate w-full px-2 leading-tight uppercase tracking-tight">{item.name}</p>

              <div class="pt-3 border-t border-neutral-100 dark:border-neutral-800 w-full mt-1">
                <p class="text-sm font-black tracking-tighter text-amber-500 font-mono">R {item.price.toFixed(2)}</p>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Cart Control Center -->
  <div class="flex flex-col bg-neutral-50 dark:bg-black border-l border-neutral-200/60 dark:border-neutral-900 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.04)] transition-all duration-300 ease-in-out overflow-hidden {cartPanelOpen ? 'w-[420px]' : 'w-0 border-l-0 shadow-none'}">
    <div class="w-[420px] flex flex-col h-full">
    <div class="px-6 py-5 mt-16 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-100/70 dark:bg-neutral-900/50 backdrop-blur-xl flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-black dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-amber-400 shadow-xl border border-white/5">
          <ShoppingCart class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-900 dark:text-neutral-100">Current Order</h3>
          <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{activeSession.cart.length} line items</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          onclick={requestClearCart}
          class="p-2.5 text-neutral-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/50"
          title="Clear cart (requires override)"
        >
          <Trash2 class="w-4.5 h-4.5" />
        </button>
        <button
          onclick={() => cartPanelOpen = false}
          class="p-2.5 text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
          title="Hide cart panel"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-6 space-y-3 custom-scrollbar">
      {#if activeSession.cart.length === 0}
        <div transition:fade class="h-full flex flex-col items-center justify-center text-center p-8 opacity-20 grayscale scale-110">
          <div class="w-20 h-20 rounded-[32px] border-4 border-dashed border-neutral-400 flex items-center justify-center mb-6">
            <ScanIcon class="w-9 h-9 text-neutral-500" />
          </div>
          <p class="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-500">Terminal Awaiting Input</p>
          <p class="text-[9px] font-bold text-neutral-400 mt-2 uppercase">Scan items or select from grid</p>
        </div>
      {:else}
        {#each activeSession.cart as item (item.id)}
          <div
            transition:fly={{x: 20, duration: 200}}
            class="px-4 py-4 bg-neutral-50/80 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-3xl flex items-center gap-4 hover:border-amber-400 dark:hover:border-amber-500/50 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all group"
          >
            <div class="w-11 h-11 bg-neutral-100/60 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-xl group-hover:bg-amber-50 dark:group-hover:bg-amber-950 transition-colors shrink-0 border border-neutral-200 dark:border-neutral-700">
              {item.category === 'Fuel' ? '\u26fd' : '\ud83d\udce6'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-black text-neutral-900 dark:text-neutral-100 truncate uppercase tracking-tight">{item.name}</p>
              <div class="flex items-center gap-2 mt-1">
                <p class="text-[11px] font-black text-amber-500 font-mono tracking-tighter">R {item.price.toFixed(2)}</p>
                {#if (promoResult.itemBadges[item.id] || []).length > 0}
                  <span class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-[7px] font-black uppercase leading-none tracking-widest border border-amber-200 dark:border-amber-800/50">
                    {promoResult.itemBadges[item.id][0]}
                  </span>
                {/if}
              </div>
              {#if promoResult.applied.find(a => a.itemId === item.id)}
                <p class="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase leading-none mt-1">-R {promoResult.applied.find(a => a.itemId === item.id)!.discount.toFixed(2)} saved</p>
              {/if}
            </div>
            <div class="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-1 shadow-inner">
              <button onclick={() => removeFromCart(item.id)} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:shadow-sm rounded-lg transition-all"><Minus class="w-3.5 h-3.5 text-neutral-500" /></button>
              <span class="w-8 text-center text-xs font-black text-neutral-900 dark:text-neutral-100 tabular-nums font-mono">{item.quantity}</span>
              <button onclick={() => addToCart(item)} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:shadow-sm rounded-lg transition-all"><Plus class="w-3.5 h-3.5 text-neutral-500" /></button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="px-4 py-4 border-t border-neutral-200/50 dark:border-neutral-900 bg-neutral-50/90 dark:bg-black space-y-3">
      <div class="space-y-2">
        <div class="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
          <span>Subtotal (Ex VAT)</span>
          <span class="text-neutral-900 dark:text-neutral-100 font-mono">R {cartTotal.toFixed(2)}</span>
        </div>
        {#if promoDiscount > 0}
          <div transition:fly={{y: 5, duration: 200}} class="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            <span class="flex items-center gap-1.5"><Zap class="w-3 h-3" /> Promotions</span>
            <span class="font-mono">- R {promoDiscount.toFixed(2)}</span>
          </div>
        {/if}
        {#if redeemPoints > 0}
          <div transition:fly={{y: 10, duration: 200}} class="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-rose-500">
            <span class="flex items-center gap-1.5"><Tag class="w-3 h-3" /> Rewards</span>
            <span class="font-mono">- R {pointsDiscount.toFixed(2)}</span>
          </div>
        {/if}
        <div class="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
          <span>Fiscal Tax (15%)</span>
          <span class="text-neutral-900 dark:text-neutral-100 font-mono">R {vat.toFixed(2)}</span>
        </div>
        <div class="pt-3 border-t border-dashed border-neutral-200/70 dark:border-neutral-800 flex justify-between items-center">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Grand Total</p>
          </div>
          <div class="text-right">
            <span class="text-2xl font-black tracking-tighter text-neutral-900 dark:text-neutral-100 tabular-nums font-mono">R {derivedGrandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          disabled={activeSession.cart.length === 0}
          onclick={() => paymentStep = 'card-waiting'}
          class="group py-3 bg-neutral-950 dark:bg-neutral-800 text-white rounded-xl font-black uppercase tracking-[0.15em] text-[9px] shadow-[0_6px_20px_rgba(0,0,0,0.1)] hover:bg-black dark:hover:bg-neutral-700 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-white/5"
        >
          <CreditCard class="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          Card <span class="text-[7px] opacity-40 font-mono tracking-normal">F2</span>
        </button>
        <button
          disabled={activeSession.cart.length === 0}
          onclick={() => showKeypad = true}
          class="group py-3 bg-amber-400 text-black rounded-xl font-black uppercase tracking-[0.15em] text-[9px] shadow-[0_6px_20px_rgba(250,204,21,0.2)] hover:bg-amber-500 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-amber-500/50"
          aria-label="Pay with cash (F3)"
        >
          <Banknote class="w-3.5 h-3.5 group-hover:rotate-6 transition-transform" />
          Cash <span class="text-[7px] opacity-60 font-mono tracking-normal">F3</span>
        </button>
      </div>

      <div class="grid grid-cols-5 gap-1.5">
        {#if activeShiftId}
          <button
            onclick={() => showShiftReport = true}
            title="Shift Report"
            class="py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg font-black uppercase tracking-wide text-[6.5px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all flex flex-col items-center justify-center gap-1"
          >
            <HistoryIcon class="w-3.5 h-3.5" />
            Shift
          </button>
        {/if}
        <button
          onclick={() => showLoyaltyModal = true}
          title="Loyalty"
          class="py-2 border rounded-lg font-black uppercase tracking-wide text-[6.5px] transition-all flex flex-col items-center justify-center gap-1 {activeSession.customer ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-100' : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'}"
        >
          <Heart class="w-3.5 h-3.5 {activeSession.customer ? 'fill-rose-500' : ''}" />
          {activeSession.customer ? `${activeSession.customer.points} PTS` : 'Loyalty'}
        </button>
        <button
          onclick={() => showRefundModal = true}
          title="Refund"
          class="py-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg font-black uppercase tracking-wide text-[6.5px] text-rose-500 hover:text-rose-700 hover:bg-rose-100 transition-all flex flex-col items-center justify-center gap-1"
        >
          <RotateCcw class="w-3.5 h-3.5" /> Refund
        </button>
        <button
          onclick={() => showDrawerModal = true}
          title="Drawer"
          class="py-2 border rounded-lg font-black uppercase tracking-wide text-[6.5px] transition-all flex flex-col items-center justify-center gap-1 {drawerOpen ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-500' : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400'}"
        >
          <Banknote class="w-3.5 h-3.5" /> Drawer
        </button>
        <button
          onclick={() => showCloseDayWizard = true}
          title="End Day"
          class="py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg font-black uppercase tracking-wide text-[6.5px] text-amber-500 hover:bg-amber-100 transition-all flex flex-col items-center justify-center gap-1"
        >
          <Lock class="w-3.5 h-3.5" /> End
        </button>
      </div>
    </div>
    </div>
  </div>

  <!-- Reopen cart tab (visible when cart panel is hidden) -->
  {#if !cartPanelOpen}
    <button
      onclick={() => cartPanelOpen = true}
      transition:fly={{ x: 20, duration: 200 }}
      class="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 px-2.5 py-5 bg-neutral-950 dark:bg-neutral-800 text-amber-400 rounded-l-2xl shadow-2xl border border-white/10 border-r-0 hover:bg-black hover:px-3.5 transition-all"
      title="Show cart"
    >
      <ShoppingCart class="w-4 h-4" />
      {#if activeSession.cart.length > 0}
        <span class="text-[9px] font-black bg-amber-400 text-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">{activeSession.cart.length}</span>
      {/if}
      <ChevronRight class="w-3.5 h-3.5 rotate-180" />
    </button>
  {/if}

  <!-- SUPERVISOR OVERRIDE MODAL -->
  {#if overrideRequest}
    <div class="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 font-mono" style="font-family: 'JetBrains Mono', monospace">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-neutral-900 border border-amber-500/40 rounded-3xl p-8 max-w-sm w-full shadow-2xl shadow-amber-500/10">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <Shield class="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 class="text-sm font-black text-white uppercase tracking-wider">Supervisor Override</h3>
            <p class="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">
              {overrideRequest.action === 'void_item' ? 'Void Line Item' : 'Clear Entire Cart'}
            </p>
          </div>
          <button onclick={() => overrideRequest = null} class="ml-auto p-2 hover:bg-white/5 rounded-lg">
            <X class="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {#key supervisorMode}
          {#if supervisorMode === 'choose'}
            <div transition:fade class="space-y-3">
              <p class="text-xs text-neutral-400 mb-4">Select authentication method to authorize this operation.</p>
              <button
                onclick={handleBiometric}
                class="w-full py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-amber-500/20 transition-all active:scale-95"
              >
                <Fingerprint class="w-5 h-5" /> Biometric Scan
              </button>
              <button
                onclick={() => supervisorMode = 'pin'}
                class="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
              >
                <Hash class="w-5 h-5" /> PIN Entry
              </button>
            </div>
          {:else if supervisorMode === 'pin'}
            <div transition:fly={{x: 20, duration: 200}} class="space-y-4">
              <div class="flex justify-center gap-2 mb-2">
                {#each [0,1,2,3] as i}
                  <div class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black {supervisorPin.length > i ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 text-transparent'}">
                    {supervisorPin.length > i ? '*' : ''}
                  </div>
                {/each}
              </div>
              <div class="grid grid-cols-3 gap-2">
                {#each ['1','2','3','4','5','6','7','8','9','CLR','0','OK'] as k}
                  <button
                    onclick={() => {
                      if (k === 'CLR') supervisorPin = '';
                      else if (k === 'OK') handlePinSubmit();
                      else if (supervisorPin.length < 4) supervisorPin += k;
                    }}
                    class="h-11 rounded-lg font-black text-sm transition-all active:scale-95 {k === 'OK' ? 'bg-amber-500 text-black hover:bg-amber-400' : k === 'CLR' ? 'bg-white/5 text-neutral-400 hover:bg-white/10' : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'}"
                  >
                    {k}
                  </button>
                {/each}
              </div>
              <button onclick={() => supervisorMode = 'choose'} class="w-full text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest hover:text-white transition-colors pt-2">
                Back
              </button>
            </div>
          {:else if supervisorMode === 'biometric'}
            <div transition:fade class="flex flex-col items-center py-4">
              <div class="relative w-24 h-24 mb-6">
                <div class="w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500 {bioPhase === 'verified' ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/5'}">
                  {#if bioPhase === 'verified'}
                    <CheckCircle2 class="w-10 h-10 text-emerald-400" />
                  {:else}
                    <Fingerprint class="w-10 h-10 text-amber-400 animate-pulse" />
                  {/if}
                </div>
                {#if bioPhase === 'scanning'}
                  <svg class="absolute inset-0 w-24 h-24 -rotate-90">
                    <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(245,158,11,0.3)" stroke-width="4" />
                    <circle cx="48" cy="48" r="44" fill="none" stroke="#f59e0b" stroke-width="4"
                      stroke-dasharray={`${bioProgress * 2.76} 276`} stroke-linecap="round" class="transition-all duration-100" />
                  </svg>
                {/if}
              </div>
              <p class="text-xs font-black uppercase tracking-widest {bioPhase === 'verified' ? 'text-emerald-400' : 'text-amber-400'}">
                {bioPhase === 'verified' ? 'Identity Verified' : 'Scanning Biometrics...'}
              </p>
              <p class="text-[9px] text-neutral-500 mt-1">
                {bioPhase === 'verified' ? 'Authorization granted' : 'Place finger on sensor'}
              </p>
            </div>
          {/if}
        {/key}
      </div>
    </div>
  {/if}

  <!-- LOYALTY MODAL -->
  {#if showLoyaltyModal}
    <div class="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative">
        <button onclick={() => showLoyaltyModal = false} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 rounded-full"><X class="w-6 h-6 text-neutral-400" /></button>
        <Heart class="w-12 h-12 text-rose-500 mb-6" />
        <h3 class="text-2xl font-black mb-2 tracking-tight">Customer Loyalty Login</h3>
        <p class="text-neutral-400 text-sm mb-8">Enter Phone or Email to retrieve point balances and active rewards.</p>

        <div class="space-y-6">
          <div class="relative">
            <PhoneIcon class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
            <input type="text" placeholder="e.g. 082 000 0000" class="w-full pl-12 pr-4 py-5 bg-neutral-50 border border-neutral-200 rounded-2xl font-bold text-lg outline-none focus:ring-4 focus:ring-indigo-50" bind:value={loyaltySearch} />
          </div>

          {#if activeSession.customer}
            <div class="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p class="text-[10px] font-black text-indigo-600 uppercase mb-1">Available Points</p>
                <p class="text-3xl font-black text-neutral-900">{activeSession.customer.points} <span class="text-xs font-bold text-neutral-400">PTS</span></p>
              </div>
              <div class="flex flex-col gap-2">
                <input type="number" placeholder="Redeem?" class="w-24 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-black outline-none" bind:value={redeemPoints} oninput={e => redeemPoints = Math.min(activeSession.customer.points, parseInt(e.target.value) || 0)} />
                <p class="text-[8px] font-black text-indigo-500 text-center uppercase tracking-widest">R{(redeemPoints * 0.1).toFixed(2)} OFF</p>
              </div>
            </div>
          {/if}

          <button onclick={handleLoyaltySearch} disabled={loyaltyLoading} class="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
            {#if loyaltyLoading}
              <Loader2 class="animate-spin w-5 h-5" />
            {:else}
              <Search class="w-5 h-5"></Search>
            {/if}
            {activeSession.customer ? 'Refresh Balance' : 'Find Member'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Card Payment Terminal -->
  {#if paymentStep === 'card-waiting' || paymentStep === 'card-processing' || paymentStep === 'declined'}
    <div class="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
      <div transition:fly={{y: 100, duration: 300}} class="bg-neutral-900 text-white p-12 rounded-[60px] max-w-md w-full text-center border border-white/10 shadow-2xl">
        {#if paymentStep === 'card-waiting'}
          <div class="relative w-24 h-24 mx-auto mb-8">
            <Radio class="w-24 h-24 text-indigo-400 animate-pulse" />
            <span class="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping"></span>
          </div>
          <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2">Present Card or Phone</h4>
          <h3 class="text-5xl font-black mb-4">R {derivedGrandTotal.toFixed(2)}</h3>
          <p class="text-neutral-600 text-[9px] font-bold uppercase tracking-widest mb-10">Terminal Ready â€” Tap / Insert / Swipe</p>
          <button
            onclick={() => finalizeSale('Card')}
            disabled={processingPayment}
            class="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95"
            aria-label="Process card payment"
          >
            <CreditCard class="w-5 h-5 inline mr-3" />
            Process Card Payment
          </button>
          <button onclick={() => { paymentStep = 'checkout'; cardPhase = 'idle'; }} class="mt-6 text-neutral-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
        {:else if paymentStep === 'card-processing'}
          <Loader2 class="w-20 h-20 text-amber-400 mx-auto mb-8 animate-spin" />
          <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-2">
            {cardPhase === 'connecting' ? 'Connecting to Terminal...' : 'Authorizing Payment...'}
          </h4>
          <h3 class="text-5xl font-black mb-4">R {derivedGrandTotal.toFixed(2)}</h3>
          <p class="text-neutral-600 text-[9px] font-bold uppercase tracking-widest">Do not remove card</p>
        {:else if paymentStep === 'declined'}
          <div class="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <X class="w-12 h-12 text-rose-500" />
          </div>
          <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-2">Payment Declined</h4>
          <h3 class="text-3xl font-black mb-4">R {derivedGrandTotal.toFixed(2)}</h3>
          {#if paymentError}
            <div class="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6 text-left">
              <p class="text-rose-400 text-xs font-bold">{paymentError}</p>
            </div>
          {/if}
          {#if paymentIdempotencyKey}
            <div class="bg-white/5 border border-white/10 rounded-xl px-4 py-2 mb-6 flex items-center justify-center gap-2">
              <Shield class="w-3 h-3 text-amber-400" />
              <p class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                Idempotency Protected &bull; Retry {paymentRetryCount}/{MAX_MANUAL_RETRIES}
              </p>
            </div>
          {/if}
          <button
            onclick={() => retryPayment('Card')}
            disabled={paymentRetryCount >= MAX_MANUAL_RETRIES}
            class="w-full py-5 bg-white text-neutral-900 rounded-3xl font-black uppercase tracking-widest text-xs mb-3 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {paymentRetryCount >= MAX_MANUAL_RETRIES ? 'Max Retries Reached' : `Retry Payment (Attempt ${paymentRetryCount + 2})`}
          </button>
          <button onclick={() => { paymentStep = 'checkout'; cardPhase = 'idle'; paymentError = null; paymentIdempotencyKey = null; paymentRetryCount = 0; }} class="text-neutral-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Completion: Receipt Prompt -->
  {#if paymentStep === 'completion' && !showReceipt}
    <div class="fixed inset-0 z-[500] bg-emerald-600 flex items-center justify-center p-6 text-white text-center">
      <div transition:scale={{start: 0.8, duration: 200}} class="max-w-md w-full">
        <div class="space-y-8">
          <CheckCircle2 class="w-24 h-24 mx-auto mb-6" />
          <h3 class="text-4xl font-black mb-2 tracking-tight">Approved</h3>
          <div class="space-y-1 mb-8">
            <p class="text-emerald-100 text-sm font-black uppercase tracking-widest">
              {transactionSuccess?.receiptNo || transactionSuccess?.id}
            </p>
            {#if transactionSuccess?.authCode}
              <p class="text-emerald-200 text-[10px] font-bold uppercase tracking-widest">Auth: {transactionSuccess.authCode} Â· {transactionSuccess.cardRef}</p>
            {/if}
            {#if transactionSuccess?.method === 'Cash' && transactionSuccess?.change > 0}
              <p class="text-2xl font-black mt-2">Change Due: R {transactionSuccess.change.toFixed(2)}</p>
            {/if}
            {#if transactionSuccess?.pointsEarned > 0}
              <p class="text-emerald-200 text-xs font-bold mt-1">+{transactionSuccess.pointsEarned} loyalty points earned</p>
            {/if}
            {#if transactionSuccess?.offlineQueued}
              <p class="text-amber-300 text-xs font-black uppercase tracking-widest mt-2">Queued Offline - Will Sync</p>
            {/if}
          </div>

          <div class="bg-white/10 p-8 rounded-[40px] border border-white/10 backdrop-blur-md">
            <p class="text-lg font-black mb-6">Print Transaction Slip?</p>
            <div class="grid grid-cols-2 gap-4">
              <button
                onclick={() => showReceipt = true}
                class="py-5 bg-white text-emerald-600 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <ReceiptText class="w-4 h-4" /> Yes, Print
              </button>
              <button
                onclick={() => { paymentStep = 'checkout'; transactionSuccess = null; showReceipt = false; }}
                class="py-5 bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <X class="w-4 h-4" /> No, Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Thermal Receipt View -->
  {#if paymentStep === 'completion' && showReceipt && transactionSuccess}
    {@const txn = transactionSuccess}
    {@const onClose = () => { paymentStep = 'checkout'; transactionSuccess = null; showReceipt = false; }}
    <div class="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
      <div transition:fly={{y: 50, duration: 300}} class="flex flex-col items-center max-w-full">
        <div
          bind:this={receiptRef}
          class="bg-white w-[320px] shadow-2xl relative overflow-hidden text-black font-mono selection:bg-neutral-200"
          style="font-family: 'JetBrains Mono', monospace; border: 1px solid #eee"
        >
          <div class="h-4 bg-white relative overflow-hidden">
            <div class="absolute top-0 left-0 right-0 flex justify-between px-[2px]">
              {#each Array(24) as _, i}
                <div class="w-2 h-2 rounded-full bg-black/5 -translate-y-1"></div>
              {/each}
            </div>
          </div>

          <div transition:slide={{duration: 1500}} class="overflow-hidden">
            <div class="px-6 py-6">
              <div class="text-center mb-6">
                <h1 class="text-[18px] font-black tracking-tighter mb-1 uppercase">CLINTPOS NODE</h1>
                <p class="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{receiptConfig?.headerLine1 || 'Sandton HQ Terminal'}</p>
                <div class="h-px bg-black my-4"></div>
                <p class="text-[9px] font-bold leading-tight uppercase">
                  {receiptConfig?.address || '160 Jan Smuts Ave, Rosebank, 2196'}<br />
                  VAT: {receiptConfig?.vatNumber || 'ZA-4200088192'}<br />
                  TEL: +27 11 000 8888
                </p>
              </div>

              <div class="flex flex-col gap-1 text-[10px] mb-6">
                <div class="flex justify-between">
                  <span class="font-bold uppercase">Date:</span>
                  <span>{new Date().toLocaleString('en-ZA', { hour12: false })}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-bold uppercase">Ref:</span>
                  <span class="font-black">#{txn.id.slice(-8).toUpperCase()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-bold uppercase">Cashier:</span>
                  <span>{txn.cashierName?.toUpperCase()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-bold uppercase">Device:</span>
                  <span>{txn.terminalId || 'MOBILE-POS-01'}</span>
                </div>
              </div>

              <div class="h-px border-b border-black border-dashed mb-4"></div>

              <div class="space-y-3 mb-6">
                {#each txn.items || [] as item, i}
                  <div class="text-[11px]">
                    <div class="flex justify-between font-black uppercase">
                      <span class="flex-1 mr-2">{item.name}</span>
                      <span>{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-[9px] font-bold text-neutral-600">
                      <span>{item.quantity} x {item.price.toFixed(2)}</span>
                      {#if item.discount > 0}
                        <span>-{(item.discount).toFixed(2)}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>

              <div class="h-px bg-black mb-4"></div>

              <div class="space-y-1 mb-6">
                <div class="flex justify-between text-[11px] font-bold">
                  <span>SUBTOTAL</span>
                  <span>{(txn.amount / 1.15).toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-[11px] font-bold">
                  <span>VAT (15%)</span>
                  <span>{(txn.amount - txn.amount / 1.15).toFixed(2)}</span>
                </div>
                {#if txn.promoDiscount > 0}
                  <div class="flex justify-between text-[11px] font-black text-neutral-600">
                    <span>DISCOUNT</span>
                    <span>-{(txn.promoDiscount).toFixed(2)}</span>
                  </div>
                {/if}
                <div class="flex justify-between text-[16px] font-black border-t-2 border-black pt-2 mt-2">
                  <span>TOTAL</span>
                  <span>R {txn.amount.toFixed(2)}</span>
                </div>
              </div>

              <div class="bg-neutral-100 p-3 rounded-sm mb-6">
                <div class="flex justify-between text-[11px] font-black uppercase mb-1">
                  <span>Paid via:</span>
                  <span>{txn.method}</span>
                </div>
                {#if txn.method === 'Cash'}
                  <div class="flex justify-between text-[10px] font-bold">
                    <span>Tendered:</span>
                    <span>{(txn.amount + (txn.change || 0)).toFixed(2)}</span>
                  </div>
                  <div class="flex justify-between text-[11px] font-black border-t border-neutral-300 mt-1 pt-1">
                    <span>Change:</span>
                    <span>{txn.change?.toFixed(2)}</span>
                  </div>
                {/if}
              </div>

              <div class="text-center">
                <div class="flex justify-center gap-[1px] mb-2 grayscale opacity-80">
                  {#each txn.id.split('').slice(0, 24) as c, i}
                    <div class="bg-black" style="width: {(c.charCodeAt(0) % 3) + 1}px; height: 20px"></div>
                  {/each}
                </div>
                <p class="text-[8px] font-black text-neutral-400 tracking-[0.3em] uppercase mb-4">
                  {txn.id.toUpperCase()}
                </p>
                <div class="h-px border-b border-black border-dashed mb-4"></div>
                <p class="text-[10px] font-black uppercase tracking-widest mb-1">Thank you for your business</p>
                <p class="text-[8px] font-bold text-neutral-500 italic">No returns without this receipt.</p>
                <p class="text-[7px] font-mono text-neutral-300 mt-4 uppercase">CLINTPOS FORENSIC v4.0.2 / NODE-SA-001</p>
              </div>
            </div>
          </div>

          <div class="h-4 bg-white relative overflow-hidden">
            <div class="absolute bottom-0 left-0 right-0 flex justify-between px-[2px]">
              {#each Array(24) as _, i}
                <div class="w-2 h-2 rounded-full bg-black/5 translate-y-1"></div>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex flex-wrap justify-center gap-3 mt-8">
          <button
            onclick={() => { if (receiptRef) printReceiptElement(receiptRef); }}
            class="px-8 py-4 bg-amber-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-amber-500/20"
          >
            <Printer class="w-4 h-4" /> PRINT 80MM
          </button>
          <button
            onclick={() => { if (receiptRef) downloadReceiptImage(receiptRef, txn.id); }}
            class="px-8 py-4 bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/20 active:scale-95 transition-all flex items-center gap-3 border border-white/10"
          >
            <Eye class="w-4 h-4" /> VIEW AUDIT
          </button>
          <button
            onclick={onClose}
            class="px-8 py-4 bg-neutral-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-neutral-700 active:scale-95 transition-all"
          >
            NEXT ORDER
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Keypad Modal for Cash -->
  {#if showKeypad && (paymentStep === 'checkout' || paymentStep === 'cash-processing')}
    <div class="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-white dark:bg-neutral-900 p-5 rounded-[28px] max-w-sm w-full shadow-2xl">
        <div class="flex justify-between items-center mb-3">
          <div>
            <h3 class="text-base font-black dark:text-neutral-100">Cash Intake</h3>
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Terminal Cash Entry &bull; F3</p>
          </div>
          <button onclick={() => showKeypad = false} class="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <X class="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        <div class="bg-neutral-900 dark:bg-neutral-800 rounded-xl p-3 mb-2.5 flex items-center justify-between">
          <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Total Due</span>
          <span class="text-xl font-black text-white tabular-nums">R {derivedGrandTotal.toFixed(2)}</span>
        </div>

        <div class="relative mb-2.5">
          <div class="p-3.5 rounded-xl text-right border-2 transition-colors {isSufficient ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : isShort ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700'}">
            <p class="text-[9px] font-black uppercase text-neutral-400 dark:text-neutral-500 mb-0.5 tracking-widest">Amount Received</p>
            <p class="text-3xl font-black tabular-nums {isSufficient ? 'text-emerald-700 dark:text-emerald-400' : isShort ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-900 dark:text-neutral-100'}">R {amountReceived || '0.00'}</p>
          </div>
          {#if amountReceived}
            <button
              onclick={() => amountReceived = ''}
              class="absolute top-3 right-3 p-1.5 bg-neutral-200/60 dark:bg-neutral-700/60 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              aria-label="Clear amount"
            >
              <X class="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
            </button>
          {/if}
        </div>

        <div class="p-2.5 rounded-xl mb-3 flex items-center justify-between transition-all {isSufficient ? 'bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800' : isShort ? 'bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800' : 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'}">
          <div class="flex items-center gap-2">
            {#if isSufficient}
              <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {:else if isShort}
              <AlertTriangle class="w-4 h-4 text-rose-600 dark:text-rose-400" />
            {:else}
              <Banknote class="w-4 h-4 text-neutral-400" />
            {/if}
            <span class="text-[10px] font-black uppercase tracking-widest {isSufficient ? 'text-emerald-700 dark:text-emerald-400' : isShort ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-500'}">
              {isSufficient ? 'Change Due' : isShort ? 'Insufficient' : 'Enter Amount'}
            </span>
          </div>
          <span class="text-lg font-black tabular-nums {isSufficient ? 'text-emerald-700 dark:text-emerald-400' : isShort ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-400'}">
            {amountReceived ? (isSufficient ? `R ${changeDue.toFixed(2)}` : `- R ${Math.abs(changeDue).toFixed(2)}`) : '\u2014'}
          </span>
        </div>

        <div class="mb-3">
          <p class="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-1.5">Quick Tender</p>
          <div class="flex gap-2 flex-wrap">
            {#each quickTenders as qt}
              <button
                onclick={() => amountReceived = qt.value.toFixed(2)}
                class="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border {tendered === qt.value ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'}"
              >
                {qt.label === 'Exact' ? `Exact R${qt.value.toFixed(2)}` : qt.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mb-3">
          {#each ['1','2','3','4','5','6','7','8','9','.','0','DEL'] as k}
            <button
              onclick={() => {
                if (k === 'DEL') amountReceived = amountReceived.slice(0, -1);
                else if (k === '.') {
                  amountReceived = amountReceived.includes('.') ? amountReceived : (amountReceived || '0') + '.';
                } else {
                  const parts = amountReceived.split('.');
                  if (parts[1] && parts[1].length >= 2) return;
                  amountReceived = amountReceived + k;
                }
              }}
              class="h-11 rounded-xl font-black text-base transition-all active:scale-95 {k === 'DEL' ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm hover:bg-neutral-300 dark:hover:bg-neutral-600' : k === '.' ? 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-amber-400' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500 hover:text-emerald-600 dark:text-neutral-100 dark:hover:border-emerald-500 dark:hover:text-emerald-400'}"
            >
              {k === 'DEL' ? '\u232B' : k}
            </button>
          {/each}
        </div>

        <button
          onclick={() => finalizeSale('Cash')}
          disabled={processingPayment || !isSufficient}
          class="w-full py-3.5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 {isSufficient && !processingPayment ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'}"
        >
          {#if processingPayment}
            <Loader2 class="w-5 h-5 animate-spin" /> Processing Payment...
          {:else if isSufficient}
            <Banknote class="w-5 h-5" /> Finalize &mdash; Change R {changeDue.toFixed(2)}
          {:else}
            <Lock class="w-4 h-4" /> {amountReceived ? 'Insufficient Funds' : 'Enter Cash Amount'}
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Network Swarm Overlay -->
  {#if showNetworkSwarm}
    <NetworkSwarm merchantId={merchantId} onClose={() => showNetworkSwarm = false} />
  {/if}

  <!-- Shift Report Overlay -->
  {#if showShiftReport && activeShiftId}
    <ShiftReport shiftId={activeShiftId} onClose={() => showShiftReport = false} />
  {/if}

  <!-- Refund Modal -->
  {#if showRefundModal}
    <div class="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <RotateCcw class="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 class="text-lg font-black">Process Refund</h3>
              <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Select transaction to reverse</p>
            </div>
          </div>
          <button onclick={() => showRefundModal = false} class="p-2 hover:bg-neutral-100 rounded-full"><X class="w-5 h-5 text-neutral-400" /></button>
        </div>

        {#if !refundSelectedTxn}
          <div class="flex-1 overflow-y-auto space-y-2">
            {#if refundLoading}
              <div class="py-10 flex justify-center"><Loader2 class="animate-spin text-neutral-300" /></div>
            {:else if recentTxns.length === 0}
              <p class="text-center text-neutral-400 text-xs font-bold py-10 uppercase">No recent transactions</p>
            {:else}
              {#each recentTxns as txn}
                <button
                  onclick={() => refundSelectedTxn = txn}
                  class="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-between hover:border-rose-300 hover:bg-rose-50/30 transition-all text-left"
                >
                  <div>
                    <p class="text-xs font-black text-neutral-900">{txn.id}</p>
                    <p class="text-[9px] font-bold text-neutral-400">{txn.cashierName} â€¢ {txn.method} â€¢ {new Date(txn.date).toLocaleString()}</p>
                  </div>
                  <p class="text-sm font-black text-neutral-900">R {txn.amount?.toFixed(2)}</p>
                </button>
              {/each}
            {/if}
          </div>
        {:else}
          <div class="space-y-4">
            <div class="bg-rose-50 border border-rose-200 rounded-2xl p-5">
              <p class="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Selected Transaction</p>
              <p class="text-sm font-black text-neutral-900">{refundSelectedTxn.id}</p>
              <p class="text-xs text-neutral-500">{refundSelectedTxn.items?.length || 0} items â€¢ R {refundSelectedTxn.amount?.toFixed(2)}</p>
            </div>

            <div>
              <label for="refund-reason" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Reason for Refund</label>
              <select id="refund-reason" bind:value={refundReason} class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none">
                <option>Customer return</option>
                <option>Defective product</option>
                <option>Wrong item scanned</option>
                <option>Price discrepancy</option>
                <option>Customer dissatisfied</option>
                <option>Other</option>
              </select>
            </div>

            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0" />
              <p class="text-[10px] font-bold text-amber-700">This will reverse the full transaction amount and restore stock levels. This action is logged to the forensic audit ledger.</p>
            </div>

            <div class="flex gap-3">
              <button onclick={() => refundSelectedTxn = null} class="flex-1 py-4 bg-neutral-100 rounded-2xl font-black text-xs uppercase tracking-widest text-neutral-500 hover:bg-neutral-200 transition-all">
                Back
              </button>
              <button
                onclick={handleRefund}
                disabled={refundProcessing}
                class="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {#if refundProcessing}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <RotateCcw class="w-4 h-4" />
                {/if}
                {refundProcessing ? 'Processing...' : `Refund R ${refundSelectedTxn.amount?.toFixed(2)}`}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Hotkey Overlay -->
  {#if showHotkeyOverlay}
    <div class="fixed inset-0 z-[700] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Layout class="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 class="text-sm font-black text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
              <p class="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">Roxton Terminal Hotkeys</p>
            </div>
          </div>
          <button onclick={() => showHotkeyOverlay = false} class="p-2 hover:bg-white/5 rounded-lg" aria-label="Close shortcuts">
            <X class="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        <div class="space-y-2">
          {#each [
            { key: 'F1', action: 'Focus Product Search' },
            { key: 'F2', action: 'Pay by Card' },
            { key: 'F3', action: 'Pay by Cash' },
            { key: 'F5', action: 'Suspend / Switch Session' },
            { key: 'F8', action: 'Clear Cart (Override)' },
            { key: 'F10', action: 'Quick Settle' },
            { key: 'F12', action: 'Open Refund Modal' },
            { key: 'Shift + ?', action: 'Toggle This Overlay' },
            { key: 'Esc', action: 'Close Active Modal' },
            { key: '0-9 / .', action: 'Type into Cash Keypad (when open)' },
            { key: 'Enter', action: 'Confirm Cash Payment (when sufficient)' },
          ] as shortcut}
            <div class="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
              <span class="text-xs font-bold text-neutral-400">{shortcut.action}</span>
              <kbd class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-amber-400 tracking-widest">{shortcut.key}</kbd>
            </div>
          {/each}
        </div>
        <p class="text-[8px] text-neutral-600 text-center mt-6 uppercase tracking-widest">Hotkeys disabled when input fields are focused</p>
      </div>
    </div>
  {/if}

  <!-- Cash Drawer Modal -->
  {#if showDrawerModal}
    <div class="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Banknote class="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 class="text-lg font-black">{drawerOpen ? 'Close & Reconcile Drawer' : 'Open Cash Drawer'}</h3>
              <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Terminal: {terminal?.id}</p>
            </div>
          </div>
          <button onclick={() => showDrawerModal = false} class="p-2 hover:bg-neutral-100 rounded-full"><X class="w-5 h-5 text-neutral-400" /></button>
        </div>

        {#if !drawerOpen}
          <div class="space-y-4">
            <div>
              <label for="opening-float" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Opening Float (R)</label>
              <input id="opening-float" type="number" step="0.01" bind:value={drawerFloat} placeholder="e.g. 500.00" class="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-emerald-200" />
            </div>
            <button
              onclick={() => {
                supervisorAction = {
                  type: 'cash_drawer_open' as const,
                  description: `Open cash drawer with float of R${(parseFloat(drawerFloat) || 0).toFixed(2)} on terminal ${terminal?.id}`,
                  callback: async (supervisorId: string, supervisorName: string) => {
                    try {
                      const result = await api.cashDrawer({
                        action: 'open', merchantId, userId: userName, terminalId: terminal?.id,
                        amount: parseFloat(drawerFloat) || 0
                      });
                      if (result.success) {
                        await api.saveAuditEvent({
                          id: `override:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
                          merchantId,
                          category: 'SUPERVISOR_OVERRIDE',
                          action: 'CASH_DRAWER_OPEN',
                          details: { supervisorId, supervisorName, cashierId: userName, terminalId: terminal?.id, openingFloat: parseFloat(drawerFloat) || 0 },
                          timestamp: new Date().toISOString(),
                          userId: supervisorId
                        });
                        drawerOpen = true;
                        showDrawerModal = false;
                        drawerFloat = '';
                        toast.success('Cash Drawer Opened', { description: `Float: R${(parseFloat(drawerFloat) || 0).toFixed(2)}` });
                      }
                    } catch { toast.error('Failed to open drawer'); }
                  }
                };
                showSupervisorModal = true;
                showDrawerModal = false;
              }}
              class="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all"
            >
              Open Drawer (Requires Supervisor)
            </button>
          </div>
        {:else}
          <div class="space-y-4">
            <div>
              <label for="counted-cash" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Counted Cash in Drawer (R)</label>
              <input id="counted-cash" type="number" step="0.01" bind:value={drawerCloseAmount} placeholder="Count all cash and enter total" class="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <button
              onclick={() => {
                supervisorAction = {
                  type: 'cash_drawer_close' as const,
                  description: `Close & reconcile cash drawer with counted amount of R${(parseFloat(drawerCloseAmount) || 0).toFixed(2)} on terminal ${terminal?.id}`,
                  callback: async (supervisorId: string, supervisorName: string) => {
                    try {
                      const result = await api.cashDrawer({
                        action: 'reconcile', merchantId, userId: userName, terminalId: terminal?.id,
                        amount: parseFloat(drawerCloseAmount) || 0
                      });
                      if (result.success) {
                        await api.saveAuditEvent({
                          id: `override:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
                          merchantId,
                          category: 'SUPERVISOR_OVERRIDE',
                          action: 'CASH_DRAWER_CLOSE',
                          details: { supervisorId, supervisorName, cashierId: userName, terminalId: terminal?.id, countedAmount: parseFloat(drawerCloseAmount) || 0, reconciliation: result.reconciliation },
                          timestamp: new Date().toISOString(),
                          userId: supervisorId
                        });
                        const recon = result.reconciliation;
                        drawerOpen = false;
                        showDrawerModal = false;
                        drawerCloseAmount = '';
                        const variance = recon?.variance || 0;
                        if (Math.abs(variance) < 1) {
                          toast.success('Drawer Balanced', { description: `Expected: R${recon?.expectedCash?.toFixed(2)} | Counted: R${recon?.actualCash?.toFixed(2)}` });
                        } else {
                          toast(variance > 0 ? 'Drawer Over' : 'Drawer Short', {
                            description: `Variance: R${Math.abs(variance).toFixed(2)} ${variance > 0 ? 'over' : 'short'}. Expected: R${recon?.expectedCash?.toFixed(2)}`,
                            style: { borderColor: Math.abs(variance) > 50 ? '#ef4444' : '#f59e0b' }
                          });
                        }
                      }
                    } catch { toast.error('Failed to reconcile drawer'); }
                  }
                };
                showSupervisorModal = true;
                showDrawerModal = false;
              }}
              class="w-full py-4 bg-amber-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all"
            >
              Reconcile & Close (Requires Supervisor)
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Close Day Wizard -->
  {#if showCloseDayWizard}
    <CloseDayWizard
      merchantId={merchantId}
      userName={userName || 'Operator'}
      terminalId={terminal?.id}
      onComplete={() => showCloseDayWizard = false}
      onClose={() => showCloseDayWizard = false}
      onLockTerminal={() => {
        showCloseDayWizard = false;
        if (onLockTerminal) onLockTerminal();
        else terminalLockedByCloseDay = true;
      }}
    />
  {/if}

  <!-- Terminal Lock -->
  {#if terminalLockedByCloseDay}
    <div class="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center" role="dialog" aria-modal="true">
      <div class="text-center">
        <div class="w-24 h-24 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock class="w-12 h-12 text-amber-500" />
        </div>
        <h2 class="text-2xl font-black text-white mb-2">Terminal Locked</h2>
        <p class="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-8">Day closed &bull; Signed off by {userName || 'Operator'}</p>
        <button
          onclick={() => terminalLockedByCloseDay = false}
          class="px-8 py-3 bg-amber-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all"
        >
          Unlock Terminal
        </button>
      </div>
    </div>
  {/if}

  <!-- Supervisor Override Modal -->
  {#if showSupervisorModal && supervisorAction}
    <SupervisorOverrideModal
      action={supervisorAction.type.toUpperCase().replace(/_/g, ' ')}
      actionDescription={supervisorAction.description}
      onApprove={async (supervisorId: string, supervisorName: string) => {
        await supervisorAction!.callback(supervisorId, supervisorName);
        showSupervisorModal = false;
        supervisorAction = null;
      }}
      onReject={() => {
        const action = supervisorAction!;
        showSupervisorModal = false;
        supervisorAction = null;
        if (action.type === 'refund') {
          showRefundModal = true;
        } else if (action.type === 'cash_drawer_open' || action.type === 'cash_drawer_close') {
          showDrawerModal = true;
        }
      }}
    />
  {/if}
</div>
{/if}