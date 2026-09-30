<script lang="ts">
  import {
    UtensilsCrossed, LayoutGrid, ClipboardList, ChefHat, Search, Plus, Minus, X, Trash2,
    Users, Loader2, Send, Flame, Coffee, CakeSlice,
    Wine, Beef, Salad, Timer, Printer, ArrowRight, RefreshCw, Package,
    ReceiptText, ShoppingCart, UserCheck, Hash, CircleDot, MapPin, CircleCheck,
    CreditCard, Banknote, Receipt, CheckCircle2, ChevronRight, Scissors, UserPlus, UserMinus
  } from 'lucide-svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { toast } from 'svelte-sonner';
  import type { MerchantProfile, UserRole } from '../types';
  import { api } from '../api';

  let { profile, role, userName, shiftId }: { profile: MerchantProfile; role: UserRole; userName?: string; shiftId?: string } = $props();

  const MERCHANT_ID = 'merchant:M4';

  type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery';
  type ViewMode = 'floor' | 'menu' | 'kitchen' | 'bill';

  interface RestaurantTable {
    id: string;
    number: number;
    name: string;
    section: string;
    seats: number;
    status: 'Available' | 'Occupied' | 'Reserved' | 'Dirty';
    shape: 'round' | 'rect';
    guestCount?: number;
    serverName?: string;
    currentOrderId?: string;
    updatedAt?: string;
  }

  interface MenuItem {
    id: string;
    name: string;
    category: string;
    selling: number;
    cost?: number;
    stock?: number;
    course?: string;
    barcode?: string;
  }

  interface OrderItem extends MenuItem {
    quantity: number;
    notes?: string;
    fired?: boolean;
  }

  interface KOT {
    id: string;
    merchantId: string;
    tableId?: string;
    tableName?: string;
    orderType: string;
    items: Array<{ name: string; qty: number; notes?: string; status: string; price?: number; course?: string }>;
    status: string;
    serverName?: string;
    guestCount?: number;
    notes?: string;
    createdAt: string;
    total: number;
  }

  interface BillData {
    tableId: string;
    tableName: string;
    tableNumber: number;
    guestCount: number;
    serverName: string;
    kots: Array<{ id: string; status: string; createdAt: string; items: number }>;
    lineItems: Array<{ name: string; qty: number; price: number; total: number; course: string; notes: string; kotId: string; kotTime: string }>;
    subtotal: number;
    kotCount: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  }

  const COURSE_CATEGORIES = [
    { id: 'All', label: 'All Items', icon: LayoutGrid },
    { id: 'Starter', label: 'Starters', icon: Salad },
    { id: 'Main', label: 'Mains', icon: Beef },
    { id: 'Dessert', label: 'Desserts', icon: CakeSlice },
    { id: 'Beverage', label: 'Drinks', icon: Wine },
    { id: 'Drink', label: 'Drinks', icon: Wine },
    { id: 'Side', label: 'Sides', icon: Coffee },
  ];

  const DISPLAY_CATEGORIES = [
    { id: 'All', label: 'All Items', icon: LayoutGrid },
    { id: 'Starter', label: 'Starters', icon: Salad },
    { id: 'Main', label: 'Mains', icon: Beef },
    { id: 'Dessert', label: 'Desserts', icon: CakeSlice },
    { id: 'Drink', label: 'Drinks', icon: Wine },
    { id: 'Side', label: 'Sides', icon: Coffee },
  ];

  const TABLE_STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
    Available: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Open' },
    Occupied: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Occupied' },
    Reserved: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', label: 'Reserved' },
    Dirty: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Dirty' },
  };

  const FLOOR_ZONE_CONFIG: Record<string, { title: string; subtitle: string; image: string; className: string }> = {
    Indoor: {
      title: 'Indoor dining',
      subtitle: 'Main room · 6 tables',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
      className: 'floor-zone-indoor',
    },
    Bar: {
      title: 'Bar counter',
      subtitle: 'Drinks · 2 seats',
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80',
      className: 'floor-zone-bar',
    },
    Outdoor: {
      title: 'Garden patio',
      subtitle: 'Al fresco · 2 tables',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
      className: 'floor-zone-outdoor',
    },
    VIP: {
      title: 'Private dining',
      subtitle: 'VIP room · 2 tables',
      image: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=80',
      className: 'floor-zone-vip',
    },
  };

  const KOT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    NEW: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'New' },
    IN_PROGRESS: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Cooking' },
    READY: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Ready' },
    SERVED: { color: 'text-neutral-400', bg: 'bg-neutral-500/10', label: 'Served' },
    CANCELLED: { color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Cancelled' },
    Open: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'New' },
    Fired: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Cooking' },
    Completed: { color: 'text-neutral-400', bg: 'bg-neutral-500/10', label: 'Served' },
  };

  type SplitMethod = 'equal' | 'custom' | 'byItem';

  // --- State ---
  let view: ViewMode = $state('floor');
  let tables: RestaurantTable[] = $state([]);
  let menuItems: MenuItem[] = $state([]);
  let kots: KOT[] = $state([]);
  let customerOrders: any[] = $state([]);
  let loading = $state(true);
  let sending = $state(false);
  let orderType: OrderType = $state('Dine-in');
  let selectedTable: RestaurantTable | null = $state(null);
  let cart: OrderItem[] = $state([]);
  let guestCount = $state(2);
  let orderNotes = $state('');
  let menuFilter = $state('All');
  let menuSearch = $state('');
  let billData: BillData | null = $state(null);
  let billLoading = $state(false);
  let tipPercent = $state(0);
  let customTip = $state('');
  let discountAmount = $state(0);
  let paymentMethod: 'Cash' | 'Card' | 'Online Bank' | 'Apple Pay' | 'Tap' | 'Insert' = $state('Card');
  let cashTendered = $state('');
  let settling = $state(false);
  let showReceipt = $state(false);
  let receiptData: any = $state(null);
  let invoiceEmail = $state('');
  let emailInvoiceSending = $state(false);
  let showSplitBill = $state(false);
  let splitMethod: SplitMethod = $state('equal');
  let splitCount = $state(2);
  let splitEntries: Array<{
    label: string;
    amount: number;
    paymentMethod: 'Cash' | 'Card';
    amountTendered: string;
    items: any[];
    settled: boolean;
  }> = $state([]);
  let settlingSplit = $state(false);
  let splitReceipts: any[] = $state([]);
  let qrTable: RestaurantTable | null = $state(null);
  let now = $state(Date.now());

  // --- Timer ---
  $effect(() => {
    const t = setInterval(() => now = Date.now(), 1000);
    return () => clearInterval(t);
  });

  // --- Derived ---
  let filteredMenu = $derived(menuItems.filter(item => {
    const matchesCategory = menuFilter === 'All' || item.course === menuFilter || item.category === menuFilter ||
      (menuFilter === 'Drink' && (item.course === 'Drink' || item.course === 'Beverage' || item.category === 'Beverage'));
    const matchesSearch = !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  }));

  let computedTip = $derived(customTip ? parseFloat(customTip) || 0 : (billData ? billData.subtotal * tipPercent / 100 : 0));
  let derivedGrandTotal = $derived(billData ? billData.subtotal + computedTip - discountAmount : 0);
  let cashChange = $derived(paymentMethod === 'Cash' ? Math.max(0, (parseFloat(cashTendered) || 0) - derivedGrandTotal) : 0);

  let isActiveKOT = (k: KOT) => k.status !== 'SERVED' && k.status !== 'CANCELLED' && k.status !== 'Completed';
  let activeKOTs = $derived(kots.filter(isActiveKOT));
  let pendingCustomerOrders = $derived(customerOrders.filter((order) => order.status === 'PENDING_APPROVAL'));

  let sectionGroups = $derived.by(() => {
    const acc: Record<string, RestaurantTable[]> = {};
    for (const t of tables) {
      (acc[t.section] = acc[t.section] || []).push(t);
    }
    return acc;
  });
  let floorSections = $derived(Object.keys(FLOOR_ZONE_CONFIG).filter(section => sectionGroups[section]?.length));
  let occupiedTables = $derived(tables.filter(t => t.status === 'Occupied'));

  let cartTotal = $derived(cart.reduce((s, c) => s + c.selling * c.quantity, 0));

  // --- Derived (split bill) ---
  let splitGrandTotal = $derived(billData ? billData.subtotal + computedTip - discountAmount : 0);
  let splitAllocated = $derived(splitEntries.reduce((s, e) => s + e.amount, 0));
  let splitRemaining = $derived(Math.round((splitGrandTotal - splitAllocated) * 100) / 100);

  // --- Functions ---
  async function loadTables() {
    try {
      const data = await api.getTables(MERCHANT_ID);
      if (Array.isArray(data)) tables = data;
    } catch (e) {
      console.error('[Restaurant] Load tables error:', e);
    }
  }

  async function loadMenu() {
    try {
      const data = await api.getStock(MERCHANT_ID);
      if (Array.isArray(data)) {
        menuItems = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          selling: item.selling,
          cost: item.cost,
          stock: item.stock,
          course: item.course || (item.category === 'Food' ? 'Main' : item.category === 'Beverage' ? 'Drink' : item.category === 'Dessert' ? 'Dessert' : 'Main'),
          barcode: item.barcode,
        }));
      }
    } catch (e) {
      console.error('[Restaurant] Load menu error:', e);
    }
  }

  async function loadKOTs() {
    try {
      const data = await api.getKOTs(MERCHANT_ID);
      if (Array.isArray(data)) kots = data;
    } catch (e) {
      console.error('[Restaurant] Load KOTs error:', e);
    }
  }

  async function loadCustomerOrders() {
    const data = await api.getRestaurantOrders(MERCHANT_ID, 'PENDING_APPROVAL');
    if (Array.isArray(data)) customerOrders = data;
  }

  $effect(() => {
    const init = async () => {
      loading = true;
      await Promise.all([loadTables(), loadMenu(), loadKOTs(), loadCustomerOrders()]);
      loading = false;
    };
    init();
  });

  $effect(() => {
    const interval = setInterval(() => { loadKOTs(); loadCustomerOrders(); }, 10000);
    return () => clearInterval(interval);
  });

  async function approveCustomerOrder(order: any) {
    const result = await api.approveRestaurantOrder(order.id);
    if (result.success) {
      toast.success('Guest order approved and sent to kitchen');
      await Promise.all([loadCustomerOrders(), loadKOTs(), loadTables()]);
    } else {
      toast.error(result.error || 'Could not approve guest order');
    }
  }

  function addToCart(item: MenuItem) {
    cart = (() => {
      const existing = cart.find(c => c.id === item.id);
      if (existing) {
        return cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...cart, { ...item, quantity: 1 }];
    })();
  }

  function removeFromCart(itemId: string) {
    cart = cart.filter(c => c.id !== itemId);
  }

  function updateQuantity(itemId: string, delta: number) {
    cart = cart.map(c => {
      if (c.id !== itemId) return c;
      const next = c.quantity + delta;
      return next > 0 ? { ...c, quantity: next } : c;
    }).filter(c => c.quantity > 0);
  }

  function updateItemNotes(itemId: string, notes: string) {
    cart = cart.map(c => c.id === itemId ? { ...c, notes } : c);
  }

  async function handleTableSelect(table: RestaurantTable) {
    selectedTable = table;
    if (table.status === 'Available' || table.status === 'Dirty') {
      orderType = 'Dine-in';
      view = 'menu';
      if (table.status === 'Dirty') {
        await api.updateTableStatus(MERCHANT_ID, table.id, { status: 'Available' });
        loadTables();
      }
    } else if (table.status === 'Occupied') {
      view = 'bill';
      loadBill(table.id);
    } else {
      orderType = 'Dine-in';
      view = 'menu';
    }
  }

  async function loadBill(tableId: string) {
    billLoading = true;
    billData = null;
    tipPercent = 0;
    customTip = '';
    discountAmount = 0;
    cashTendered = '';
    showReceipt = false;
    invoiceEmail = '';
    try {
      const data = await api.getTableBill(MERCHANT_ID, tableId);
      if (data && !data.error) {
        if (data.lineItems && data.lineItems.length > 0) {
          billData = data;
        } else {
          toast.error('This bill has already been settled', {
            description: 'All orders have been paid. Table is ready for cleanup.',
            duration: 5000,
          });
          view = 'floor';
        }
      } else {
        toast.error('No bill data found for this table');
        view = 'floor';
      }
    } catch (e) {
      toast.error('Failed to load table bill');
      view = 'floor';
    } finally {
      billLoading = false;
    }
  }

  async function handleSendKOT() {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    sending = true;
    try {
      const res = await api.createKOT({
        merchantId: MERCHANT_ID,
        tableId: selectedTable?.id,
        tableName: selectedTable?.name || (orderType === 'Takeaway' ? 'TAKEAWAY' : orderType === 'Delivery' ? 'DELIVERY' : 'BAR'),
        items: cart.map(c => ({
          name: c.name,
          qty: c.quantity,
          price: c.selling,
          notes: c.notes || '',
          course: c.course || 'Main',
        })),
        orderType,
        serverName: userName || 'Floor Server',
        notes: orderNotes,
        guestCount: orderType === 'Dine-in' ? guestCount : undefined,
      });

      if (res.success) {
        toast.success(`KOT #${res.kot?.id?.split(':').pop()?.slice(-4) || ''} sent to kitchen`);

        if (selectedTable && orderType === 'Dine-in') {
          await api.updateTableStatus(MERCHANT_ID, selectedTable.id, {
            status: 'Occupied',
            orderId: res.kot?.id,
            guestCount,
            serverName: userName || 'Server',
          });
          loadTables();
        }

        cart = [];
        orderNotes = '';
        loadKOTs();
      } else {
        toast.error('Failed to send KOT');
      }
    } catch (e: any) {
      toast.error('Failed to send order to kitchen');
    } finally {
      sending = false;
    }
  }

  async function handleUpdateKOTStatus(kotId: string, status: string) {
    try {
      await api.updateKOTStatus(kotId, { status });
      toast.success(`Ticket status updated to ${status}`);
      loadKOTs();

      if (status === 'CANCELLED') {
        const kot = kots.find(k => k.id === kotId);
        if (kot?.tableId) {
          await api.updateTableStatus(MERCHANT_ID, kot.tableId, { status: 'Dirty' });
          loadTables();
        }
      }
    } catch (e) {
      toast.error('Failed to update ticket');
    }
  }

  async function handleSettleBill() {
    if (!billData) {
      toast.error('No bill data available');
      return;
    }

    if (billData.lineItems.length === 0) {
      toast.error('Cannot settle empty bill');
      return;
    }

    if (paymentMethod === 'Cash' && (parseFloat(cashTendered) || 0) < derivedGrandTotal) {
      toast.error('Insufficient cash tendered');
      return;
    }

    settling = true;
    try {
      const res = await api.settleBill({
        merchantId: MERCHANT_ID,
        tableId: billData.tableId,
        paymentMethod,
        amountTendered: paymentMethod === 'Cash' ? parseFloat(cashTendered) || derivedGrandTotal : derivedGrandTotal,
        tip: computedTip,
        discount: discountAmount,
        cashierName: userName || 'Server',
        shiftId: shiftId || '',
        lineItems: billData.lineItems,
        subtotal: billData.subtotal,
        guestCount: billData.guestCount,
        customerName: billData.customerName,
        customerEmail: billData.customerEmail,
        customerPhone: billData.customerPhone,
      });

      if (res.success) {
        toast.success(`âœ… PAYMENT COLLECTED - ${res.receiptNumber}`, {
          description: `Table ${billData.tableNumber} - R${derivedGrandTotal.toFixed(2)} via ${paymentMethod}`,
          duration: 5000,
        });
        receiptData = {
          ...res.transaction,
          tableName: billData.tableName,
          tableNumber: billData.tableNumber,
          serverName: billData.serverName,
          guestCount: billData.guestCount,
          tip: computedTip,
          discount: discountAmount,
          grandTotal: derivedGrandTotal,
          lineItems: billData.lineItems,
          customerName: billData.customerName,
          customerEmail: billData.customerEmail,
          customerPhone: billData.customerPhone,
        };
        invoiceEmail = receiptData.customerEmail || '';
        showReceipt = true;

        await Promise.all([loadTables(), loadKOTs()]);
      } else {
        toast.error(`âŒ SETTLEMENT FAILED: ${res.error || 'Unknown error'}`, {
          description: 'Please retry or contact support',
          duration: 8000,
        });
      }
    } catch (e: any) {
      toast.error(`âŒ Payment processing failed: ${e.message || 'Network error'}`, {
        description: 'Check console for details',
        duration: 8000,
      });
    } finally {
      settling = false;
    }
  }

  async function emailSettledInvoice() {
    if (!receiptData) return;
    emailInvoiceSending = true;
    const result = await api.emailRestaurantInvoice({
      to: invoiceEmail,
      merchantId: MERCHANT_ID,
      transaction: receiptData,
      lineItems: receiptData.lineItems || [],
    });
    emailInvoiceSending = false;
    if (result.success) toast.success(`Invoice queued for ${invoiceEmail}`);
    else toast.error(result.error || 'Could not email invoice');
  }

  // --- Split Bill ---
  function initSplitBill() {
    if (!billData) return;
    showSplitBill = true;
    splitMethod = 'equal';
    const count = billData.guestCount > 1 ? billData.guestCount : 2;
    splitCount = count;
    splitReceipts = [];
    rebuildSplitEntries('equal', count, billData);
  }

  function rebuildSplitEntries(method: SplitMethod, count: number, bill: BillData) {
    const tipAmt = customTip ? parseFloat(customTip) || 0 : bill.subtotal * tipPercent / 100;
    const gt = bill.subtotal + tipAmt - discountAmount;

    if (method === 'equal' || method === 'custom') {
      const perPerson = Math.round(gt / count * 100) / 100;
      const remainder = Math.round((gt - perPerson * count) * 100) / 100;
      splitEntries = Array.from({ length: count }, (_, i) => ({
        label: `Guest ${i + 1}`,
        amount: i === 0 ? perPerson + remainder : perPerson,
        paymentMethod: 'Card' as const,
        amountTendered: '',
        items: [],
        settled: false,
      }));
    } else if (method === 'byItem') {
      splitEntries = Array.from({ length: count }, (_, i) => ({
        label: `Guest ${i + 1}`,
        amount: 0,
        paymentMethod: 'Card' as const,
        amountTendered: '',
        items: [],
        settled: false,
      }));
    }
  }

  function handleSplitMethodChange(method: SplitMethod) {
    splitMethod = method;
    if (billData) rebuildSplitEntries(method, splitCount, billData);
  }

  function handleSplitCountChange(delta: number) {
    const next = Math.max(2, Math.min(10, splitCount + delta));
    splitCount = next;
    if (billData) rebuildSplitEntries(splitMethod, next, billData);
  }

  function updateSplitEntry(idx: number, field: string, value: any) {
    splitEntries = splitEntries.map((e, i) => i === idx ? { ...e, [field]: value } : e);
  }

  function assignItemToSplit(splitIdx: number, item: any) {
    splitEntries = splitEntries.map((entry, i) => {
      if (i !== splitIdx) return entry;
      const existing = entry.items.find((it: any) => it.name === item.name);
      const newItems = existing
        ? entry.items.map((it: any) => it.name === item.name ? { ...it, qty: (it.qty || 1) + 1 } : it)
        : [...entry.items, { ...item, qty: 1 }];
      const newAmount = newItems.reduce((s: number, it: any) => s + it.price * (it.qty || 1), 0);
      return { ...entry, items: newItems, amount: newAmount };
    });
  }

  function removeItemFromSplit(splitIdx: number, itemName: string) {
    splitEntries = splitEntries.map((entry, i) => {
      if (i !== splitIdx) return entry;
      const newItems = entry.items.filter((it: any) => it.name !== itemName);
      const newAmount = newItems.reduce((s: number, it: any) => s + it.price * (it.qty || 1), 0);
      return { ...entry, items: newItems, amount: newAmount };
    });
  }

  async function handleSettleSplitBill() {
    if (!billData) {
      toast.error('No bill data available');
      return;
    }

    for (const entry of splitEntries) {
      if (entry.amount <= 0) {
        toast.error(`${entry.label} has no amount assigned`);
        return;
      }
      if (entry.paymentMethod === 'Cash' && (parseFloat(entry.amountTendered) || 0) < entry.amount) {
        toast.error(`Insufficient cash for ${entry.label}`);
        return;
      }
    }

    if (splitMethod !== 'byItem' && Math.abs(splitRemaining) > 0.02) {
      toast.error('Split amounts do not balance');
      return;
    }

    settlingSplit = true;
    try {
      const res = await api.splitBill({
        merchantId: MERCHANT_ID,
        tableId: billData.tableId,
        splits: splitEntries.map(e => ({
          label: e.label,
          amount: e.amount,
          paymentMethod: e.paymentMethod,
          amountTendered: e.paymentMethod === 'Cash' ? parseFloat(e.amountTendered) || e.amount : e.amount,
          items: e.items.length > 0 ? e.items : billData.lineItems.map((li: any) => ({
            name: li.name, price: li.price, qty: Math.ceil(li.qty / splitCount)
          })),
        })),
        tip: computedTip,
        discount: discountAmount,
        cashierName: userName || 'Server',
        shiftId: shiftId || '',
        lineItems: billData.lineItems,
        subtotal: billData.subtotal,
        guestCount: billData.guestCount,
        splitMethod,
      });

      if (res.success) {
        toast.success(`âœ… SPLIT PAYMENT COLLECTED - ${res.splitCount} payments`, {
          description: `Table ${billData.tableNumber} - R${splitGrandTotal.toFixed(2)} total`,
          duration: 5000,
        });
        splitReceipts = res.transactions || [];
        showSplitBill = false;

        receiptData = {
          ...res.transactions?.[0],
          tableName: billData.tableName,
          tableNumber: billData.tableNumber,
          serverName: billData.serverName,
          guestCount: billData.guestCount,
          tip: computedTip,
          discount: discountAmount,
          grandTotal: splitGrandTotal,
          lineItems: billData.lineItems,
          splitBill: true,
          splitCount: res.splitCount,
          allReceipts: res.receiptNumbers,
        };
        showReceipt = true;

        await Promise.all([loadTables(), loadKOTs()]);
      } else {
        toast.error(`âŒ SPLIT SETTLEMENT FAILED: ${res.error || 'Unknown error'}`, {
          description: 'Please retry or contact support',
          duration: 8000,
        });
      }
    } catch (e: any) {
      toast.error(`âŒ Split payment processing failed: ${e.message || 'Network error'}`, {
        description: 'Check console for details',
        duration: 8000,
      });
    } finally {
      settlingSplit = false;
    }
  }

  function getKOTAge(createdAt: string) {
    const diff = Math.floor((now - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}m`;
  }

  function getMenuBarcode(item: any) {
    return item?.barcode || menuItems.find((menuItem) => menuItem.id === item?.id || menuItem.name === item?.name)?.barcode || 'No barcode';
  }

  function tableMenuUrl(tableId: string) {
    // When the POS is opened through ngrok, window.location.origin is the
    // current public tunnel URL. A configured origin still takes precedence
    // for LAN testing or a stable hosted menu domain.
    const configuredOrigin = import.meta.env.VITE_PUBLIC_MENU_ORIGIN;
    const origin = (configuredOrigin || window.location.origin).replace(/\/$/, '');
    return `${origin}/menu?merchantId=${encodeURIComponent(MERCHANT_ID)}&tableId=${encodeURIComponent(tableId)}`;
  }
</script>

{#if loading}
  <div class="flex h-full items-center justify-center bg-neutral-950">
    <div class="text-center">
      <Loader2 class="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
      <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Loading Restaurant Terminal...</p>
    </div>
  </div>
{:else}
<div class="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
  <!-- Header Bar -->
  <header class="h-12 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
        <UtensilsCrossed class="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div>
        <h1 class="text-[11px] font-black tracking-wider uppercase text-neutral-100">Melrose Arch Kitchen</h1>
        <p class="text-[7px] font-black text-neutral-500 uppercase tracking-[0.3em]">Restaurant Terminal</p>
      </div>
    </div>

    <div class="flex items-center gap-1 bg-neutral-800/50 p-0.5 rounded-lg border border-neutral-700/50">
      {#each ([
        { id: 'floor' as ViewMode, label: 'Floor', icon: LayoutGrid },
        { id: 'menu' as ViewMode, label: 'Order', icon: ShoppingCart },
        { id: 'kitchen' as ViewMode, label: 'Kitchen', icon: ChefHat },
        { id: 'bill' as ViewMode, label: 'Bill', icon: Receipt },
      ]) as tab}
        {@const TabIcon = tab.icon}
        <button
          onclick={() => view = tab.id}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all {view === tab.id ? 'bg-amber-500 text-neutral-900 shadow-lg shadow-amber-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'}"
        >
          <TabIcon class="w-3 h-3" />
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700/50">
        <ClipboardList class="w-3 h-3 text-amber-400" />
        <span class="text-[9px] font-black text-amber-400 tabular-nums">{activeKOTs.length}</span>
        <span class="text-[8px] font-bold text-neutral-500 uppercase">Active</span>
      </div>

      <div class="text-[9px] font-black text-neutral-500 uppercase tracking-widest tabular-nums">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>

      {#if pendingCustomerOrders.length > 0}<span class="px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-[8px] font-black text-rose-300 uppercase">{pendingCustomerOrders.length} guest order{pendingCustomerOrders.length === 1 ? '' : 's'}</span>{/if}
      <button onclick={() => { loadTables(); loadMenu(); loadKOTs(); loadCustomerOrders(); }} class="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors">
        <RefreshCw class="w-3.5 h-3.5 text-neutral-500" />
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 overflow-hidden">
    {#key view}
      {#if view === 'floor'}
        <div transition:fade class="h-full overflow-y-auto p-4 space-y-6">
          {#if pendingCustomerOrders.length > 0}
            <section class="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
              <div><p class="text-[9px] uppercase tracking-widest font-black text-rose-300">Waiter approval queue</p><h2 class="text-lg font-black text-white">Orders from table QR codes</h2></div>
              <div class="grid gap-3 md:grid-cols-2">
                {#each pendingCustomerOrders as order (order.id)}
                  <article class="rounded-xl border border-neutral-700 bg-neutral-900/80 p-3"><div class="flex justify-between gap-3"><div><p class="font-black text-sm text-white">Table {order.tableId}</p><p class="text-[10px] text-neutral-400">{order.customerName || 'Guest'} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div><span class="font-black text-amber-400">R{Number(order.total || 0).toFixed(2)}</span></div>{#if order.paymentMethod}<div class="mt-2 rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-indigo-200">Payment requested: {order.paymentMethod}</div>{/if}<div class="mt-3 space-y-2">{#each order.items || [] as item}<div class="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-2"><span class="text-xs text-neutral-200">{item.qty}× {item.name}</span><span class="shrink-0 font-mono text-[9px] font-bold tracking-wider text-amber-300">{getMenuBarcode(item)}</span></div>{/each}</div><button onclick={() => approveCustomerOrder(order)} class="mt-3 w-full rounded-lg bg-rose-500 py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-rose-400">Approve & send to kitchen</button></article>
                {/each}
              </div>
            </section>
          {/if}
          <div class="flex items-center gap-3">
            <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Quick Order:</span>
            <button onclick={() => qrTable = tables[0] || null} class="px-4 py-2 bg-amber-500 text-neutral-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all">QR Menu Codes</button>
            {#each ['Takeaway', 'Delivery'] as type (type)}
              <button
                onclick={() => { orderType = type as OrderType; selectedTable = null; view = 'menu'; }}
                class="px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-300 hover:bg-neutral-700 hover:border-amber-500/30 transition-all"
              >
                {type}
              </button>
            {/each}
          </div>

          <section class="floor-board rounded-[2rem] border border-neutral-700/80 overflow-hidden shadow-2xl shadow-black/20">
            <div class="relative flex flex-wrap items-end justify-between gap-4 px-5 py-5 border-b border-white/10 bg-neutral-950/70">
              <div>
                <p class="text-[9px] uppercase tracking-[0.28em] font-black text-amber-400">Live floor plan</p>
                <h2 class="mt-1 text-xl font-black text-white tracking-tight">Roxton dining room</h2>
                <p class="mt-1 text-xs text-neutral-400">Tap any table to open its order, guest count, and current service status.</p>
              </div>
              <div class="flex flex-wrap gap-2 text-[8px] font-black uppercase tracking-widest text-neutral-400">
                <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{tables.length} tables</span>
                <span class="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-amber-300">{occupiedTables.length} occupied</span>
                <span class="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-blue-300">{activeKOTs.length} in kitchen</span>
              </div>
            </div>

            <div class="floor-map hidden min-h-[620px] grid-cols-12 grid-rows-6 gap-4 p-5 md:grid">
              <div class="floor-service-island col-span-2 row-span-2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-neutral-950/80 p-3 text-center shadow-inner">
                <div class="rounded-full bg-amber-400/15 p-3 text-amber-300"><ChefHat class="h-6 w-6" /></div>
                <span class="text-[9px] font-black uppercase tracking-widest text-neutral-200">Kitchen pass</span>
                <span class="text-[8px] text-neutral-500">Chef & pickup</span>
              </div>

              {#each floorSections as section}
                {@const sectionTables = sectionGroups[section] || []}
                {@const zone = FLOOR_ZONE_CONFIG[section]}
                <section class="{zone.className} floor-zone relative overflow-hidden rounded-3xl border border-white/10 p-4">
                  <div class="absolute inset-0 bg-cover bg-center opacity-20" style={`background-image: url('${zone.image}')`}></div>
                  <div class="relative z-10 flex items-start justify-between gap-3">
                    <div>
                      <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white">{zone.title}</p>
                      <p class="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/50">{zone.subtitle}</p>
                    </div>
                    <MapPin class="h-4 w-4 text-amber-300/70" />
                  </div>
                  <div class="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-3">
                    {#each sectionTables as table (table.id)}
                      {@const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.Available}
                      {@const hasActiveKOT = kots.some(k => k.tableId === table.id && isActiveKOT(k))}
                      <button onclick={() => handleTableSelect(table)} class="floor-table {table.shape === 'round' ? 'rounded-full' : 'rounded-xl'} {cfg.bg} border {cfg.border} group relative flex min-h-[92px] min-w-[100px] flex-col items-center justify-center gap-1 px-3 py-3 shadow-lg transition-all hover:-translate-y-1 hover:scale-[1.03] hover:border-amber-300/70 hover:shadow-amber-900/30">
                        {#if hasActiveKOT}<span class="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-neutral-950 bg-amber-300"></span>{/if}
                        <span class="text-lg font-black {cfg.color}">{table.number}</span>
                        <span class="max-w-[90px] truncate text-[8px] font-bold uppercase tracking-wide text-neutral-200/80">{table.name}</span>
                        <span class="flex items-center gap-1 text-[8px] font-bold text-neutral-400"><Users class="h-2.5 w-2.5" /> {table.guestCount || 0}/{table.seats}</span>
                        <span class="text-[7px] font-black uppercase tracking-widest {cfg.color}">{cfg.label}</span>
                      </button>
                    {/each}
                  </div>
                </section>
              {/each}

              <div class="floor-walkway col-span-2 row-span-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-3 text-center">
                <div class="flex h-full flex-col items-center justify-center gap-2 text-neutral-600"><ArrowRight class="h-5 w-5 rotate-90" /><span class="text-[8px] font-black uppercase tracking-[0.25em]">Main walkway</span></div>
              </div>
            </div>

            <div class="space-y-5 p-4 md:hidden">
              {#each floorSections as section}
                {@const sectionTables = sectionGroups[section] || []}
                {@const zone = FLOOR_ZONE_CONFIG[section]}
                <div class="rounded-2xl border border-white/10 bg-neutral-950/50 p-3">
                  <div class="mb-3 flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-widest text-white">{zone.title}</p><p class="text-[8px] text-neutral-500">{zone.subtitle}</p></div><MapPin class="h-3.5 w-3.5 text-amber-300" /></div>
                  <div class="grid grid-cols-2 gap-3">
                    {#each sectionTables as table (table.id)}
                      {@const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.Available}
                      {@const hasActiveKOT = kots.some(k => k.tableId === table.id && isActiveKOT(k))}
                      <button onclick={() => handleTableSelect(table)} class="relative rounded-xl border {cfg.border} {cfg.bg} p-3 text-left transition-all active:scale-95">
                        {#if hasActiveKOT}<span class="absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300"></span>{/if}
                        <div class="flex items-center justify-between"><span class="text-lg font-black {cfg.color}">T{table.number}</span><span class="text-[8px] font-black uppercase {cfg.color}">{cfg.label}</span></div>
                        <p class="mt-1 truncate text-[9px] font-bold text-neutral-200">{table.name}</p>
                        <span class="mt-2 flex items-center gap-1 text-[8px] text-neutral-500"><Users class="h-2.5 w-2.5" /> {table.guestCount || 0}/{table.seats} guests</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </section>

          <div class="flex items-center gap-4 pt-2">
            {#each Object.entries(TABLE_STATUS_CONFIG) as [status, cfg]}
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full {cfg.bg} border {cfg.border}"></div>
                <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{status}</span>
              </div>
            {/each}
          </div>
        </div>
      {:else if view === 'menu'}
        <div transition:fade class="h-full flex">
          <div class="flex-1 flex flex-col overflow-hidden border-r border-neutral-800">
            <div class="px-4 py-2.5 border-b border-neutral-800 flex items-center gap-3 shrink-0">
              <div class="flex items-center gap-1 bg-neutral-800/50 p-0.5 rounded-lg">
                {#each ['Dine-in', 'Takeaway', 'Delivery'] as type (type)}
                  <button
                    onclick={() => { orderType = type as OrderType; if (type !== 'Dine-in') selectedTable = null; }}
                    class="px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all {orderType === type ? 'bg-amber-500 text-neutral-900' : 'text-neutral-500 hover:text-neutral-200'}"
                  >
                    {type}
                  </button>
                {/each}
              </div>

              {#if selectedTable && orderType === 'Dine-in'}
                <div class="flex items-center gap-2 px-2.5 py-1 bg-neutral-800 rounded-lg border border-neutral-700/50">
                  <CircleDot class="w-3 h-3 text-amber-400" />
                  <span class="text-[9px] font-black text-amber-400">T{selectedTable.number}</span>
                  <span class="text-[8px] text-neutral-500">{selectedTable.name}</span>
                </div>
              {/if}

              {#if orderType === 'Dine-in'}
                <div class="flex items-center gap-1.5">
                  <Users class="w-3 h-3 text-neutral-500" />
                  <button onclick={() => guestCount = Math.max(1, guestCount - 1)} class="w-5 h-5 bg-neutral-800 rounded text-neutral-400 flex items-center justify-center hover:bg-neutral-700 text-xs">-</button>
                  <span class="text-[10px] font-black text-neutral-200 w-4 text-center tabular-nums">{guestCount}</span>
                  <button onclick={() => guestCount = guestCount + 1} class="w-5 h-5 bg-neutral-800 rounded text-neutral-400 flex items-center justify-center hover:bg-neutral-700 text-xs">+</button>
                </div>
              {/if}

              <div class="flex-1"></div>

              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600"></Search>
                <input
                  type="text"
                  placeholder="Search menu..."
                  bind:value={menuSearch}
                  class="pl-7 pr-3 py-1.5 bg-neutral-800 border border-neutral-700/50 rounded-lg text-[10px] font-bold text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/50 w-40"
                />
              </div>
            </div>

            <div class="px-4 py-2 flex items-center gap-1 overflow-x-auto border-b border-neutral-800/50 shrink-0">
              {#each DISPLAY_CATEGORIES as cat (cat.id)}
                {@const CatIcon = cat.icon}
                <button
                  onclick={() => menuFilter = cat.id}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shrink-0 {menuFilter === cat.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'}"
                >
                  <CatIcon class="w-3 h-3" />
                  {cat.label}
                </button>
              {/each}
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {#each filteredMenu as item (item.id)}
                  {@const inCart = cart.find(c => c.id === item.id)}
                  <button
                    onclick={() => addToCart(item)}
                    class="relative p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] {inCart ? 'bg-amber-500/10 border-amber-500/30' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}"
                  >
                    {#if inCart}
                      <div class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-neutral-900 text-[9px] font-black">
                        {inCart.quantity}
                      </div>
                    {/if}
                    <p class="text-[10px] font-black text-neutral-100 leading-tight mb-1">{item.name}</p>
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] font-bold text-neutral-500 uppercase">{item.course || item.category}</span>
                      <span class="text-[11px] font-black text-amber-400 tabular-nums">R{item.selling.toFixed(2)}</span>
                    </div>
                    <span class="mt-2 block truncate font-mono text-[8px] font-bold tracking-wider text-neutral-600">{item.barcode || 'No barcode'}</span>
                  </button>
                {/each}
                {#if filteredMenu.length === 0}
                  <div class="col-span-full py-16 text-center">
                    <Package class="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                    <p class="text-[10px] font-black text-neutral-600 uppercase tracking-widest">No items found</p>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="w-80 lg:w-96 flex flex-col bg-neutral-900/50 shrink-0">
            <div class="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ReceiptText class="w-4 h-4 text-amber-400" />
                <span class="text-[10px] font-black text-neutral-200 uppercase tracking-widest">Order</span>
              </div>
              <span class="text-[9px] font-bold text-neutral-500">
                {orderType}{selectedTable ? ` - T${selectedTable.number}` : ''}
              </span>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
              {#if cart.length === 0}
                <div class="flex flex-col items-center justify-center h-full opacity-30">
                  <ShoppingCart class="w-10 h-10 text-neutral-600 mb-3" />
                  <p class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Cart Empty</p>
                  <p class="text-[8px] text-neutral-600 mt-1">Tap menu items to add</p>
                </div>
              {:else}
                {#each cart as item (item.id)}
                  <div class="bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-700/30">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-black text-neutral-100 truncate">{item.name}</p>
                        <p class="text-[8px] font-bold text-neutral-500 uppercase">{item.course || item.category}</p>
                      </div>
                      <span class="text-[10px] font-black text-amber-400 tabular-nums shrink-0">R{(item.selling * item.quantity).toFixed(2)}</span>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                      <div class="flex items-center gap-1.5">
                        <button onclick={() => updateQuantity(item.id, -1)} class="w-5 h-5 bg-neutral-700 rounded flex items-center justify-center text-neutral-300 hover:bg-neutral-600">
                          <Minus class="w-3 h-3" />
                        </button>
                        <span class="text-[10px] font-black text-neutral-200 w-5 text-center tabular-nums">{item.quantity}</span>
                        <button onclick={() => updateQuantity(item.id, 1)} class="w-5 h-5 bg-neutral-700 rounded flex items-center justify-center text-neutral-300 hover:bg-neutral-600">
                          <Plus class="w-3 h-3" />
                        </button>
                      </div>
                      <div class="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Notes..."
                          value={item.notes || ''}
                          oninput={e => updateItemNotes(item.id, e.target.value)}
                          class="w-20 px-2 py-0.5 bg-neutral-700/50 border border-neutral-600/30 rounded text-[8px] font-bold text-neutral-300 placeholder-neutral-600 outline-none"
                        />
                        <button onclick={() => removeFromCart(item.id)} class="p-1 hover:bg-rose-500/10 rounded text-neutral-600 hover:text-rose-400 transition-colors">
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            {#if cart.length > 0}
              <div class="px-3 py-2 border-t border-neutral-800">
                <input
                  type="text"
                  placeholder="Order notes (allergies, special requests)..."
                  bind:value={orderNotes}
                  class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-[9px] font-bold text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/50"
                />
              </div>
            {/if}

            <div class="p-3 border-t border-neutral-800 space-y-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Total</span>
                <span class="text-lg font-black text-amber-400 tabular-nums">R{cartTotal.toFixed(2)}</span>
              </div>

              <button
                onclick={handleSendKOT}
                disabled={cart.length === 0 || sending}
                class="w-full py-3 bg-amber-500 text-neutral-900 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {#if sending}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <Send class="w-4 h-4" />
                {/if}
                {sending ? 'Sending...' : 'Fire to Kitchen'}
              </button>

              {#if cart.length > 0}
                <button
                  onclick={() => { cart = []; orderNotes = ''; }}
                  class="w-full py-2 bg-neutral-800 text-neutral-400 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-neutral-700 transition-all"
                >
                  Clear Order
                </button>
              {/if}
            </div>
          </div>
        </div>
      {:else if view === 'kitchen'}
        <div transition:fade class="h-full overflow-y-auto p-4">
          <div class="flex items-center gap-4 mb-4">
            {#each ['NEW', 'IN_PROGRESS', 'READY', 'SERVED'] as status (status)}
              {@const cfg = KOT_STATUS_CONFIG[status]}
              {@const count = kots.filter(k => k.status === status).length}
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg {cfg.bg} border border-neutral-800">
                <div class="w-2 h-2 rounded-full {status === 'NEW' ? 'bg-amber-400' : status === 'IN_PROGRESS' ? 'bg-blue-400' : status === 'READY' ? 'bg-emerald-400' : 'bg-neutral-400'}"></div>
                <span class="text-[9px] font-black uppercase tracking-widest {cfg.color}">{cfg.label}</span>
                <span class="text-[10px] font-black tabular-nums {cfg.color}">{count}</span>
              </div>
            {/each}
            <div class="flex-1"></div>
            <button onclick={loadKOTs} class="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 rounded-lg border border-neutral-700/50 text-[9px] font-black text-neutral-400 uppercase tracking-widest hover:bg-neutral-700 transition-all">
              <RefreshCw class="w-3 h-3" />
              Refresh
            </button>
          </div>

          {#if activeKOTs.length === 0}
            <div class="flex flex-col items-center justify-center py-20 opacity-30">
              <ChefHat class="w-16 h-16 text-neutral-700 mb-4" />
              <p class="text-[11px] font-black text-neutral-500 uppercase tracking-widest">Kitchen Clear</p>
              <p class="text-[9px] text-neutral-600 mt-1">No active tickets</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {#each activeKOTs as kot (kot.id)}
                {@const statusCfg = KOT_STATUS_CONFIG[kot.status] || KOT_STATUS_CONFIG.NEW}
                {@const age = getKOTAge(kot.createdAt)}
                {@const ageSeconds = (now - new Date(kot.createdAt).getTime()) / 1000}
                {@const isUrgent = ageSeconds > 600 && kot.status !== 'READY'}
                <div
                  class="bg-neutral-900 rounded-xl border overflow-hidden transition-all {isUrgent ? 'border-rose-500/50 animate-pulse' : 'border-neutral-800'}"
                >
                  <div class="px-3 py-2 flex items-center justify-between {statusCfg.bg} border-b border-neutral-800">
                    <div class="flex items-center gap-2">
                      <Hash class="w-3 h-3 text-neutral-500" />
                      <span class="text-[10px] font-black text-neutral-200">
                        {kot.id.split(':').pop()?.slice(-4)}
                      </span>
                      <span class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest {statusCfg.bg} {statusCfg.color}">
                        {statusCfg.label}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <Timer class="w-3 h-3 {isUrgent ? 'text-rose-400' : 'text-neutral-500'}" />
                      <span class="text-[9px] font-black tabular-nums {isUrgent ? 'text-rose-400' : 'text-neutral-500'}">{age}</span>
                    </div>
                  </div>

                  <div class="px-3 py-2 flex items-center justify-between border-b border-neutral-800/50">
                    <div class="flex items-center gap-2">
                      {#if kot.orderType === 'Dine-in'}
                        <CircleDot class="w-3 h-3 text-amber-400" />
                      {:else}
                        <Package class="w-3 h-3 text-indigo-400" />
                      {/if}
                      <span class="text-[9px] font-black text-neutral-300 uppercase">
                        {kot.tableName || kot.orderType}
                      </span>
                    </div>
                    {#if kot.serverName}
                      <span class="text-[8px] font-bold text-neutral-600">
                        <UserCheck class="w-2.5 h-2.5 inline mr-1" />
                        {kot.serverName}
                      </span>
                    {/if}
                  </div>

                  <div class="px-3 py-2 space-y-1">
                    {#each kot.items as item, idx}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] font-black text-amber-400 w-4 tabular-nums">{item.qty}x</span>
                          <span class="text-[10px] font-bold text-neutral-200">{item.name}</span>
                        </div>
                        {#if item.notes}
                          <span class="text-[8px] font-bold text-rose-400 italic">{item.notes}</span>
                        {/if}
                      </div>
                    {/each}
                    {#if kot.notes}
                      <div class="mt-1 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded text-[8px] font-bold text-rose-300">
                        {kot.notes}
                      </div>
                    {/if}
                  </div>

                  <div class="px-3 py-2 border-t border-neutral-800 flex items-center gap-1.5">
                    {#if kot.status === 'NEW' || kot.status === 'Open'}
                      <button
                        onclick={() => handleUpdateKOTStatus(kot.id, 'IN_PROGRESS')}
                        class="flex-1 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[8px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <Flame class="w-3 h-3" />
                        Start Cooking
                      </button>
                    {/if}
                    {#if kot.status === 'IN_PROGRESS' || kot.status === 'Fired'}
                      <button
                        onclick={() => handleUpdateKOTStatus(kot.id, 'READY')}
                        class="flex-1 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[8px] font-black text-emerald-400 uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 class="w-3 h-3" />
                        Ready
                      </button>
                    {/if}
                    {#if kot.status === 'READY'}
                      <button
                        onclick={() => handleUpdateKOTStatus(kot.id, 'SERVED')}
                        class="flex-1 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[8px] font-black text-amber-400 uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <CircleCheck class="w-3 h-3" />
                        Served
                      </button>
                    {/if}
                    <button
                      onclick={() => handleUpdateKOTStatus(kot.id, 'CANCELLED')}
                      class="py-1.5 px-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-[8px] font-black text-neutral-500 uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if kots.filter(k => k.status === 'SERVED' || k.status === 'CANCELLED' || k.status === 'Completed').length > 0}
            <div class="mt-6">
              <div class="flex items-center gap-2 mb-3">
                <CircleCheck class="w-3.5 h-3.5 text-neutral-600" />
                <h3 class="text-[9px] font-black text-neutral-600 uppercase tracking-widest">
                  Completed ({kots.filter(k => k.status === 'SERVED' || k.status === 'CANCELLED' || k.status === 'Completed').length})
                </h3>
                <div class="flex-1 h-px bg-neutral-800/50"></div>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {#each kots.filter(k => k.status === 'SERVED' || k.status === 'CANCELLED' || k.status === 'Completed').slice(0, 12) as kot (kot.id)}
                  <div class="bg-neutral-900/30 rounded-lg border border-neutral-800/50 px-3 py-2 opacity-50">
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] font-black text-neutral-500">#{kot.id.split(':').pop()?.slice(-4)}</span>
                      <span class="text-[7px] font-black uppercase {kot.status === 'SERVED' || kot.status === 'Completed' ? 'text-emerald-600' : 'text-rose-600'}">{kot.status}</span>
                    </div>
                    <p class="text-[8px] font-bold text-neutral-600 mt-0.5">{kot.tableName} - {kot.items.length} items</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else if view === 'bill'}
        <div transition:fade class="h-full flex">
          <div class="w-64 lg:w-72 border-r border-neutral-800 flex flex-col shrink-0 bg-neutral-900/30">
            <div class="px-4 py-3 border-b border-neutral-800">
              <div class="flex items-center gap-2">
                <Receipt class="w-4 h-4 text-amber-400" />
                <span class="text-[10px] font-black text-neutral-200 uppercase tracking-widest">Table Bills</span>
              </div>
              <p class="text-[8px] text-neutral-500 mt-1">Select an occupied table to view/settle bill</p>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
                {#if occupiedTables.length === 0}
                <div class="flex flex-col items-center justify-center py-16 opacity-30">
                  <LayoutGrid class="w-10 h-10 text-neutral-700 mb-3" />
                  <p class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">No Open Bills</p>
                  <p class="text-[8px] text-neutral-600 mt-1">All tables are available</p>
                </div>
              {:else}
                {#each occupiedTables as table (table.id)}
                  {@const tableKotCount = kots.filter(k => k.tableId === table.id && isActiveKOT(k)).length}
                  {@const isSelected = selectedTable?.id === table.id}
                  <button
                    onclick={() => { selectedTable = table; loadBill(table.id); }}
                    class="w-full p-3 rounded-xl border text-left transition-all {isSelected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-neutral-800/50 border-neutral-700/30 hover:border-neutral-600'}"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-black {isSelected ? 'text-amber-400' : 'text-neutral-200'}">T{table.number}</span>
                        <span class="text-[8px] font-bold text-neutral-500">{table.name}</span>
                      </div>
                      <ChevronRight class="w-3 h-3 {isSelected ? 'text-amber-400' : 'text-neutral-600'}" />
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="flex items-center gap-1">
                        <Users class="w-2.5 h-2.5 text-neutral-500" />
                        <span class="text-[8px] font-bold text-neutral-400">{table.guestCount || 0}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <ClipboardList class="w-2.5 h-2.5 text-neutral-500" />
                        <span class="text-[8px] font-bold text-neutral-400">{tableKotCount} tickets</span>
                      </div>
                      {#if table.serverName}
                        <span class="text-[8px] font-bold text-neutral-500">{table.serverName}</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              {/if}
            </div>
          </div>

          <div class="flex-1 flex flex-col overflow-hidden">
            {#if !billData && !billLoading}
              <div class="flex flex-col items-center justify-center h-full opacity-30">
                <Receipt class="w-16 h-16 text-neutral-700 mb-4" />
                <p class="text-[11px] font-black text-neutral-500 uppercase tracking-widest">Select a Table</p>
                <p class="text-[9px] text-neutral-600 mt-1">Click an occupied table to view the bill</p>
              </div>
            {:else if billLoading}
              <div class="flex items-center justify-center h-full">
                <Loader2 class="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            {:else if billData && !showReceipt}
              <div class="px-6 py-2 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-center gap-2">
                <div class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                <span class="text-[10px] font-black text-rose-400 uppercase tracking-widest">âš ï¸ PAYMENT REQUIRED - BILL NOT SETTLED</span>
                <div class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
              </div>

              <div class="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-sm font-black text-neutral-100">
                      Table {billData.tableNumber} - {billData.tableName}
                    </h2>
                    <div class="flex items-center gap-4 mt-1">
                      <span class="text-[9px] font-bold text-neutral-500">
                        <Users class="w-3 h-3 inline mr-1" />{billData.guestCount} guests
                      </span>
                      <span class="text-[9px] font-bold text-neutral-500">
                        <UserCheck class="w-3 h-3 inline mr-1" />{billData.serverName}
                      </span>
                      <span class="text-[9px] font-bold text-neutral-500">
                        <ClipboardList class="w-3 h-3 inline mr-1" />{billData.kotCount} tickets
                      </span>
                    </div>
                  </div>
                  <button
                    onclick={() => {
                      if (confirm('âš ï¸ WARNING: This bill has NOT been settled!\n\nClosing this bill without payment will result in revenue loss.\n\nAre you sure you want to close this UNPAID bill?')) {
                        selectedTable = null;
                        billData = null;
                        toast.warning('Bill closed without payment - Table remains Occupied', {
                          description: 'Please ensure guest has paid before clearing table',
                          duration: 5000,
                        });
                      }
                    }}
                    class="p-2 hover:bg-rose-800 rounded-lg text-neutral-500 hover:text-rose-400 transition-colors border border-transparent hover:border-rose-500/30"
                    title="Close bill (WARNING: No payment collected)"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="flex-1 overflow-y-auto px-6 py-4">
                {#if billData.lineItems.length === 0}
                  <div class="flex flex-col items-center justify-center py-12 opacity-30">
                    <ReceiptText class="w-10 h-10 text-neutral-700 mb-3" />
                    <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest">No Items</p>
                  </div>
                {:else}
                  <div class="space-y-1">
                    <div class="flex items-center px-2 py-1 text-[8px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-800">
                      <span class="w-8 text-center">Qty</span>
                      <span class="flex-1 ml-2">Item</span>
                      <span class="w-20 text-right">Price</span>
                      <span class="w-24 text-right">Total</span>
                    </div>
                    {#each billData.lineItems as item, idx}
                      <div class="flex items-center px-2 py-2 rounded-lg hover:bg-neutral-800/30 transition-colors">
                        <span class="w-8 text-center text-[10px] font-black text-amber-400 tabular-nums">{item.qty}</span>
                        <div class="flex-1 ml-2">
                          <p class="text-[10px] font-bold text-neutral-200">{item.name}</p>
                          <p class="text-[8px] font-bold text-neutral-600 uppercase">{item.course}{item.notes ? ` - ${item.notes}` : ''}</p>
                        </div>
                        <span class="w-20 text-right text-[9px] font-bold text-neutral-400 tabular-nums">R{item.price.toFixed(2)}</span>
                        <span class="w-24 text-right text-[10px] font-black text-neutral-200 tabular-nums">R{item.total.toFixed(2)}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="border-t border-neutral-800 bg-neutral-900/50">
                <div class="px-6 py-3 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Subtotal</span>
                    <span class="text-sm font-black text-neutral-200 tabular-nums">R{billData.subtotal.toFixed(2)}</span>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest w-12">Tip</span>
                    <div class="flex items-center gap-1">
                      {#each [0, 10, 15, 20] as pct}
                        <button
                          onclick={() => { tipPercent = pct; customTip = ''; }}
                          class="px-2 py-1 rounded text-[8px] font-black transition-all {tipPercent === pct && !customTip ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50 hover:border-neutral-600'}"
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      {/each}
                      <input
                        type="number"
                        placeholder="Custom"
                        bind:value={customTip}
                        oninput={() => { tipPercent = 0; }}
                        class="w-16 px-2 py-1 bg-neutral-800 border border-neutral-700/50 rounded text-[9px] font-bold text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/50 tabular-nums"
                      />
                    </div>
                    <span class="text-[9px] font-bold text-amber-400 tabular-nums ml-auto">+R{computedTip.toFixed(2)}</span>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest w-12">Disc</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={discountAmount || ''}
                      oninput={e => discountAmount = parseFloat(e.target.value) || 0}
                      class="w-24 px-2 py-1 bg-neutral-800 border border-neutral-700/50 rounded text-[9px] font-bold text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/50 tabular-nums"
                    />
                    {#if discountAmount > 0}
                      <span class="text-[9px] font-bold text-rose-400 tabular-nums ml-auto">-R{discountAmount.toFixed(2)}</span>
                    {/if}
                  </div>

                  <div class="flex items-center justify-between pt-2 border-t border-neutral-700/50">
                    <span class="text-[11px] font-black text-neutral-200 uppercase tracking-widest">Total Due</span>
                    <span class="text-xl font-black text-amber-400 tabular-nums">R{derivedGrandTotal.toFixed(2)}</span>
                  </div>

                  {#if billData.guestCount > 1}
                    <div class="flex items-center justify-between">
                      <span class="text-[8px] font-bold text-neutral-500 uppercase">Per guest ({billData.guestCount})</span>
                      <span class="text-[10px] font-bold text-neutral-400 tabular-nums">R{(derivedGrandTotal / billData.guestCount).toFixed(2)}</span>
                    </div>
                  {/if}
                </div>

                <div class="px-6 py-3 border-t border-neutral-800 space-y-3">
                  <div class="flex flex-wrap items-center gap-2">
                    {#each ['Card', 'Tap', 'Insert', 'Online Bank', 'Apple Pay', 'Cash'] as method (method)}
                      <button
                        onclick={() => paymentMethod = method as typeof paymentMethod}
                        class="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all {paymentMethod === method ? 'bg-amber-500 text-neutral-900 shadow-lg shadow-amber-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50 hover:border-neutral-600'}"
                      >
                        {#if method !== 'Cash'}
                          <CreditCard class="w-4 h-4" />
                        {:else}
                          <Banknote class="w-4 h-4" />
                        {/if}
                        {method}
                      </button>
                    {/each}
                  </div>

                  {#if paymentMethod === 'Cash'}
                    <div class="space-y-2">
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] font-black text-neutral-500 uppercase w-20">Tendered</span>
                        <input
                          type="number"
                          placeholder={derivedGrandTotal.toFixed(2)}
                          bind:value={cashTendered}
                          class="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm font-black text-neutral-100 placeholder-neutral-600 outline-none focus:border-amber-500/50 tabular-nums"
                          autofocus
                        />
                      </div>
                      {#if parseFloat(cashTendered) >= derivedGrandTotal}
                        <div class="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Change</span>
                          <span class="text-lg font-black text-emerald-400 tabular-nums">R{cashChange.toFixed(2)}</span>
                        </div>
                      {/if}
                      <div class="flex items-center gap-1">
                        {#each [50, 100, 200, 500] as amount}
                          <button
                            onclick={() => cashTendered = String(amount)}
                            class="flex-1 py-1.5 bg-neutral-800 border border-neutral-700/50 rounded text-[9px] font-black text-neutral-400 hover:bg-neutral-700 transition-all tabular-nums"
                          >
                            R{amount}
                          </button>
                        {/each}
                        <button
                          onclick={() => cashTendered = String(Math.ceil(derivedGrandTotal / 10) * 10)}
                          class="flex-1 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-black text-amber-400 hover:bg-amber-500/20 transition-all"
                        >
                          Exact
                        </button>
                      </div>
                    </div>
                  {/if}

                  <div class="flex items-center gap-2">
                    <button
                      onclick={handleSettleBill}
                      disabled={settling || (billData ? billData.lineItems.length === 0 : true) || (paymentMethod === 'Cash' && (parseFloat(cashTendered) || 0) < derivedGrandTotal)}
                      class="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 border-2 border-emerald-400"
                    >
                      {#if settling}
                        <Loader2 class="w-5 h-5 animate-spin" />
                      {:else}
                        <CheckCircle2 class="w-5 h-5" />
                      {/if}
                      {settling ? 'Processing Payment...' : `ðŸ’° COLLECT PAYMENT - R${derivedGrandTotal.toFixed(2)}`}
                    </button>
                    <button
                      onclick={initSplitBill}
                      disabled={billData ? billData.lineItems.length === 0 : true}
                      class="py-4 px-5 bg-indigo-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-400 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                      <Scissors class="w-4 h-4" />
                      Split
                    </button>
                  </div>

                  <div class="px-6 py-3 bg-rose-500/5 border-t-2 border-rose-500/20">
                    <div class="flex items-start gap-2">
                      <div class="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1 shrink-0"></div>
                      <p class="text-[8px] font-bold text-rose-400/80 leading-relaxed">
                        <strong class="uppercase tracking-wider">IMPORTANT:</strong> Payment must be collected before guests leave.
                        Closing this bill without settlement will result in revenue loss and will be logged in the audit trail.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            {:else if showReceipt && receiptData}
              <div class="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                <div class="w-[320px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
                  <div class="bg-emerald-500 px-6 py-3 text-center flex items-center justify-center gap-2">
                    <CheckCircle2 class="w-5 h-5 text-white animate-pulse" />
                    <span class="text-sm font-black tracking-wider uppercase text-white">âœ… PAYMENT COLLECTED</span>
                  </div>

                  <div class="bg-neutral-800 px-6 py-4 text-center">
                    <h3 class="text-xs font-black tracking-[0.3em] uppercase text-amber-400">Melrose Arch Kitchen</h3>
                    <p class="text-[8px] text-neutral-400 font-bold mt-1">VAT No: 4350267891 | Tel: 011-556-7890</p>
                    <p class="text-[8px] text-neutral-500 mt-0.5">Melrose Arch, Johannesburg, 2196</p>
                  </div>

                  <div class="px-6 py-3 border-b border-dashed border-neutral-700 space-y-1">
                    <div class="flex justify-between text-[8px] font-bold text-neutral-400">
                      <span>Receipt:</span>
                      <span class="text-neutral-200">{receiptData.receiptNumber}</span>
                    </div>
                    <div class="flex justify-between text-[8px] font-bold text-neutral-400">
                      <span>Table:</span>
                      <span class="text-neutral-200">T{receiptData.tableNumber} - {receiptData.tableName}</span>
                    </div>
                    <div class="flex justify-between text-[8px] font-bold text-neutral-400">
                      <span>Server:</span>
                      <span class="text-neutral-200">{receiptData.serverName}</span>
                    </div>
                    <div class="flex justify-between text-[8px] font-bold text-neutral-400">
                      <span>Guests:</span>
                      <span class="text-neutral-200">{receiptData.guestCount}</span>
                    </div>
                    <div class="flex justify-between text-[8px] font-bold text-neutral-400">
                      <span>Date:</span>
                      <span class="text-neutral-200">{new Date(receiptData.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div class="px-6 py-3 border-b border-dashed border-neutral-700">
                    {#each receiptData.lineItems || [] as item, idx}
                      <div class="flex justify-between py-0.5">
                        <div class="flex items-center gap-2">
                          <span class="text-[9px] font-black text-amber-400 w-4 tabular-nums">{item.qty}x</span>
                          <span class="text-[9px] font-bold text-neutral-200">{item.name}</span>
                        </div>
                        <span class="text-[9px] font-bold text-neutral-200 tabular-nums">R{item.total.toFixed(2)}</span>
                      </div>
                    {/each}
                  </div>

                  <div class="px-6 py-3 space-y-1">
                    <div class="flex justify-between text-[9px] font-bold text-neutral-400">
                      <span>Subtotal</span>
                      <span class="tabular-nums">R{receiptData.subtotal?.toFixed(2)}</span>
                    </div>
                    {#if receiptData.tip > 0}
                      <div class="flex justify-between text-[9px] font-bold text-neutral-400">
                        <span>Tip</span>
                        <span class="tabular-nums text-emerald-400">+R{receiptData.tip.toFixed(2)}</span>
                      </div>
                    {/if}
                    {#if receiptData.discount > 0}
                      <div class="flex justify-between text-[9px] font-bold text-neutral-400">
                        <span>Discount</span>
                        <span class="tabular-nums text-rose-400">-R{receiptData.discount.toFixed(2)}</span>
                      </div>
                    {/if}
                    <div class="flex justify-between text-xs font-black text-amber-400 pt-1 border-t border-neutral-700">
                      <span>TOTAL</span>
                      <span class="tabular-nums">R{receiptData.grandTotal?.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-[9px] font-bold text-neutral-400 pt-1">
                      <span>Payment</span>
                      <span>{receiptData.paymentMethod}</span>
                    </div>
                    {#if receiptData.paymentMethod === 'Cash' && receiptData.change > 0}
                      <div class="flex justify-between text-[9px] font-bold text-emerald-400">
                        <span>Change</span>
                        <span class="tabular-nums">R{receiptData.change.toFixed(2)}</span>
                      </div>
                    {/if}
                  </div>

                  {#if receiptData.splitBill}
                    <div class="px-6 py-2 bg-indigo-500/10 border-t border-indigo-500/20">
                      <div class="flex items-center justify-center gap-2">
                        <Scissors class="w-3 h-3 text-indigo-400" />
                        <span class="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                          Split Bill ({receiptData.splitCount} payments)
                        </span>
                      </div>
                      {#if receiptData.allReceipts}
                        <div class="flex items-center justify-center gap-1 mt-1 flex-wrap">
                          {#each receiptData.allReceipts as r}
                            <span class="text-[7px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{r}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <div class="px-6 py-4 bg-neutral-800 text-center space-y-1">
                    <p class="text-[8px] font-bold text-neutral-400">Thank you for dining with us!</p>
                    <p class="text-[7px] font-bold text-neutral-500">Powered by Roxton OS v4.2.1</p>
                    <div class="flex justify-center gap-2 mt-2">
                      <div class="h-1 w-8 bg-neutral-600 rounded"></div>
                      <div class="h-1 w-4 bg-neutral-700 rounded"></div>
                      <div class="h-1 w-8 bg-neutral-600 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            {#if showReceipt}
              <div class="px-6 py-3 border-t border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                <button
                  onclick={() => {
                    showReceipt = false;
                    billData = null;
                    receiptData = null;
                    selectedTable = null;
                    view = 'floor';
                  }}
                  class="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-neutral-700 transition-all flex items-center gap-2"
                >
                  <ArrowRight class="w-3 h-3 rotate-180" />
                  Back to Floor
                </button>
                <div class="flex items-center gap-2">
                  <button
                    onclick={emailSettledInvoice}
                    disabled={emailInvoiceSending || !invoiceEmail.trim()}
                    class="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    {emailInvoiceSending ? 'Queueing…' : 'Email invoice'}
                  </button>
                  <input type="email" bind:value={invoiceEmail} placeholder="customer@email.com" aria-label="Customer invoice email" class="w-44 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] text-neutral-200 outline-none focus:border-indigo-400" />
                  <button
                    onclick={() => toast.success('Receipt sent to thermal printer')}
                    class="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2"
                  >
                    <Printer class="w-3 h-3" />
                    Print
                  </button>
                  <button
                    onclick={() => {
                      showReceipt = false;
                      billData = null;
                      receiptData = null;
                      selectedTable = null;
                      view = 'floor';
                    }}
                    class="px-4 py-2 bg-emerald-500 text-white rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 class="w-3 h-3" />
                    Done
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/key}
  </div>

  <!-- SPLIT BILL MODAL -->
  {#if showSplitBill && billData}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div transition:scale={{start: 0.9, duration: 200}} class="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
              <Scissors class="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 class="text-sm font-black text-neutral-100 uppercase tracking-wider">Split Bill</h3>
              <p class="text-[8px] font-bold text-neutral-500">
                Table {billData.tableNumber} - {billData.tableName} | {billData.guestCount} guests | R{splitGrandTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onclick={() => {
              if (confirm('âš ï¸ Cancel split bill setup?\n\nThe bill will remain unpaid and you will return to the payment screen.\n\nProceed?')) {
                showSplitBill = false;
              }
            }}
            class="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors"
            title="Cancel split bill"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="px-6 py-3 border-b border-neutral-800/50 flex items-center gap-4 shrink-0">
          <div class="flex items-center gap-1 bg-neutral-800/50 p-0.5 rounded-lg">
            {#each [
              { id: 'equal' as SplitMethod, label: 'Equal Split' },
              { id: 'custom' as SplitMethod, label: 'Custom Amounts' },
              { id: 'byItem' as SplitMethod, label: 'By Item' },
            ] as m}
              <button
                onclick={() => handleSplitMethodChange(m.id)}
                class="px-3 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all {splitMethod === m.id ? 'bg-indigo-500 text-white' : 'text-neutral-500 hover:text-neutral-200'}"
              >
                {m.label}
              </button>
            {/each}
          </div>

          <div class="flex items-center gap-2 ml-auto">
            <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Splits</span>
            <button
              onclick={() => handleSplitCountChange(-1)}
              class="w-6 h-6 bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-700 transition-colors"
            >
              <UserMinus class="w-3 h-3" />
            </button>
            <span class="text-sm font-black text-indigo-400 tabular-nums w-6 text-center">{splitCount}</span>
            <button
              onclick={() => handleSplitCountChange(1)}
              class="w-6 h-6 bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-700 transition-colors"
            >
              <UserPlus class="w-3 h-3" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          {#if splitMethod === 'byItem'}
            <div class="mb-4 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
              <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
                Unassigned Items (tap to assign to a guest)
              </p>
              <div class="flex flex-wrap gap-1.5">
                {#each billData.lineItems as item, idx}
                  {@const totalAssigned = splitEntries.reduce((s, e) => s + (e.items.find((it: any) => it.name === item.name)?.qty || 0), 0)}
                  {@const remaining = item.qty - totalAssigned}
                  {#if remaining > 0}
                    <div class="relative group">
                      <div class="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700/50 rounded-lg text-[9px] font-bold text-neutral-200">
                        <span class="text-amber-400 font-black mr-1">{remaining}x</span>
                        {item.name}
                        <span class="text-neutral-500 ml-1">R{item.price.toFixed(2)}</span>
                      </div>
                      <div class="absolute top-full left-0 mt-1 z-10 hidden group-hover:flex flex-col gap-0.5 bg-neutral-800 border border-neutral-700 rounded-lg p-1 shadow-xl min-w-[100px]">
                        {#each splitEntries as entry, sIdx}
                          <button
                            onclick={() => assignItemToSplit(sIdx, { name: item.name, price: item.price })}
                            class="px-2 py-1 text-[8px] font-black text-neutral-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded transition-colors text-left"
                          >
                            {entry.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#each splitEntries as entry, idx}
              <div class="bg-neutral-800/50 rounded-xl border border-neutral-700/30 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
                      <span class="text-[10px] font-black text-indigo-400">{idx + 1}</span>
                    </div>
                    <input
                      type="text"
                      value={entry.label}
                      oninput={e => updateSplitEntry(idx, 'label', e.target.value)}
                      class="bg-transparent text-[10px] font-black text-neutral-200 outline-none border-b border-transparent focus:border-indigo-500/50 w-24"
                    />
                  </div>
                  <span class="text-sm font-black text-amber-400 tabular-nums">
                    R{entry.amount.toFixed(2)}
                  </span>
                </div>

                {#if splitMethod === 'custom'}
                  <div class="flex items-center gap-2">
                    <span class="text-[8px] font-black text-neutral-500 uppercase w-12">Amount</span>
                    <input
                      type="number"
                      value={entry.amount || ''}
                      oninput={e => { const val = parseFloat(e.target.value) || 0; updateSplitEntry(idx, 'amount', val); }}
                      class="flex-1 px-2 py-1.5 bg-neutral-700/50 border border-neutral-600/50 rounded-lg text-[10px] font-black text-neutral-100 outline-none focus:border-indigo-500/50 tabular-nums"
                    />
                  </div>
                {/if}

                {#if splitMethod === 'byItem' && entry.items.length > 0}
                  <div class="space-y-1">
                    {#each entry.items as item, iIdx}
                      <div class="flex items-center justify-between px-2 py-1 bg-neutral-700/30 rounded">
                        <div class="flex items-center gap-1.5">
                          <span class="text-[9px] font-black text-amber-400">{item.qty}x</span>
                          <span class="text-[9px] font-bold text-neutral-200">{item.name}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="text-[8px] font-bold text-neutral-400 tabular-nums">R{(item.price * item.qty).toFixed(2)}</span>
                          <button
                            onclick={() => removeItemFromSplit(idx, item.name)}
                            class="p-0.5 hover:bg-rose-500/10 rounded text-neutral-600 hover:text-rose-400 transition-colors"
                          >
                            <X class="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}

                <div class="flex items-center gap-1.5">
                  {#each ['Card', 'Cash'] as method (method)}
                    <button
                      onclick={() => updateSplitEntry(idx, 'paymentMethod', method)}
                      class="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-widest transition-all {entry.paymentMethod === method ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-neutral-700/30 text-neutral-500 border border-neutral-700/30 hover:border-neutral-600'}"
                    >
                      {#if method === 'Card'}
                        <CreditCard class="w-3 h-3" />
                      {:else}
                        <Banknote class="w-3 h-3" />
                      {/if}
                      {method}
                    </button>
                  {/each}
                </div>

                {#if entry.paymentMethod === 'Cash'}
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-2">
                      <span class="text-[8px] font-black text-neutral-500 uppercase w-16">Tendered</span>
                      <input
                        type="number"
                        placeholder={entry.amount.toFixed(2)}
                        value={entry.amountTendered}
                        oninput={e => updateSplitEntry(idx, 'amountTendered', e.target.value)}
                        class="flex-1 px-2 py-1.5 bg-neutral-700/50 border border-neutral-600/50 rounded-lg text-[10px] font-black text-neutral-100 outline-none focus:border-amber-500/50 tabular-nums"
                      />
                    </div>
                    {#if parseFloat(entry.amountTendered) >= entry.amount}
                      <div class="flex items-center justify-between px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <span class="text-[8px] font-black text-emerald-400 uppercase">Change</span>
                        <span class="text-[10px] font-black text-emerald-400 tabular-nums">
                          R{(parseFloat(entry.amountTendered) - entry.amount).toFixed(2)}
                        </span>
                      </div>
                    {/if}
                    <div class="flex items-center gap-1">
                      {#each [50, 100, 200] as amount}
                        <button
                          onclick={() => updateSplitEntry(idx, 'amountTendered', String(amount))}
                          class="flex-1 py-1 bg-neutral-700/30 border border-neutral-600/30 rounded text-[8px] font-black text-neutral-400 hover:bg-neutral-700/50 transition-all tabular-nums"
                        >
                          R{amount}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <div class="px-6 py-4 border-t border-neutral-800 shrink-0 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div>
                <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Bill Total</span>
                <p class="text-sm font-black text-neutral-200 tabular-nums">R{splitGrandTotal.toFixed(2)}</p>
              </div>
              <div>
                <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Allocated</span>
                <p class="text-sm font-black text-indigo-400 tabular-nums">R{splitAllocated.toFixed(2)}</p>
              </div>
              {#if splitMethod === 'custom' && Math.abs(splitRemaining) > 0.01}
                <div>
                  <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Remaining</span>
                  <p class="text-sm font-black tabular-nums {splitRemaining > 0 ? 'text-amber-400' : 'text-rose-400'}">
                    R{splitRemaining.toFixed(2)}
                  </p>
                </div>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <button
                onclick={() => showSplitBill = false}
                class="px-4 py-2.5 bg-neutral-800 text-neutral-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-neutral-700 transition-all"
              >
                Cancel
              </button>
              <button
                onclick={handleSettleSplitBill}
                disabled={settlingSplit || splitEntries.some(e => e.amount <= 0) || (splitMethod === 'custom' && Math.abs(splitRemaining) > 0.02)}
                class="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-400 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {#if settlingSplit}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <Scissors class="w-4 h-4" />
                {/if}
                {settlingSplit ? 'Processing...' : `Settle ${splitCount} Splits`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
{#if qrTable}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onclick={() => qrTable = null} onkeydown={(event) => event.key === 'Escape' && (qrTable = null)}>
    <div class="w-full max-w-md rounded-3xl bg-neutral-900 border border-neutral-700 p-6 text-center shadow-2xl" role="dialog" aria-modal="true" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
      <p class="text-[9px] uppercase tracking-[0.25em] font-black text-amber-400">Table QR menu</p>
      <h2 class="text-2xl font-black text-white mt-2">{qrTable.name}</h2>
      <div class="flex flex-wrap justify-center gap-2 mt-4">{#each tables as table (table.id)}<button onclick={() => qrTable = table} class="px-3 py-1.5 rounded-lg text-[9px] font-black {qrTable.id === table.id ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'}">Table {table.number}</button>{/each}</div>
      <img class="w-56 h-56 mx-auto my-5 rounded-2xl bg-white p-3" alt="QR menu for {qrTable.name}" src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(tableMenuUrl(qrTable.id))}`} />
      <p class="text-[10px] text-neutral-400 break-all">{tableMenuUrl(qrTable.id)}</p>
      <div class="flex gap-2 mt-5"><button onclick={() => window.open(tableMenuUrl(qrTable.id), '_blank')} class="flex-1 rounded-xl bg-amber-500 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-950">Open menu</button><button onclick={() => qrTable = null} class="flex-1 rounded-xl bg-neutral-800 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-300">Close</button></div>
    </div>
  </div>
{/if}
{/if}

<style>
  .floor-map {
    background:
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
      repeating-linear-gradient(90deg, rgba(142, 87, 44, .08) 0 18px, rgba(75, 41, 25, .08) 18px 20px),
      #171310;
    background-size: 32px 32px, 32px 32px, 44px 100%, auto;
  }

  .floor-zone {
    background: linear-gradient(135deg, rgba(28, 23, 20, .9), rgba(12, 10, 9, .78));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 18px 45px rgba(0,0,0,.18);
  }

  .floor-zone-indoor { grid-column: 3 / span 6; grid-row: 1 / span 4; }
  .floor-zone-bar { grid-column: 9 / span 4; grid-row: 1 / span 2; }
  .floor-zone-outdoor { grid-column: 3 / span 6; grid-row: 5 / span 2; }
  .floor-zone-vip { grid-column: 9 / span 4; grid-row: 3 / span 4; }

  .floor-service-island,
  .floor-walkway {
    background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 12px 12px;
  }

  .floor-table { backdrop-filter: blur(8px); }
</style>
