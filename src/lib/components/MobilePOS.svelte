<script lang="ts">
  import {
    Search, Trash2, Minus, Plus, CreditCard, Banknote, ShoppingCart, X,
    ChevronUp, Loader2, Shield, Hash, Fingerprint,
    CheckCircle2, CloudUpload, WifiOff, Lock, ReceiptText, Zap, ScanLine,
    ChevronLeft, User, Package, Radio, Heart, FileBarChart, Phone, LogOut, Power,
    Printer
  } from 'lucide-svelte';
  import { fade, fly, scale, slide } from 'svelte/transition';
import type { UserRole, MerchantProfile } from '../types';
import { toast } from 'svelte-sonner';
import { api } from '../api';
import { calculatePromotions, type PromotionResult } from '../PromotionEngine';
import { syncManager, type SyncState } from '../SyncManager';
import { cacheProducts, getCachedProducts } from '../LocalDB';
  import MobileShiftReport from './MobileShiftReport.svelte';

  const CATEGORY_EMOJIS: Record<string, string> = {
    'Fuel': '\u26fd',
    'Dairy': '\ud83e\udd5b',
    'Mains': '\ud83c\udf54',
    'Beverage': '\ud83e\uddc3',
    'Food': '\ud83c\udf5e',
    'Workshop': '\ud83d\udd27',
    'General': '\ud83d\udce6',
  };

  // Snippet-local state
  let loyaltyInput = $state('');
  let overrideMode = $state<'choose' | 'pin' | 'biometric'>('choose');
  let overridePin = $state('');
  let overrideBioPhase = $state<'idle' | 'scanning' | 'verified'>('idle');
  let overrideBioProgress = $state(0);

  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    category?: string;
    barcode?: string;
  }

  let {
    profile,
    role,
    userName = '',
    shiftId = undefined as string | undefined,
    onLockTerminal,
    onLogout,
    onCloseShift
  }: {
    profile: MerchantProfile;
    role: UserRole;
    userName?: string;
    shiftId?: string | undefined;
    onLockTerminal?: () => void;
    onLogout?: () => void;
    onCloseShift?: () => void;
  } = $props();

  let cart = $state<CartItem[]>([]);
  let products = $state<any[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeCategory = $state('All');
  let terminal = $state<any>(null);
  let merchantConfig = $state<any>(null);
  let showSystemMenu = $state(false);
  let view = $state<'browse' | 'cart' | 'keypad' | 'card' | 'processing' | 'success' | 'declined' | 'receipt'>('browse');
  let processingPayment = $state(false);
  let transactionSuccess = $state<any>(null);
  let paymentError = $state<string | null>(null);
  let amountReceived = $state('');
  let cardPhase = $state<'idle' | 'connecting' | 'authorizing' | 'approved' | 'declined'>('idle');
  let overrideRequest = $state<{ action: 'void_item' | 'clear_cart'; targetItemId?: string } | null>(null);
  let customer = $state<any>(null);
  let redeemPoints = $state(0);
  let showLoyaltyScanner = $state(false);
  let showShiftReport = $state(false);
  let isOnline = $state(navigator.onLine);
  let syncState = $state<SyncState>({ status: 'idle', pendingCount: 0, lastSyncAt: null, lastError: null });
  let paymentIdempotencyKey = $state<string | null>(null);
  let paymentRetryCount = $state(0);
  const MAX_MANUAL_RETRIES = 3;

  let merchantId = $derived.by(() =>
    profile === 'Forecourt' ? 'merchant:M2'
    : profile === 'Workshop' ? 'merchant:M3'
    : profile === 'Restaurant' ? 'merchant:M4'
    : 'merchant:M1'
  );

  let promoResult = $derived.by<PromotionResult>(() => calculatePromotions(cart));
  let cartTotal = $derived.by(() => cart.reduce((acc: number, i: CartItem) => acc + (i.price * i.quantity), 0));
  let adjustedSubtotal = $derived.by(() => cartTotal - promoDiscount);
  let vat = $derived.by(() => Math.max(0, adjustedSubtotal - pointsDiscount) * 0.15);
  let grandTotal = $derived.by(() => Math.max(0, adjustedSubtotal - pointsDiscount + vat));
  let cartCount = $derived.by(() => cart.reduce((acc: number, i: CartItem) => acc + i.quantity, 0));

  let promoDiscount = $derived(promoResult.totalDiscount);
  let pointsDiscount = $derived.by(() => redeemPoints * 0.1);

  let categories = $derived.by<string[]>(() => {
    const cats = new Set(products.map((p: any) => p.category || 'General'));
    return ['All', ...Array.from(cats)];
  });

  let filteredProducts = $derived.by<any[]>(() => {
    let filtered = products;
    if (activeCategory !== 'All') filtered = filtered.filter((p: any) => (p.category || 'General') === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }
    return filtered;
  });

  let tendered = $derived.by(() => parseFloat(amountReceived) || 0);
  let changeDue = $derived.by(() => tendered - grandTotal);
  let isSufficient = $derived.by(() => tendered >= grandTotal && amountReceived !== '');

  let quickTenders = $derived.by(() => {
    const qt: { label: string; value: number }[] = [
      { label: 'Exact', value: Math.ceil(grandTotal * 100) / 100 }
    ];
    [10, 20, 50, 100, 200, 500].forEach(d => {
      const rounded = Math.ceil(grandTotal / d) * d;
      if (rounded > grandTotal && !qt.find(q => q.value === rounded)) {
        qt.push({ label: `R${rounded}`, value: rounded });
      }
    });
    return qt.slice(0, 4);
  });

  $effect(() => {
    const onOnline = () => isOnline = true;
    const onOffline = () => isOnline = false;
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  });

  $effect(() => {
    syncManager.start(15000);
    const unsub = syncManager.subscribe((s: SyncState) => syncState = s);
    return () => { syncManager.stop(); unsub(); };
  });

  $effect(() => {
    loadProducts();
    initTerminal();
    loadMerchantConfig();
  });

  async function loadMerchantConfig() {
    try {
      const config = await api.getMerchantConfig(merchantId, 'config');
      if (config) merchantConfig = config;
    } catch (e) { console.error('Failed to load merchant config:', e); }
  }

  async function initTerminal() {
    try {
      let tId = localStorage.getItem(`roxton_terminal_id_${merchantId}_mobile`);
      if (!tId) {
        tId = `MPOS-${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem(`roxton_terminal_id_${merchantId}_mobile`, tId);
      }
      terminal = { id: tId, name: 'Mobile POS', type: 'Mobile', version: '4.2.1', status: 'Online' };
    } catch (e) { console.error('Terminal init failed:', e); }
  }

  async function loadProducts() {
    try {
      loading = true;
      let data: any[] = [];
      if (isOnline) {
        data = await api.getStock(merchantId);
        if (Array.isArray(data) && data.length > 0) {
          try { await cacheProducts(data.map((item: any) => ({
            id: item.id, merchantId: item.merchantId || merchantId,
            name: item.name, price: item.selling || 0,
            category: item.category || 'General', barcode: item.barcode || '',
            cachedAt: Date.now()
          }))); } catch {}
        }
      } else {
        try {
          const cached = await getCachedProducts(merchantId);
          data = cached.map((c: any) => ({ ...c, selling: c.price }));
          if (data.length > 0) toast('Loaded from offline cache', { description: `${data.length} products` });
        } catch {}
      }
      if (Array.isArray(data)) {
        const filteredData = data.filter((item: any) => {
          if (profile === 'Forecourt') return item.category === 'Fuel' || item.merchantId === 'merchant:M2';
          if (profile === 'Workshop') return item.category === 'Workshop' || item.merchantId === 'merchant:M3';
          if (profile === 'Restaurant') return item.category === 'Food' || item.category === 'Beverage';
          return item.category !== 'Fuel' && item.category !== 'Workshop';
        });
        products = filteredData.map((item: any) => ({
          id: item.id, name: item.name, price: item.selling || 0,
          category: item.category || 'General', barcode: item.barcode || '', quantity: 0
        }));
      }
    } catch { toast.error('Failed to load products'); }
    finally { loading = false; }
  }

  let scanBuffer = $state('');
  let addToCartFn = $state<(item: any) => void>(() => {});
  $effect(() => { addToCartFn = addToCart; });

  $effect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) scanBuffer += e.key;
      setTimeout(() => {
        const code = scanBuffer.trim();
        if (code.length >= 5) {
          const product = products.find((p: any) => p.barcode === code);
          if (product) {
            addToCartFn(product);
            toast.success(`Scanned: ${product.name}`, { description: `Barcode: ${code}` });
          } else toast.error(`Unknown barcode: ${code}`);
        }
        scanBuffer = '';
      }, 80);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  $effect(() => {
    if (searchQuery && filteredProducts.length === 1 && searchQuery === filteredProducts[0].barcode) {
      addToCartFn(filteredProducts[0]);
      searchQuery = '';
      toast.success(`Scanned: ${filteredProducts[0].name}`);
    }
  });

  function addToCart(item: any) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      cart = cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      cart = [...cart, { ...item, quantity: 1 }];
    }
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function removeFromCart(id: string) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    if (item.quantity === 1) { overrideRequest = { action: 'void_item', targetItemId: id }; return; }
    cart = cart.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
  }

  function requestClearCart() { if (cart.length > 0) overrideRequest = { action: 'clear_cart' }; }

  async function handleOverrideSubmit(method: 'biometric' | 'pin') {
    if (!overrideRequest) return;
    if (overrideRequest.action === 'void_item' && overrideRequest.targetItemId) {
      cart = cart.filter(i => i.id !== overrideRequest.targetItemId);
      toast.success('Item voided', { description: `Override via ${method}` });
    } else if (overrideRequest.action === 'clear_cart') {
      cart = [];
      toast.success('Cart cleared', { description: `Override via ${method}` });
    }
    api.saveAuditEvent({
      merchantId,
      action: overrideRequest.action === 'void_item' ? 'SUPERVISOR_OVERRIDE_VOID' : 'SUPERVISOR_OVERRIDE_CLEAR',
      category: 'OVERRIDE', severity: 'WARNING', terminalId: terminal?.id,
      details: { method, action: overrideRequest.action, cashier: userName }
    }).catch(() => {});
    overrideRequest = null;
  }

  async function finalizeSale(method: 'Card' | 'Cash', retryKey?: string) {
    if (processingPayment) return;
    processingPayment = true;
    paymentError = null;
    const iKey = retryKey || paymentIdempotencyKey || crypto.randomUUID();
    if (!retryKey) { paymentIdempotencyKey = iKey; paymentRetryCount = 0; }
    try {
      view = 'processing';
      if (method === 'Card') { cardPhase = 'connecting'; await new Promise(r => setTimeout(r, 1000)); cardPhase = 'authorizing'; }
      if (!isOnline) {
        const txn = {
          id: `TXN-${Math.floor(Math.random() * 90000) + 10000}`,
          amount: grandTotal, method, time: new Date().toLocaleTimeString(), status: 'Queued',
          change: method === 'Cash' ? Math.max(0, parseFloat(amountReceived) - grandTotal) : 0,
          items: cart, merchantId, pointsRedeemed: redeemPoints,
          promoDiscount, appliedPromotions: promoResult.applied,
          cashierName: userName || 'System', terminalId: terminal?.id,
          offlineQueued: true, idempotencyKey: iKey
        };
        await syncManager.queue(txn);
        toast('Transaction queued offline');
        transactionSuccess = txn; view = 'success';
        cart = []; customer = null; redeemPoints = 0; amountReceived = ''; paymentIdempotencyKey = null;
        return;
      }
      const result = await api.processPayment({
        merchantId, items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        paymentMethod: method, amountTendered: method === 'Cash' ? parseFloat(amountReceived) || 0 : undefined,
        cashierName: userName || 'System', terminalId: terminal?.id, shiftId: shiftId || undefined,
        customerId: customer?.id || undefined, pointsToRedeem: redeemPoints > 0 ? redeemPoints : undefined,
        appliedPromotions: promoResult.applied, promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        idempotencyKey: iKey
      });
      if (!result.success) {
        paymentError = result.details ? (Array.isArray(result.details) ? result.details.join('; ') : result.details) : result.error || 'Payment declined';
        if (result._retriable && paymentRetryCount < MAX_MANUAL_RETRIES) paymentIdempotencyKey = iKey;
        view = 'declined'; return;
      }
      if (method === 'Card') { cardPhase = 'approved'; await new Promise(r => setTimeout(r, 600)); }
      const txn = { ...result.transaction, time: new Date().toLocaleTimeString(), offlineQueued: false };
      transactionSuccess = txn;
      view = merchantConfig?.autoPrintReceipts ? 'receipt' : 'success';
      cart = []; customer = null; redeemPoints = 0; amountReceived = ''; paymentIdempotencyKey = null; paymentRetryCount = 0;
      loadProducts();
      toast.success('Sale approved');
    } catch (e: any) {
      paymentError = e?.message || 'Transaction failed';
      paymentIdempotencyKey = iKey;
      view = 'declined';
    } finally { processingPayment = false; }
  }

  function retryPayment(method: 'Card' | 'Cash') {
    if (!paymentIdempotencyKey || paymentRetryCount >= MAX_MANUAL_RETRIES) return;
    paymentRetryCount++;
    toast.info(`Retrying (attempt ${paymentRetryCount + 1})...`);
    finalizeSale(method, paymentIdempotencyKey);
  }

  function resetPayment() { view = 'browse'; cardPhase = 'idle'; paymentError = null; paymentIdempotencyKey = null; paymentRetryCount = 0; transactionSuccess = null; amountReceived = ''; }

  async function handleLoyaltyLookup(identifier: string) {
    try {
      const prof = await api.getLoyaltyProfile(identifier);
      customer = prof;
      toast.success(`Loyalty: ${prof.tier} Member`, { description: `${prof.points} points available` });
    } catch { toast.error('Customer not found'); }
  }

  function handleLoyaltyRedeem(pts: number) { if (customer) redeemPoints = pts; }
  function handleLoyaltyClear() { customer = null; redeemPoints = 0; toast('Loyalty card removed'); }

  function keypadPress(k: string) {
    if (navigator.vibrate) navigator.vibrate(10);
    if (k === 'CLR') { amountReceived = ''; return; }
    if (k === 'DEL') { amountReceived = amountReceived.slice(0, -1); return; }
    if (k === '.') { amountReceived = amountReceived.includes('.') ? amountReceived : (amountReceived || '0') + '.'; return; }
    const parts = amountReceived.split('.');
    if (parts[1] && parts[1].length >= 2) return;
    amountReceived += k;
  }

  function printReceipt(txn: any) {
    let iframe = document.getElementById('print-iframe-mobile') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe-mobile';
      iframe.style.cssText = 'position:fixed;right:100%;bottom:100%;width:0;height:0;border:none;';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) { toast.error('Print context unavailable'); return; }
    const itemsHtml = (txn.items || []).map((item: any) =>
      `<div style="display:flex;justify-content:space-between;font-size:10px"><span style="flex:1;overflow:hidden;white-space:nowrap;padding-right:8px"><b>${item.quantity}x</b> ${item.name}</span><span style="font-weight:bold">R ${(item.price * item.quantity).toFixed(2)}</span></div>`
    ).join('');
    doc.open();
    doc.write(`<html><head><title>RECEIPT_${txn.id}</title><style>
      @page{margin:0;size:80mm auto}body{margin:0;padding:0 5mm 10mm;font-family:'Courier New',monospace;background:white;color:black;font-size:10pt;width:72mm}.tc{text-align:center}.bb{border-bottom:1px dashed #000;margin:5px 0}
    </style></head><body>
      <div class="tc"><p style="font-size:10px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#555">Roxton Retail</p>
      <p style="font-size:14px;font-weight:900">RECEIPT</p><div class="bb"></div><p style="font-size:9px;color:#888">${new Date().toLocaleString()}</p></div>
      ${itemsHtml}<div class="bb"></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:900"><span>TOTAL</span><span>R ${txn.amount?.toFixed(2)}</span></div>
      ${txn.method === 'Cash' && txn.change > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:900"><span>CHANGE</span><span>R ${txn.change?.toFixed(2)}</span></div>` : ''}
      <div class="tc" style="margin-top:10px;font-size:9px;color:#888"><p>Ref: ${txn.id}</p><p>${txn.method} Payment</p></div>
      <div class="tc" style="margin-top:16px;font-size:8px;color:#aaa;text-transform:uppercase;letter-spacing:2px">Powered by Roxton OS v4.2</div>
      <script>window.onload=()=>{setTimeout(()=>{window.print()},400)}<\/script></body></html>`);
    doc.close();
  }
</script>

{#if view === 'processing'}
  <div class="fixed inset-0 z-[600] bg-neutral-950 flex flex-col items-center justify-center p-8 text-center safe-area-inset">
    <Loader2 class="w-16 h-16 text-amber-400 animate-spin mb-6" />
    <p class="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-2">{cardPhase === 'connecting' ? 'Connecting...' : cardPhase === 'authorizing' ? 'Authorizing...' : 'Processing...'}</p>
    <p class="text-4xl font-black text-white tabular-nums">R {grandTotal.toFixed(2)}</p>
    <p class="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mt-3">Do not close app</p>
  </div>

{:else if view === 'success' && transactionSuccess}
  <div class="fixed inset-0 z-[600] bg-emerald-600 flex flex-col items-center justify-center p-8 text-white text-center safe-area-inset">
    <div transition:scale={{start: 0.7, duration: 200}} class="w-full max-w-sm">
      <CheckCircle2 class="w-20 h-20 mx-auto mb-4" />
      <h3 class="text-3xl font-black mb-1">Approved</h3>
      <p class="text-emerald-100 text-xs font-black uppercase tracking-widest mb-1">{transactionSuccess.receiptNo || transactionSuccess.id}</p>
      {#if transactionSuccess.method === 'Cash' && transactionSuccess.change > 0}
        <div class="bg-white/15 rounded-2xl p-4 mt-4 mb-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">Change Due</p>
          <p class="text-3xl font-black tabular-nums">R {transactionSuccess.change.toFixed(2)}</p>
        </div>
      {/if}
      {#if transactionSuccess.offlineQueued}
        <p class="text-amber-300 text-[10px] font-black uppercase tracking-widest mt-2">Queued Offline</p>
      {/if}
      <div class="mt-8 space-y-3">
        <button onclick={() => view = 'receipt'} class="w-full py-4 bg-white text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"><ReceiptText class="w-4 h-4" /> View Receipt</button>
        <button onclick={resetPayment} class="w-full py-4 bg-emerald-700/50 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform">New Sale</button>
      </div>
    </div>
  </div>

{:else if view === 'receipt' && transactionSuccess}
  <div class="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
    <div transition:fly={{y: 40, duration: 300, opacity: 0}} class="w-full max-w-xs">
      <div class="bg-[#FFFEF5] w-full shadow-2xl overflow-hidden rounded-lg p-5" style="font-family: 'Courier New', monospace">
        <div class="text-center mb-4">
          <p class="text-[10px] font-bold tracking-[0.3em] text-neutral-600 uppercase">Roxton Retail</p>
          <p class="text-[14px] font-black tracking-tight text-black mt-1">RECEIPT</p>
          <div class="border-b border-dashed border-neutral-300 my-2"></div>
          <p class="text-[9px] text-neutral-500">{new Date().toLocaleString()}</p>
        </div>
        <div class="space-y-1">
          {#each transactionSuccess.items || [] as item}
            <div class="flex justify-between text-[10px] text-black">
              <span class="flex-1 truncate pr-2"><b>{item.quantity}x</b> {item.name}</span>
              <span class="font-bold tabular-nums whitespace-nowrap">R {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          {/each}
        </div>
        <div class="border-b border-dashed border-neutral-300 my-3"></div>
        <div class="space-y-1">
          <div class="flex justify-between text-[12px] font-black text-black"><span>TOTAL</span><span class="tabular-nums">R {transactionSuccess.amount?.toFixed(2)}</span></div>
          {#if transactionSuccess.method === 'Cash' && transactionSuccess.change > 0}
            <div class="flex justify-between text-[11px] font-black text-black"><span>CHANGE</span><span class="tabular-nums">R {transactionSuccess.change?.toFixed(2)}</span></div>
          {/if}
        </div>
        <div class="text-center mt-6">
          <p class="text-[9px] text-neutral-500">Ref: {transactionSuccess.id}</p>
          <p class="text-[9px] text-neutral-500">{transactionSuccess.method} Payment</p>
          {#if transactionSuccess.offlineQueued}
            <p class="text-[9px] text-amber-600 font-bold mt-1">** OFFLINE - PENDING SYNC **</p>
          {/if}
          <div class="mt-4 flex justify-center h-10 w-full overflow-hidden bg-[#FFFEF5] gap-[1px] border border-neutral-100">
            {#each (transactionSuccess.id || '').split('') as c, i}
              {@const weight = (c.charCodeAt(0) % 3) + 1}
              <div class={i % 2 === 0 ? 'bg-black' : 'bg-transparent'} style="width: {weight}px; height: 100%"></div>
            {/each}
          </div>
          <p class="text-[8px] text-neutral-400 mt-2 tracking-[0.2em]">{transactionSuccess.id}</p>
        </div>
        <div class="text-center mt-6 pt-4 border-t border-dashed border-neutral-300">
          <p class="text-[8px] text-neutral-400 uppercase tracking-widest">Powered by Roxton OS v4.2</p>
        </div>
      </div>
      <div class="flex flex-col gap-2 mt-4 w-full">
        <div class="grid grid-cols-2 gap-2">
          <button onclick={() => printReceipt(transactionSuccess)} class="py-4 bg-amber-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"><Printer class="w-3 h-3" /> Print</button>
          <button onclick={() => { const url = `https://clintpos.com/verify/${transactionSuccess.id}`; if (navigator.share) navigator.share({ title: 'Roxton Receipt', text: `Receipt for R ${transactionSuccess.amount.toFixed(2)} at Roxton Retail`, url }).catch(() => {}); else { navigator.clipboard.writeText(url); toast('URL copied to clipboard'); } }} class="py-4 bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"><Zap class="w-3 h-3" /> Share</button>
        </div>
        <button onclick={resetPayment} class="w-full py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform">New Transaction</button>
      </div>
    </div>
  </div>

{:else if view === 'declined'}
  <div class="fixed inset-0 z-[600] bg-neutral-950 flex flex-col items-center justify-center p-8 text-center safe-area-inset">
    <div transition:scale={{start: 0.8, duration: 200}} class="w-full max-w-sm">
      <div class="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><X class="w-10 h-10 text-rose-500" /></div>
      <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-2">Payment Declined</h4>
      <p class="text-3xl font-black text-white mb-4 tabular-nums">R {grandTotal.toFixed(2)}</p>
      {#if paymentError}
        <div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 text-left"><p class="text-rose-400 text-xs font-bold">{paymentError}</p></div>
      {/if}
      {#if paymentIdempotencyKey}
        <div class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-4 flex items-center justify-center gap-2">
          <Shield class="w-3 h-3 text-amber-400" />
          <p class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Retry {paymentRetryCount}/{MAX_MANUAL_RETRIES}</p>
        </div>
      {/if}
      <button onclick={() => retryPayment('Card')} disabled={paymentRetryCount >= MAX_MANUAL_RETRIES} class="w-full py-4 bg-white text-neutral-900 rounded-2xl font-black text-xs uppercase tracking-widest mb-3 active:scale-95 disabled:opacity-30">{paymentRetryCount >= MAX_MANUAL_RETRIES ? 'Max Retries' : `Retry (Attempt ${paymentRetryCount + 1})`}</button>
      <button onclick={resetPayment} class="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
    </div>
  </div>

{:else if view === 'keypad'}
  <div class="fixed inset-0 z-[500] bg-neutral-950 flex flex-col safe-area-inset">
    <div class="px-4 pt-4 pb-2">
      <div class="flex items-center justify-between mb-3">
        <button onclick={() => view = 'cart'} class="flex items-center gap-1 text-neutral-400 active:text-white"><ChevronLeft class="w-5 h-5" /><span class="text-xs font-black uppercase tracking-widest">Back</span></button>
        <span class="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Cash Entry</span>
      </div>
      <div class="bg-neutral-800 rounded-2xl p-4 mb-3 flex items-center justify-between">
        <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Total Due</span>
        <span class="text-2xl font-black text-white tabular-nums">R {grandTotal.toFixed(2)}</span>
      </div>
      <div class="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {#each quickTenders as qt}
          <button onclick={() => { amountReceived = qt.value.toFixed(2); if (navigator.vibrate) navigator.vibrate(15); }} class="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all active:scale-90 {amountReceived === qt.value.toFixed(2) ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300 border border-neutral-700'}">{qt.label}</button>
        {/each}
      </div>
      <div class="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 mb-2">
        <p class="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1">Amount Tendered</p>
        <p class="text-4xl font-black tabular-nums tracking-tight {amountReceived === '' ? 'text-neutral-700' : isSufficient ? 'text-emerald-400' : 'text-white'}">R {amountReceived || '0.00'}</p>
        {#if isSufficient}
          <p in:fly={{y: 5, duration: 200}} class="text-emerald-400 text-sm font-black mt-1 tabular-nums">Change: R {changeDue.toFixed(2)}</p>
        {:else if amountReceived !== ''}
          <p class="text-rose-400 text-[10px] font-black mt-1 tabular-nums">Short: R {Math.abs(changeDue).toFixed(2)}</p>
        {/if}
      </div>
    </div>
    <div class="flex-1 px-4 pb-4 flex flex-col justify-end">
      <div class="grid grid-cols-3 gap-2 mb-3">
        {#each ['1','2','3','4','5','6','7','8','9','.','0','DEL'] as k}
          <button onclick={() => keypadPress(k)} class="h-16 rounded-2xl font-black text-xl transition-all active:scale-90 {k === 'DEL' ? 'bg-neutral-800 text-neutral-400 text-base' : k === '.' ? 'bg-neutral-800 text-white' : 'bg-neutral-800/80 text-white border border-neutral-700/50'}">{k === 'DEL' ? '<' : k}</button>
        {/each}
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick={() => keypadPress('CLR')} class="h-14 rounded-2xl bg-neutral-800 text-neutral-400 font-black text-xs uppercase tracking-widest active:scale-95">Clear</button>
        <button onclick={() => isSufficient && !processingPayment && finalizeSale('Cash')} disabled={!isSufficient || processingPayment} class="h-14 rounded-2xl bg-amber-500 text-black font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-30 disabled:bg-neutral-700 disabled:text-neutral-500 flex items-center justify-center gap-2">
          {#if processingPayment}<Loader2 class="w-4 h-4 animate-spin" />{:else}<Banknote class="w-4 h-4" />{/if} Accept Cash
        </button>
      </div>
    </div>
  </div>

{:else if view === 'card'}
  <div class="fixed inset-0 z-[500] bg-neutral-950 flex flex-col items-center justify-center p-8 text-center safe-area-inset">
    <div transition:scale={{start: 0.9, duration: 200}} class="w-full max-w-sm">
      <div class="relative w-20 h-20 mx-auto mb-6">
        <Radio class="w-20 h-20 text-indigo-400 animate-pulse" />
        <span class="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping"></span>
      </div>
      <p class="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2">Present Card or Phone</p>
      <p class="text-4xl font-black text-white mb-2 tabular-nums">R {grandTotal.toFixed(2)}</p>
      <p class="text-neutral-600 text-[9px] font-bold uppercase tracking-widest mb-8">Tap / Insert / Swipe</p>
      <button onclick={() => finalizeSale('Card')} disabled={processingPayment} class="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"><CreditCard class="w-5 h-5" /> Process Payment</button>
      <button onclick={() => view = 'cart'} class="mt-4 text-neutral-500 text-[10px] font-black uppercase tracking-widest active:text-white">Cancel</button>
    </div>
  </div>

{:else if view === 'cart'}
  <div class="fixed inset-0 z-[400] bg-neutral-950 flex flex-col safe-area-inset">
    <div class="px-4 pt-4 pb-3 flex items-center justify-between border-b border-neutral-800">
      <button onclick={() => view = 'browse'} class="flex items-center gap-1 text-neutral-400 active:text-white"><ChevronLeft class="w-5 h-5" /><span class="text-xs font-black uppercase tracking-widest">Products</span></button>
      <div class="flex items-center gap-2"><ShoppingCart class="w-4 h-4 text-amber-400" /><span class="text-xs font-black text-white uppercase tracking-widest">{cartCount} Items</span></div>
      <button onclick={requestClearCart} disabled={cart.length === 0} class="p-2 text-neutral-600 hover:text-rose-500 disabled:opacity-20 active:scale-90"><Trash2 class="w-4 h-4" /></button>
    </div>
    <div class="px-4 pt-2 pb-1 flex items-center justify-between">
      <p class="text-[8px] font-bold text-neutral-600 uppercase tracking-wider">&larr; Swipe left to void</p>
      <button onclick={() => showLoyaltyScanner = true} class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-90 {customer ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}"><Heart class="w-3 h-3" />{customer ? `${customer.points} pts` : 'Loyalty'}</button>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-2">
      {#if cart.length === 0}
        <div class="h-full flex flex-col items-center justify-center opacity-30" transition:fade><ScanLine class="w-12 h-12 text-neutral-600 mb-3" /><p class="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Cart Empty</p></div>
      {:else}
        {#each cart as item (item.id)}
          {@const badges = promoResult.itemBadges[item.id] || []}
          {@const itemPromo = promoResult.applied.find((a: any) => a.itemId === item.id)}
          <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex items-center gap-3" transition:slide={{duration: 200}}>
            <div class="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center text-lg shrink-0">{CATEGORY_EMOJIS[item.category || 'General'] || '\ud83d\udce6'}</div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-black text-white truncate">{item.name}</p>
              <div class="flex items-center gap-2">
                <p class="text-[10px] font-black text-amber-400 tabular-nums">R {item.price.toFixed(2)}</p>
                {#if badges.length > 0}<span class="px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[7px] font-black uppercase">{badges[0]}</span>{/if}
              </div>
              {#if itemPromo}<p class="text-[8px] font-bold text-emerald-500 mt-0.5">-R {itemPromo.discount.toFixed(2)} saved</p>{/if}
            </div>
            <div class="flex items-center bg-neutral-800 rounded-xl border border-neutral-700 p-0.5">
              <button onclick={() => removeFromCart(item.id)} class="p-2 active:scale-90 rounded-lg"><Minus class="w-3.5 h-3.5 text-neutral-400" /></button>
              <span class="w-8 text-center text-sm font-black text-white tabular-nums">{item.quantity}</span>
              <button onclick={() => addToCart(item)} class="p-2 active:scale-90 rounded-lg"><Plus class="w-3.5 h-3.5 text-neutral-400" /></button>
            </div>
            <p class="text-sm font-black text-white tabular-nums w-16 text-right">R {(item.price * item.quantity).toFixed(2)}</p>
          </div>
        {/each}
      {/if}
    </div>
    {#if cart.length > 0}
      <div class="px-4 py-4 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-xl space-y-3">
        <div class="space-y-1.5">
          <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500"><span>Subtotal</span><span class="text-neutral-300 tabular-nums">R {cartTotal.toFixed(2)}</span></div>
          {#if promoDiscount > 0}<div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-500"><span class="flex items-center gap-1"><Zap class="w-3 h-3" /> Promotions</span><span class="tabular-nums">-R {promoDiscount.toFixed(2)}</span></div>{/if}
          {#if redeemPoints > 0}<div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-rose-400"><span class="flex items-center gap-1"><Heart class="w-3 h-3" /> Loyalty ({redeemPoints} pts)</span><span class="tabular-nums">-R {pointsDiscount.toFixed(2)}</span></div>{/if}
          <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500"><span>VAT (15%)</span><span class="text-neutral-300 tabular-nums">R {vat.toFixed(2)}</span></div>
          <div class="pt-2 border-t border-dashed border-neutral-700 flex justify-between items-center"><span class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total</span><span class="text-2xl font-black text-white tabular-nums">R {grandTotal.toFixed(2)}</span></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button onclick={() => view = 'card'} class="py-4 bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 border border-neutral-700"><CreditCard class="w-4 h-4 text-indigo-400" /> Card</button>
          <button onclick={() => view = 'keypad'} class="py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95"><Banknote class="w-4 h-4" /> Cash</button>
        </div>
      </div>
    {/if}

    {#if showLoyaltyScanner}
      <LoyaltyScannerOverlay {customer} {redeemPoints} onLookup={handleLoyaltyLookup} onRedeem={handleLoyaltyRedeem} onClear={handleLoyaltyClear} onClose={() => showLoyaltyScanner = false} />
    {/if}
    {#if overrideRequest}
      <SupervisorOverrideOverlay action={overrideRequest.action} onSubmit={handleOverrideSubmit} onCancel={() => overrideRequest = null} />
    {/if}
  </div>

{:else}
  <div class="fixed inset-0 z-[100] bg-neutral-950 flex flex-col safe-area-inset font-mono">
    <div class="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-sm">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center"><ShoppingCart class="w-3.5 h-3.5 text-amber-400" /></div>
        <div><p class="text-[9px] font-black text-neutral-600 uppercase tracking-[0.15em] leading-none">Roxton Mobile</p><p class="text-[10px] font-black text-white leading-none mt-0.5">{terminal?.id || 'MPOS'}</p></div>
      </div>
      <div class="flex items-center gap-2">
        {#if syncState.pendingCount > 0}<div class="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg"><CloudUpload class="w-3 h-3 text-amber-400 animate-pulse" /><span class="text-[8px] font-black text-amber-400">{syncState.pendingCount}</span></div>{/if}
        {#if !isOnline}<div class="flex items-center gap-1 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg"><WifiOff class="w-3 h-3 text-rose-400" /><span class="text-[8px] font-black text-rose-400">OFF</span></div>{/if}
        <div class="flex items-center gap-1 px-2 py-1 bg-neutral-800 rounded-lg"><User class="w-3 h-3 text-neutral-500" /><span class="text-[8px] font-black text-neutral-400 uppercase truncate max-w-[60px]">{userName || 'User'}</span></div>
        {#if shiftId}<button onclick={() => showShiftReport = true} class="p-2 text-neutral-600 active:text-amber-400"><FileBarChart class="w-4 h-4" /></button>{/if}
        {#if onLockTerminal}<button onclick={onLockTerminal} class="p-2 text-neutral-600 active:text-amber-400"><Lock class="w-4 h-4" /></button>{/if}
        <button onclick={() => showSystemMenu = true} class="p-2 text-neutral-600 active:text-amber-400" aria-label="System menu"><Power class="w-4 h-4" /></button>
      </div>
    </div>

    <div class="px-4 py-3 bg-black/60 border-b border-white/5">
      <div class="relative group">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500"></Search>
        <input type="text" placeholder="SYSTEM_SEARCH_OR_SCAN..." class="w-full pl-11 pr-4 py-3.5 bg-neutral-900/80 border border-neutral-800 rounded-xl font-black text-[11px] text-white outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 placeholder-neutral-700 transition-all uppercase tracking-widest" bind:value={searchQuery} />
        {#if searchQuery}<button onclick={() => searchQuery = ''} class="absolute right-3 top-1/2 -translate-y-1/2 p-1 active:scale-90"><X class="w-4 h-4 text-neutral-500" /></button>{/if}
      </div>
    </div>

    <div class="px-4 py-3 border-b border-white/5 bg-black/40">
      <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {#each categories as cat}
          <button onclick={() => activeCategory = cat} class="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shrink-0 transition-all active:scale-95 border {activeCategory === cat ? 'bg-amber-400 text-black border-amber-500 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'bg-neutral-900 text-neutral-500 border-neutral-800'}">
            {#if cat !== 'All'}<span class="mr-2 opacity-60 scale-125 inline-block">{CATEGORY_EMOJIS[cat] || '\ud83d\udce6'}</span>{/if}{cat}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 pb-24">
      {#if loading}
        <div class="flex items-center justify-center h-40"><Loader2 class="w-8 h-8 text-amber-400 animate-spin" /></div>
      {:else if filteredProducts.length === 0}
        <div class="flex flex-col items-center justify-center h-40 opacity-30"><Package class="w-10 h-10 text-neutral-600 mb-2" /><p class="text-[10px] font-black text-neutral-600 uppercase tracking-widest">No Products Found</p></div>
      {:else}
        <div class="grid grid-cols-2 gap-2">
          {#each filteredProducts as item, idx}
            {@const badges = promoResult.itemBadges[item.id] || []}
            {@const inCart = cart.find(c => c.id === item.id)}
            <button in:fly={{y: 15, duration: 300, delay: idx * 15, opacity: 0}} onclick={() => addToCart(item)} class="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 text-left relative overflow-hidden active:scale-[0.97] active:border-amber-500/30 transition-all">
              {#if badges.length > 0}<span class="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500 text-black rounded text-[6px] font-black uppercase tracking-wider">{badges[0]}</span>{/if}
              {#if inCart}<span class="absolute top-2 left-2 w-5 h-5 bg-amber-500 text-black rounded-full text-[9px] font-black flex items-center justify-center">{inCart.quantity}</span>{/if}
              <div class="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-2xl mb-2 mx-auto">{CATEGORY_EMOJIS[item.category || 'General'] || '\ud83d\udce6'}</div>
              <p class="text-[9px] font-black uppercase tracking-tight text-neutral-500 leading-none mb-0.5">{item.category}</p>
              <p class="text-[11px] font-black text-white truncate leading-tight mb-1">{item.name}</p>
              <p class="text-sm font-black text-amber-400 tabular-nums">R {item.price.toFixed(2)}</p>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if cart.length > 0}
      <div in:fly={{y: 100, duration: 300, opacity: 0}} class="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-6 pt-2 bg-gradient-to-t from-black via-black/90 to-transparent">
        <button onclick={() => view = 'cart'} class="w-full bg-amber-400 text-black rounded-2xl px-6 py-5 flex items-center justify-between shadow-[0_0_30px_rgba(250,204,21,0.2)] active:scale-95 transition-all border-b-4 border-amber-600 group">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center"><ShoppingCart class="w-5 h-5" /></div>
            <div class="text-left font-mono"><p class="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 leading-none mb-1">REGISTERED_UNITS</p><p class="text-xs font-black leading-none">{cartCount} {cartCount === 1 ? 'ITEM' : 'ITEMS'}</p></div>
          </div>
          <div class="flex items-center gap-3 bg-black/5 px-4 py-2 rounded-xl border border-black/5"><span class="text-xl font-black tabular-nums font-mono tracking-tighter">R {grandTotal.toFixed(2)}</span><ChevronUp class="w-5 h-5 opacity-40 group-hover:-translate-y-1 transition-transform" /></div>
        </button>
      </div>
    {/if}

    {#if overrideRequest}
      <SupervisorOverrideOverlay action={overrideRequest.action} onSubmit={handleOverrideSubmit} onCancel={() => overrideRequest = null} />
    {/if}
    {#if showLoyaltyScanner}
      <LoyaltyScannerOverlay {customer} {redeemPoints} onLookup={handleLoyaltyLookup} onRedeem={handleLoyaltyRedeem} onClear={handleLoyaltyClear} onClose={() => showLoyaltyScanner = false} />
    {/if}
    {#if showShiftReport && shiftId}
      <div class="fixed inset-0 z-[300]"><MobileShiftReport shiftId={shiftId} onClose={() => showShiftReport = false} /></div>
    {/if}
    {#if showSystemMenu}
      <div class="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end justify-center" role="dialog" onclick={() => showSystemMenu = false} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && (showSystemMenu = false)}>
        <div in:fly={{y: '100%', duration: 200}} class="w-full max-w-md bg-neutral-900 border-t border-neutral-700 rounded-t-3xl overflow-hidden" role="dialog" onclick={(e: MouseEvent) => e.stopPropagation()} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && (showSystemMenu = false)}>
          <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1 bg-neutral-700 rounded-full"></div></div>
          <div class="px-6 pt-3 pb-4 border-b border-neutral-800">
            <h3 class="text-sm font-black text-white uppercase tracking-widest font-mono">System</h3>
            <p class="text-[10px] text-neutral-500 font-mono mt-0.5">Terminal actions & session control</p>
          </div>
          <div class="p-4 space-y-2">
            {#if onLockTerminal}
              <button onclick={() => { showSystemMenu = false; onLockTerminal(); }} class="w-full flex items-center gap-4 px-4 py-4 bg-neutral-800/60 hover:bg-neutral-800 rounded-2xl transition-all">
                <div class="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center"><Lock class="w-5 h-5 text-amber-400" /></div>
                <div class="flex-1 text-left"><p class="text-sm font-black text-white font-mono">Lock Terminal</p><p class="text-[10px] text-neutral-500 font-mono">Require PIN to resume</p></div>
              </button>
            {/if}
            {#if shiftId && onCloseShift}
              <button onclick={() => { showSystemMenu = false; onCloseShift(); }} class="w-full flex items-center gap-4 px-4 py-4 bg-neutral-800/60 hover:bg-neutral-800 rounded-2xl transition-all">
                <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center"><FileBarChart class="w-5 h-5 text-blue-400" /></div>
                <div class="flex-1 text-left"><p class="text-sm font-black text-white font-mono">End Shift</p><p class="text-[10px] text-neutral-500 font-mono">Close shift & finalize timesheet</p></div>
              </button>
            {/if}
            <div class="h-px bg-neutral-800 my-1"></div>
            {#if onLogout}
              <button onclick={() => { if (cart.length > 0 && !confirm('You have items in your cart. Are you sure you want to logout? Unsaved items will be lost.')) return; showSystemMenu = false; onLogout(); }} class="w-full flex items-center gap-4 px-4 py-4 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl transition-all border border-rose-500/20">
                <div class="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center"><LogOut class="w-5 h-5 text-rose-400" /></div>
                <div class="flex-1 text-left"><p class="text-sm font-black text-rose-400 font-mono">LOGOUT</p><p class="text-[10px] text-rose-400/60 font-mono">Sign out & return to login</p></div>
              </button>
            {/if}
          </div>
          <div class="px-4 pb-6 pt-1"><button onclick={() => showSystemMenu = false} class="w-full py-3.5 bg-neutral-800 hover:bg-neutral-700 rounded-2xl text-sm font-black text-neutral-300 uppercase tracking-widest font-mono transition-all">Cancel</button></div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- LOYALTY SCANNER OVERLAY (reusable via snippet) -->
{#snippet LoyaltyScannerOverlay({ customer, redeemPoints, onLookup, onRedeem, onClear, onClose }: { customer: any; redeemPoints: number; onLookup: (identifier: string) => Promise<void>; onRedeem: (pts: number) => void; onClear: () => void; onClose: () => void })}
  <div class="fixed inset-0 z-[650] bg-black/95 backdrop-blur-xl flex items-end justify-center p-0">
    <div in:fly={{y: '100%', duration: 300}} class="bg-neutral-900 border-t border-amber-500/20 w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
      <div class="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-4"></div>
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/20"><Heart class="w-5 h-5 text-rose-400" /></div>
        <div class="flex-1 min-w-0"><h3 class="text-sm font-black text-white uppercase tracking-wider">Loyalty Card</h3><p class="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Scan card or enter phone/email</p></div>
        <button onclick={onClose} class="p-2 hover:bg-white/5 rounded-lg active:scale-90"><X class="w-5 h-5 text-neutral-500" /></button>
      </div>
      <div class="relative mb-4">
        <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
        <input type="text" placeholder="Phone, email, or scan card..." class="w-full pl-10 pr-20 py-4 bg-neutral-800 border border-neutral-700 rounded-2xl font-bold text-sm text-white outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 placeholder-neutral-600" bind:value={loyaltyInput} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && loyaltyInput.trim()) onLookup(loyaltyInput.trim()); }} />
        <button onclick={() => { if (loyaltyInput.trim()) onLookup(loyaltyInput.trim()); }} disabled={!loyaltyInput.trim()} class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 active:scale-90 transition-transform">Find</button>
      </div>
      {#if customer}
        <div class="space-y-3" in:fly={{y: 10, duration: 200}}>
          <div class="bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/20 rounded-2xl p-4">
            <div class="flex items-center justify-between mb-3">
              <div><p class="text-[8px] font-black text-rose-400/60 uppercase tracking-[0.2em]">Loyalty Member</p><p class="text-xs font-black text-white">{customer.id}</p></div>
              <div class="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider {customer.tier === 'Gold' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : customer.tier === 'Silver' ? 'bg-neutral-400/20 text-neutral-300 border border-neutral-400/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}">{customer.tier}</div>
            </div>
            <div class="flex items-end justify-between">
              <div><p class="text-[7px] font-black text-neutral-500 uppercase tracking-wider mb-0.5">Available Points</p><p class="text-3xl font-black text-white tabular-nums">{customer.points}</p><p class="text-[8px] font-bold text-neutral-500">= R {(customer.points * 0.1).toFixed(2)} value</p></div>
              {#if customer.lastVisit}<p class="text-[8px] font-bold text-neutral-600">Last: {new Date(customer.lastVisit).toLocaleDateString()}</p>{/if}
            </div>
          </div>
          {#if customer.points > 0}
            <div class="bg-neutral-800 border border-neutral-700 rounded-2xl p-4 space-y-3">
              <p class="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">Redeem Points</p>
              <div class="flex gap-2">
                {#each [{ label: '50', pts: 50 }, { label: '100', pts: 100 }, { label: '200', pts: 200 }, { label: 'All', pts: customer.points }].filter(p => p.pts <= customer.points && p.pts > 0) as p}
                  <button onclick={() => onRedeem(p.pts)} class="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-90 {redeemPoints === p.pts ? 'bg-rose-500 text-white' : 'bg-neutral-700 text-neutral-300 border border-neutral-600'}">{p.label}</button>
                {/each}
                {#if redeemPoints > 0}<button onclick={() => onRedeem(0)} class="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-neutral-700 text-neutral-400 border border-neutral-600 active:scale-90">Clear</button>{/if}
              </div>
              {#if redeemPoints > 0}
                <div in:fly={{y: 5, duration: 200}} class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center justify-between"><span class="text-[9px] font-black text-rose-400 uppercase tracking-widest">Discount</span><span class="text-sm font-black text-rose-400 tabular-nums">-R {(redeemPoints * 0.1).toFixed(2)}</span></div>
              {/if}
            </div>
          {/if}
          <button onclick={onClear} class="w-full py-3 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">Remove Loyalty Card</button>
        </div>
      {:else}
        <div class="flex flex-col items-center py-8 opacity-40"><ScanLine class="w-10 h-10 text-neutral-600 mb-3" /><p class="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em]">Scan loyalty card or enter details</p><p class="text-[8px] text-neutral-700 mt-1">Points auto-earn on completed sales</p></div>
      {/if}
      <button onclick={onClose} class="w-full mt-4 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform">{customer ? 'Apply & Close' : 'Close'}</button>
    </div>
  </div>
{/snippet}

<!-- SUPERVISOR OVERRIDE OVERLAY (reusable via snippet) -->
{#snippet SupervisorOverrideOverlay({ action, onSubmit, onCancel }: { action: 'void_item' | 'clear_cart'; onSubmit: (method: 'biometric' | 'pin') => void; onCancel: () => void })}
  {@const actionLabel = action === 'void_item' ? 'Void Line Item' : 'Clear Entire Cart'}
  <div class="fixed inset-0 z-[700] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-6">
    <div in:fly={{y: 100, duration: 200, opacity: 0}} class="bg-neutral-900 border-t border-amber-500/20 sm:border sm:rounded-3xl w-full sm:max-w-sm p-6 pb-8 rounded-t-3xl">
      <div class="w-10 h-1 bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden"></div>
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center"><Shield class="w-5 h-5 text-amber-400" /></div>
        <div class="flex-1 min-w-0"><h3 class="text-sm font-black text-white uppercase tracking-wider">Override Required</h3><p class="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest truncate">{actionLabel}</p></div>
        <button onclick={onCancel} class="p-2 hover:bg-white/5 rounded-lg active:scale-90"><X class="w-5 h-5 text-neutral-500" /></button>
      </div>
      {#if overrideMode === 'choose'}
        <div class="space-y-3" in:fade>
          <button onclick={() => { overrideMode = 'biometric'; overrideBioPhase = 'scanning'; overrideBioProgress = 0; const interval = setInterval(() => { overrideBioProgress += 5; if (overrideBioProgress >= 100) { clearInterval(interval); overrideBioPhase = 'verified'; setTimeout(() => onSubmit('biometric'), 500); } }, 40); }} class="w-full py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform"><Fingerprint class="w-5 h-5" /> Biometric Scan</button>
          <button onclick={() => overrideMode = 'pin'} class="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform"><Hash class="w-5 h-5" /> PIN Entry</button>
        </div>
      {:else if overrideMode === 'pin'}
        <div class="space-y-4" in:fly={{x: 20, duration: 200}}>
          <div class="flex justify-center gap-3 mb-2">
            {#each [0,1,2,3] as i}
              <div class="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black {overridePin.length > i ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 text-transparent'}">{overridePin.length > i ? '\u2022' : ''}</div>
            {/each}
          </div>
          <div class="grid grid-cols-3 gap-2">
            {#each ['1','2','3','4','5','6','7','8','9','CLR','0','OK'] as k}
              <button onclick={() => { if (k === 'CLR') overridePin = ''; else if (k === 'OK' && overridePin.length === 4) onSubmit('pin'); else if (overridePin.length < 4 && k !== 'OK') overridePin += k; }} class="h-14 rounded-xl font-black text-base transition-all active:scale-90 {k === 'OK' ? 'bg-amber-500 text-black' : k === 'CLR' ? 'bg-white/5 text-neutral-400' : 'bg-white/5 text-white border border-white/5'}">{k}</button>
            {/each}
          </div>
          <button onclick={() => overrideMode = 'choose'} class="w-full text-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest pt-2 active:text-white">Back</button>
        </div>
      {:else if overrideMode === 'biometric'}
        <div class="flex flex-col items-center py-6" in:fade>
          <div class="relative w-24 h-24 mb-4">
            <div class="w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all {overrideBioPhase === 'verified' ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/5'}">
              {#if overrideBioPhase === 'verified'}<CheckCircle2 class="w-10 h-10 text-emerald-400" />{:else}<Fingerprint class="w-10 h-10 text-amber-400 animate-pulse" />{/if}
            </div>
            {#if overrideBioPhase === 'scanning'}
              <svg class="absolute inset-0 w-24 h-24 -rotate-90">
                <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(245,158,11,0.3)" stroke-width="4" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="#f59e0b" stroke-width="4" stroke-dasharray="{overrideBioProgress * 2.76} 276" stroke-linecap="round" />
              </svg>
            {/if}
          </div>
          <p class="text-xs font-black uppercase tracking-widest {overrideBioPhase === 'verified' ? 'text-emerald-400' : 'text-amber-400'}">{overrideBioPhase === 'verified' ? 'Verified' : 'Scanning...'}</p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}
