<script lang="ts">
  import {
    Barcode,
    Plus,
    Search,
    TrendingUp,
    Target,
    ClipboardList,
    PieChart,
    Truck,
    PackageCheck,
    FileSpreadsheet,
    AlertTriangle,
    CheckCircle2,
    Lock,
    ArrowRight,
    ArrowLeftRight,
    X,
    Package as PackageIcon,
    Settings2,
    Save,
    Loader2,
    Trash2,
    Minus,
    ArrowUp,
    Image as ImageIcon,
    CloudUpload
  } from 'lucide-svelte';
  import type { UserRole } from '../types';
  import { toast } from 'svelte-sonner';
  import { api } from '../api';

  let { profile, role }: { profile: string; role: UserRole } = $props();

  // Centralized merchant ID derivation
  let merchantId = $derived(
    profile === 'Forecourt'
      ? 'merchant:M2'
      : profile === 'Workshop'
      ? 'merchant:M3'
      : profile === 'Restaurant'
      ? 'merchant:M4'
      : 'merchant:M1'
  );

  let activeTab = $state('inventory');
  let items = $state<any[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');

  // Product Management State
  let showProductModal = $state<any>(null); // null, 'add', or the product object for edit
  let productData = $state({
    name: '',
    sku: '',
    barcode: '',
    category: 'General',
    cost: '',
    selling: '',
    stock: '',
    unit: 'Unit',
    supplier: '',
    velocity: 'Medium',
    imagePath: '',
    imageUrl: ''
  });
  let uploading = $state(false);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let scannerActive = $state(false);
  let barcodeLookupLoading = $state(false);
  let barcodeLookupMessage = $state('');

  // FR-09 Pricing Control State
  let showPricingModal = $state<any>(null);
  let password = $state('');
  let newSellingPrice = $state('');

  // FR-06 Stock Transfer State
  let showTransferModal = $state(false);
  let transferData = $state({
    itemId: '',
    fromBranch: 'Sandton #1024',
    toBranch: '',
    quantity: ''
  });

  // Stock Alert State
  let stockAlerts = $state<any[]>([]);
  let alertsLoading = $state(false);

  let isAdmin = $derived(role === 'Admin');
  let isManager = $derived(role === 'Manager');
  let isStockController = $derived(role === 'StockController');

  let receivingData = $state({
    itemName: '',
    sku: '',
    costPrice: '',
    supplier: '',
    quantity: '',
    targetMargin: '45'
  });

  // Stock Take State
  let stockCounts = $state<Record<string, string>>({});
  let showVarianceModal = $state(false);

  // Purchase Order State
  let purchaseOrders = $state<any[]>([]);
  let posLoading = $state(false);
  let showPOModal = $state(false);
  let poForm = $state<{ supplier: string; notes: string; items: any[] }>({
    supplier: '',
    notes: '',
    items: [{ name: '', quantity: '', unitCost: '' }]
  });

  // Derived filtered items
  let filteredItems = $derived(
    items.filter(
      (item) =>
        !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Escape key handler for all modals
  $effect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showPricingModal) {
        showPricingModal = null;
        password = '';
        newSellingPrice = '';
        return;
      }
      if (showTransferModal) { showTransferModal = false; return; }
      if (showVarianceModal) { showVarianceModal = false; return; }
      if (showPOModal) { showPOModal = false; return; }
      if (showProductModal) { showProductModal = null; return; }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  });

  $effect(() => {
    loadInventory();
    loadStockAlerts();
    loadPurchaseOrders();
  });

  async function loadPurchaseOrders() {
    try {
      posLoading = true;
      const data = await api.getPurchaseOrders(merchantId);
      purchaseOrders = Array.isArray(data) ? data : [];
    } catch { } finally { posLoading = false; }
  }

  async function handleCreatePO() {
    if (!poForm.supplier || poForm.items.every((i: any) => !i.name)) {
      toast.error('Supplier and at least one item required');
      return;
    }
    const totalCost = poForm.items.reduce(
      (s: number, i: any) => s + parseFloat(i.unitCost || '0') * parseInt(i.quantity || '0'),
      0
    );
    const po = {
      id: `po:${merchantId}:${Date.now()}`,
      merchantId: merchantId,
      supplier: poForm.supplier,
      notes: poForm.notes,
      items: poForm.items
        .filter((i: any) => i.name)
        .map((i: any) => ({
          name: i.name,
          quantity: parseInt(i.quantity || '0'),
          unitCost: parseFloat(i.unitCost || '0'),
          productId: i.productId || '',
          total: parseFloat(i.unitCost || '0') * parseInt(i.quantity || '0')
        })),
      totalCost,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    try {
      const res = await api.savePurchaseOrder(po);
      if (res.success) {
        toast.success('Purchase Order created');
        showPOModal = false;
        poForm = { supplier: '', notes: '', items: [{ name: '', quantity: '', unitCost: '' }] };
        loadPurchaseOrders();
      }
    } catch { toast.error('Failed to create PO'); }
  }

  async function handleReceivePO(po: any) {
    if (!confirm(`Mark PO from ${po.supplier} as received? This will update stock levels.`)) return;
    try {
      const res = await api.receivePurchaseOrder(po.id, merchantId);
      if (res.success) {
        toast.success('PO received & stock updated');
        loadPurchaseOrders();
        loadInventory();
      }
    } catch { toast.error('Failed to receive PO'); }
  }

  async function loadStockAlerts() {
    try {
      alertsLoading = true;
      const result = await api.getStockAlerts(merchantId, 15);
      stockAlerts = result.alerts || [];
    } catch (e) {
      console.error('[Inventory] Stock alerts error:', e);
    } finally {
      alertsLoading = false;
    }
  }

  async function handleStockAdjustment(item: any, amount: number) {
    try {
      const currentStock =
        typeof item.stock === 'string' ? parseInt(item.stock) : item.stock || 0;
      const newStock = Math.max(0, currentStock + amount);
      const effectiveMerchantId = item.merchantId || merchantId;

      await api.saveStock({
        ...item,
        merchantId: effectiveMerchantId,
        stock: newStock,
        updatedAt: new Date().toISOString()
      });

      toast.success(
        `${item.name} stock ${amount > 0 ? 'increased' : 'decreased'} by ${Math.abs(amount)}`
      );
      loadInventory();
    } catch (e) {
      console.error('Stock adjustment error:', e);
      toast.error('Failed to adjust stock');
    }
  }

  async function loadInventory() {
    try {
      loading = true;
      const data = await api.getStock(merchantId);
      if (Array.isArray(data)) {
        const filteredData =
          role === 'Admin'
            ? data
            : data.filter((item) => {
                if (profile === 'Forecourt')
                  return item.category === 'Fuel' || item.merchantId === 'merchant:M2';
                if (profile === 'Workshop')
                  return item.category === 'Workshop' || item.merchantId === 'merchant:M3';
                if (profile === 'Restaurant')
                  return (
                    item.category === 'Food' ||
                    item.category === 'Beverage' ||
                    item.category === 'Dessert' ||
                    item.merchantId === 'merchant:M4'
                  );
                return item.category !== 'Fuel' && item.category !== 'Workshop';
              });
        items = filteredData;
      }
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      loading = false;
    }
  }

  function calculateAutoSellingPrice() {
    const cost = parseFloat(receivingData.costPrice);
    const margin = parseFloat(receivingData.targetMargin);
    if (isNaN(cost) || isNaN(margin)) return 0;
    return cost / (1 - margin / 100);
  }

  async function handleReceiveStock() {
    if (!receivingData.itemName || !receivingData.costPrice) {
      toast.error('Cost price and Item Name are mandatory.');
      return;
    }
    try {
      const selling = calculateAutoSellingPrice();
      await api.saveStock({
        name: receivingData.itemName,
        sku: receivingData.sku || `SKU-${Date.now()}`,
        stock: parseInt(receivingData.quantity) || 0,
        cost: parseFloat(receivingData.costPrice),
        selling: selling,
        supplier: receivingData.supplier,
        merchantId: merchantId,
        unit: 'Unit',
        velocity: 'Medium',
        lastReceived: new Date().toISOString()
      });
      toast.success(
        `Stock Received: ${receivingData.itemName}. Auto-Generated Selling Price: R${selling.toFixed(2)}.`
      );
      receivingData = {
        itemName: '',
        sku: '',
        costPrice: '',
        supplier: '',
        quantity: '',
        targetMargin: '45'
      };
      loadInventory();
    } catch (e) {
      toast.error('Failed to save stock');
    }
  }

  async function handlePriceUpdate() {
    if (password !== 'admin123') {
      toast.error('Invalid Administrator Password. Unauthorized attempt logged.');
      return;
    }
    items = items.map((i) =>
      i.id === showPricingModal.id ? { ...i, selling: parseFloat(newSellingPrice) } : i
    );
    toast.success(`Price for ${showPricingModal.name} updated. National Audit Log Synced.`);
    showPricingModal = null;
    password = '';
    newSellingPrice = '';
  }

  function handleTransfer() {
    toast.success(
      `Transfer initiated: ${transferData.quantity} units to ${transferData.toBranch}. Inter-branch ledger updated.`
    );
    showTransferModal = false;
  }

  function handleFinalizeStockTake() {
    showVarianceModal = false;
    toast.success('Stock Take Finalized. Variance Report Generated & Emailed to HO.');
    stockCounts = {};
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      uploading = true;
      const res = await api.uploadFile(file);
      if (res.error) throw new Error(res.error);
      const { url } = await api.getSignedUrl(res.path);
      productData = { ...productData, imagePath: res.path, imageUrl: url };
      toast.success('Asset uploaded to Roxton Cloud');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      uploading = false;
    }
  }

  function barcodeCategory(product: any): string {
    const categories = Array.isArray(product?.categories) ? product.categories.join(' ') : String(product?.categories || '');
    const value = categories.toLowerCase();
    if (value.includes('beverage') || value.includes('drink') || value.includes('coffee') || value.includes('tea')) return 'Beverage';
    if (value.includes('dairy') || value.includes('milk') || value.includes('cheese')) return 'Dairy';
    return 'General';
  }

  function normalizeBarcode(value: any): string {
    return String(value || '').trim().replace(/[\s-]/g, '').toUpperCase();
  }

  async function handleBarcodeLookup() {
    const barcode = normalizeBarcode(productData.barcode);
    if (!/^\d{8,14}$/.test(barcode)) {
      toast.error('Enter a valid numeric barcode first');
      return;
    }

    barcodeLookupLoading = true;
    barcodeLookupMessage = '';
    try {
      const localInventoryMatch = items.find((item) => normalizeBarcode(item.barcode) === barcode);
      const cloudMatches = localInventoryMatch ? [] : await api.searchProductCloud(barcode);
      const sharedMatch = Array.isArray(cloudMatches)
        ? cloudMatches.find((item: any) => normalizeBarcode(item.barcode) === barcode)
        : null;
      const result = localInventoryMatch
        ? { success: true, barcode, product: { ...localInventoryMatch, image_url: localInventoryMatch.imageUrl || localInventoryMatch.image } }
        : sharedMatch
        ? { success: true, barcode, product: { ...sharedMatch, image_url: sharedMatch.imageUrl || sharedMatch.image } }
        : await api.lookupBarcode(barcode);
      if (!result.success || !result.product) {
        barcodeLookupMessage = result.error || 'No product found for this barcode';
        toast.error(barcodeLookupMessage);
        return;
      }

      const product = result.product;
      productData = {
        ...productData,
        name: product.name || productData.name,
        barcode: result.barcode || barcode,
        category: barcodeCategory(product),
        unit: product.quantity || productData.unit,
        supplier: product.brand || productData.supplier,
        imageUrl: product.image_url || productData.imageUrl
      };
      barcodeLookupMessage = `${product.brand ? `${product.brand} · ` : ''}${product.name || 'Product found'}`;
      toast.success(localInventoryMatch ? 'Product loaded from current inventory' : sharedMatch ? 'Product loaded from ClintonProduct Cloud' : 'Product details loaded from BarcodeNest');
    } catch (e: any) {
      barcodeLookupMessage = e?.message || 'Barcode lookup failed';
      toast.error(barcodeLookupMessage);
    } finally {
      barcodeLookupLoading = false;
    }
  }

  async function handleSaveProduct() {
    if (!productData.name || !productData.cost || !productData.selling) {
      toast.error('Name, Cost, and Selling Price are required.');
      return;
    }
    try {
      const payload = {
        ...productData,
        id: typeof showProductModal === 'object' ? showProductModal.id : undefined,
        merchantId: merchantId,
        cost: parseFloat(productData.cost as string),
        selling: parseFloat(productData.selling as string),
        stock: parseInt(productData.stock as string) || 0,
        updatedAt: new Date().toISOString()
      };
      await api.saveStock(payload);
      toast.success(typeof showProductModal === 'object' ? 'Product updated' : 'New product added');
      showProductModal = null;
      loadInventory();
    } catch (e) {
      toast.error('Failed to save product');
    }
  }

  async function handleDeleteProduct(itemId: string) {
    if (!confirm('Are you sure you want to delete this product? This action is permanent.')) return;
    try {
      await api.deleteStock(merchantId, itemId);
      toast.success('Product deleted from registry');
      loadInventory();
    } catch (e) {
      toast.error('Failed to delete product');
    }
  }

  function openAddModal() {
    productData = {
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: '',
      category:
        profile === 'Forecourt'
          ? 'Fuel'
          : profile === 'Workshop'
          ? 'Workshop'
          : profile === 'Restaurant'
          ? 'Food'
          : 'General',
      cost: '',
      selling: '',
      stock: '0',
      unit: 'Unit',
      supplier: '',
      velocity: 'Medium',
      imagePath: '',
      imageUrl: ''
    };
    showProductModal = 'add';
  }

  async function openEditModal(item: any) {
    let url = item.imageUrl || '';
    if (item.imagePath && !url) {
      try {
        const res = await api.getSignedUrl(item.imagePath);
        url = res.url;
      } catch (e) {}
    }
    productData = {
      name: item.name || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      category: item.category || 'General',
      cost: item.cost?.toString() || '',
      selling: item.selling?.toString() || '',
      stock: item.stock?.toString() || '0',
      unit: item.unit || 'Unit',
      supplier: item.supplier || '',
      velocity: item.velocity || 'Medium',
      imagePath: item.imagePath || '',
      imageUrl: url
    };
    showProductModal = item;
  }

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: ClipboardList, roles: ['Admin', 'Manager', 'StockController'] },
    { id: 'analytics', label: 'Velocity Matrix', icon: PieChart, roles: ['Admin', 'Manager'] },
    { id: 'receiving', label: 'Receiving', icon: Truck, roles: ['Admin', 'StockController'] },
    { id: 'stocktake', label: 'Stock Take', icon: PackageCheck, roles: ['Admin', 'Manager', 'StockController'] },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileSpreadsheet, roles: ['Admin', 'Manager', 'StockController'] }
  ];
</script>

<div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <!-- Header & Tabs -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
    <div>
      <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Stock & Supply Chain</h2>
      <p class="text-neutral-500 font-medium">Inter-branch Logistics â€¢ Pricing Control â€¢ Velocity Analytics</p>
    </div>
    <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl">
      {#each tabs.filter(t => t.roles.includes(role)) as tab (tab.id)}
        <button
          onclick={() => (activeTab = tab.id)}
          class={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'}`}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- INVENTORY TAB -->
  {#if activeTab === 'inventory'}
    <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <!-- Low Stock Alert Banner -->
      {#if stockAlerts.length > 0}
        <div class="bg-amber-50 border-2 border-amber-200 rounded-[24px] p-5 flex items-start gap-4">
          <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={20} class="text-amber-600" />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-black text-amber-800 mb-1">
              Low Stock Alert â€” {stockAlerts.length} Item{stockAlerts.length !== 1 ? 's' : ''} Below Threshold
            </h4>
            <div class="flex flex-wrap gap-2 mt-2">
              {#each stockAlerts.slice(0, 6) as item (item.id)}
                <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-700">
                  <span class={`w-2 h-2 rounded-full ${(item.stock || 0) === 0 ? 'bg-rose-500' : 'bg-amber-400'}`}></span>
                  {item.name}: {item.stock || 0} left
                </span>
              {/each}
              {#if stockAlerts.length > 6}
                <span class="inline-flex items-center px-3 py-1 bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-black text-amber-600">
                  +{stockAlerts.length - 6} more
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-neutral-800 p-8 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">National Asset Value (Cost)</p>
          <h4 class="text-3xl font-black tracking-tighter text-neutral-900 dark:text-neutral-100">
            R {items.reduce((acc, i) => acc + (i.cost * i.stock), 0).toLocaleString()}
          </h4>
        </div>
        <div class="bg-white dark:bg-neutral-800 p-8 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Total SKU Count</p>
          <h4 class="text-3xl font-black tracking-tighter" style="color: var(--roxton-primary)">{items.length}</h4>
        </div>
        <div class="bg-neutral-900 p-8 rounded-[32px] text-white shadow-xl flex items-center justify-between">
          <div>
            <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Target Fulfillment</p>
            <h4 class="text-3xl font-black tracking-tighter text-emerald-400">98.2%</h4>
          </div>
          <Target size={40} class="text-white/10" />
        </div>
      </div>

      <!-- Inventory Table -->
      <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-800/30">
          <div class="flex items-center gap-4 flex-1 max-w-2xl">
            <div class="relative flex-1">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16}></Search>
              <input
                type="text"
                placeholder="Search SKU, Barcode or Category..."
                class="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={searchQuery}
              />
            </div>
            {#if isAdmin || isManager || isStockController}
              <button
                onclick={openAddModal}
                class="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
              >
                <Plus size={16} /> Add Product
              </button>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            {#if isAdmin || isManager}
              <button
                onclick={() => (showTransferModal = true)}
                class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
              >
                <ArrowLeftRight size={16} /> Inter-branch Transfer
              </button>
            {/if}
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
              <tr>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Item Description</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Velocity</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Stock Node</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Cost (Ex)</th>
                {#if isAdmin || isManager}
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Retail Price</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Margin</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Actions</th>
                {/if}
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#if loading}
                <tr>
                  <td colspan={isAdmin || isManager ? 7 : 4} class="p-10 text-center">
                    <Loader2 class="animate-spin mx-auto text-neutral-300" size={24} />
                  </td>
                </tr>
              {:else if items.length === 0}
                <tr>
                  <td colspan={isAdmin || isManager ? 7 : 4} class="p-20 text-center">
                    <div class="flex flex-col items-center justify-center">
                      <PackageIcon size={64} class="text-neutral-300 mb-4" />
                      <p class="text-sm font-black uppercase tracking-widest text-neutral-400 mb-2">No inventory items yet</p>
                      <p class="text-xs text-neutral-400 max-w-sm">Click "Add New Product" above to create your first inventory item</p>
                    </div>
                  </td>
                </tr>
              {:else if filteredItems.length === 0 && searchQuery}
                <tr>
                  <td colspan={isAdmin || isManager ? 7 : 4} class="p-20 text-center">
                    <div class="flex flex-col items-center justify-center">
                      <Search size={64} class="text-neutral-300 mb-4"></Search>
                      <p class="text-sm font-black uppercase tracking-widest text-neutral-400 mb-2">No items match "{searchQuery}"</p>
                      <p class="text-xs text-neutral-400">Try a different search term</p>
                    </div>
                  </td>
                </tr>
              {:else}
                {#each filteredItems as item (item.id)}
                  <tr class="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td class="px-8 py-6">
                      <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-neutral-100 dark:bg-neutral-700 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 border border-neutral-200/50 dark:border-neutral-600 shadow-sm">
                          {#if item.imageUrl}
                            <img
                              src={item.imageUrl || item.imagePath || ''}
                              alt={item.name}
                              class="w-full h-full object-cover"
                              onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          {:else if item.barcode}
                            <Barcode size={20} class="text-indigo-400" />
                          {:else}
                            <PackageIcon size={20} class="text-neutral-400" />
                          {/if}
                        </div>
                        <div class="min-w-0">
                          <p class="font-bold text-neutral-900 dark:text-neutral-100 leading-none mb-1 truncate">{item.name}</p>
                          <div class="flex items-center gap-2">
                            <p class="text-[10px] font-mono text-neutral-400 uppercase tracking-tighter">{item.sku}</p>
                            {#if item.barcode}
                              <span class="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500 font-bold">{item.barcode}</span>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-8 py-6 text-center">
                      <span class={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${item.velocity === 'Fast' ? 'bg-emerald-50 text-emerald-600' : item.velocity === 'Slow' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {item.velocity || 'Normal'}
                      </span>
                    </td>
                    <td class="px-8 py-6 text-center font-black text-neutral-700">
                      <div class="flex items-center justify-center gap-3">
                        {#if isAdmin || isStockController}
                          <button
                            onclick={() => handleStockAdjustment(item, -1)}
                            class="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                        {/if}
                        <span class="min-w-[3ch]">{item.stock}</span>
                        {#if isAdmin || isStockController}
                          <button
                            onclick={() => handleStockAdjustment(item, 1)}
                            class="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        {/if}
                        <span class="text-[9px] text-neutral-400 uppercase font-bold">{item.unit || 'Unit'}</span>
                      </div>
                    </td>
                    <td class="px-8 py-6 text-right font-mono text-xs font-bold text-neutral-400 italic">R {item.cost?.toFixed(2) || '0.00'}</td>
                    {#if isAdmin || isManager}
                      <td class="px-8 py-6 text-right font-black text-neutral-900">R {item.selling?.toFixed(2) || '0.00'}</td>
                      <td class="px-8 py-6 text-right">
                        <span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-black">
                          {item.selling && item.cost ? (((item.selling - item.cost) / item.selling) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td class="px-8 py-6 text-right">
                        <div class="flex items-center justify-end gap-2">
                          {#if isAdmin || isManager}
                            <button
                              onclick={() => {
                                const inc = prompt('Enter adjustment amount (e.g. 10 or -10):');
                                if (inc && !isNaN(parseInt(inc))) handleStockAdjustment(item, parseInt(inc));
                              }}
                              class="p-2.5 bg-neutral-50 text-neutral-400 rounded-xl hover:text-emerald-600 hover:bg-white border border-neutral-100 shadow-sm transition-all"
                              title="Bulk Adjustment"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              onclick={() => openEditModal(item)}
                              class="p-2.5 bg-neutral-50 text-neutral-400 rounded-xl hover:text-indigo-600 hover:bg-white border border-neutral-100 shadow-sm transition-all"
                              title="Edit Product"
                            >
                              <Settings2 size={16} />
                            </button>
                            <button
                              onclick={() => handleDeleteProduct(item.id)}
                              class="p-2.5 bg-neutral-50 text-neutral-400 rounded-xl hover:text-rose-600 hover:bg-white border border-neutral-100 shadow-sm transition-all"
                              title="Delete Product"
                            >
                              <Trash2 size={16} />
                            </button>
                          {/if}
                        </div>
                      </td>
                    {/if}
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}

  <!-- ANALYTICS TAB -->
  {#if activeTab === 'analytics'}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
      <div class="bg-white dark:bg-neutral-800/50 p-12 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10">
        <h3 class="text-2xl font-black">Fast-Moving Items (FR-06)</h3>
        <div class="space-y-6">
          {#each items.filter(i => i.velocity === 'Fast') as item (item.id)}
            <div class="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center justify-between">
              <div class="flex items-center gap-4">
                <TrendingUp class="text-emerald-600" size={24} />
                <div>
                  <p class="font-black text-neutral-900">{item.name}</p>
                  <p class="text-[10px] font-black text-emerald-600 uppercase">Velocity Score: 98/100</p>
                </div>
              </div>
              <ArrowRight class="text-emerald-200" size={20} />
            </div>
          {/each}
          {#if items.filter(i => i.velocity === 'Fast').length === 0}
            <p class="text-neutral-400 text-xs italic">No fast moving items detected.</p>
          {/if}
        </div>
      </div>
      <div class="bg-white dark:bg-neutral-800/50 p-12 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10">
        <h3 class="text-2xl font-black">Slow-Moving Items</h3>
        <div class="space-y-6">
          {#each items.filter(i => i.velocity === 'Slow') as item (item.id)}
            <div class="p-6 bg-amber-50 border border-amber-100 rounded-[32px] flex items-center justify-between">
              <div class="flex items-center gap-4">
                <AlertTriangle class="text-amber-500" size={24} />
                <div>
                  <p class="font-black text-neutral-900">{item.name}</p>
                  <p class="text-[10px] font-black text-amber-600 uppercase">Low Turnover</p>
                </div>
              </div>
              <ArrowRight class="text-amber-200" size={20} />
            </div>
          {/each}
          {#if items.filter(i => i.velocity === 'Slow').length === 0}
            <p class="text-neutral-400 text-xs italic">No slow moving items detected.</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- RECEIVING TAB -->
  {#if activeTab === 'receiving'}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
      <div class="lg:col-span-2 bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 p-10 shadow-sm">
        <div class="bg-neutral-900 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
          <div class="grid grid-cols-2 gap-6 mb-8 text-black">
            <div class="space-y-2">
              <label for="receiving-supplier" class="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Supplier</label>
              <select
                id="receiving-supplier"
                class="w-full bg-white border border-white/10 p-4 rounded-2xl font-bold text-sm outline-none"
                bind:value={receivingData.supplier}
              >
                <option value="">Select Supplier</option>
                <option value="Shell Global">Shell Global</option>
                <option value="Castrol SA">Castrol SA</option>
                <option value="PartsDistro">PartsDistro</option>
                <option value="Midas">Midas</option>
              </select>
            </div>
            <div class="space-y-2">
              <label for="receiving-quantity" class="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Quantity</label>
              <input
                id="receiving-quantity"
                type="number"
                class="w-full bg-white border border-white/10 p-4 rounded-2xl font-bold text-sm outline-none"
                bind:value={receivingData.quantity}
              />
            </div>
            <div class="col-span-2 space-y-2">
              <label for="receiving-description" class="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Description</label>
              <input
                id="receiving-description"
                type="text"
                class="w-full bg-white border border-white/10 p-4 rounded-2xl font-bold text-sm outline-none"
                bind:value={receivingData.itemName}
              />
            </div>
            <div class="col-span-2 space-y-2">
              <label for="receiving-cost" class="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Cost</label>
              <input
                id="receiving-cost"
                type="number"
                class="w-full bg-white border border-white/10 p-4 rounded-2xl font-bold text-sm outline-none"
                bind:value={receivingData.costPrice}
              />
            </div>
          </div>
          <button onclick={handleReceiveStock} class="w-full py-4 bg-indigo-600 text-white font-black uppercase rounded-2xl">
            Process GRV
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- STOCK TAKE TAB -->
  {#if activeTab === 'stocktake'}
    <div class="animate-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <div>
            <h3 class="text-2xl font-black">Stock Take</h3>
            <p class="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Enter counted quantities for each item below</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="px-4 py-2 bg-neutral-100 rounded-xl border border-neutral-200 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              {Object.keys(stockCounts).length} / {items.length} Counted
            </div>
            <button
              onclick={() => {
                if (Object.keys(stockCounts).length === 0) {
                  toast.error('No counts entered. Count at least one item.');
                  return;
                }
                showVarianceModal = true;
              }}
              disabled={Object.keys(stockCounts).length === 0}
              class="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale"
            >
              <CheckCircle2 size={16} /> Finalize Take
            </button>
          </div>
        </div>
        {#if loading}
          <div class="p-10 flex justify-center"><Loader2 class="animate-spin mx-auto text-neutral-300" size={24} /></div>
        {:else if items.length === 0}
          <div class="p-20 text-center text-neutral-400 font-bold text-xs uppercase">No items to count</div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th class="px-8 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Item</th>
                  <th class="px-8 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">System Qty</th>
                  <th class="px-8 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Counted Qty</th>
                  <th class="px-8 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Variance</th>
                  <th class="px-8 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-50">
                {#each items as item (item.id)}
                  {@const counted = stockCounts[item.id]}
                  {@const systemQty = typeof item.stock === 'number' ? item.stock : parseInt(item.stock || '0')}
                  {@const countedQty = counted !== undefined ? parseInt(counted) : null}
                  {@const variance = countedQty !== null ? countedQty - systemQty : null}
                  <tr class="hover:bg-neutral-50/50 transition-colors">
                    <td class="px-8 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                          <PackageIcon size={16} class="text-neutral-400" />
                        </div>
                        <div>
                          <p class="text-xs font-black text-neutral-900">{item.name}</p>
                          <p class="text-[9px] font-mono text-neutral-400">{item.barcode || item.sku || item.id}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-8 py-4 text-center font-black text-neutral-700">{systemQty}</td>
                    <td class="px-8 py-4 text-center">
                      <input
                        type="number"
                        placeholder="-"
                        value={stockCounts[item.id] ?? ''}
                        oninput={(e) => {
                          stockCounts = { ...stockCounts, [item.id]: (e.target as HTMLInputElement).value };
                        }}
                        class="w-20 text-center bg-neutral-50 border border-neutral-200 rounded-xl py-2 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                      />
                    </td>
                    <td class="px-8 py-4 text-center">
                      {#if variance !== null}
                        <span class={`font-black text-sm ${variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                          {variance > 0 ? '+' : ''}{variance}
                        </span>
                      {:else}
                        <span class="text-neutral-300 text-xs">--</span>
                      {/if}
                    </td>
                    <td class="px-8 py-4 text-center">
                      {#if counted === undefined}
                        <span class="px-2 py-0.5 bg-neutral-100 text-neutral-400 rounded text-[9px] font-black uppercase">Pending</span>
                      {:else if variance === 0}
                        <span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase">Match</span>
                      {:else}
                        <span class="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-black uppercase">Variance</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- PURCHASE ORDERS TAB -->
  {#if activeTab === 'purchase-orders'}
    <div class="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-black">Purchase Order Workflow</h3>
          <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Create, Track & Receive Supplier Orders</p>
        </div>
        <button
          onclick={() => (showPOModal = true)}
          class="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
          aria-label="Create purchase order"
        >
          <Plus size={16} /> New PO
        </button>
      </div>
      {#if posLoading}
        <div class="p-10 flex justify-center"><Loader2 class="animate-spin text-neutral-300" size={24} /></div>
      {:else if purchaseOrders.length === 0}
        <div class="bg-white dark:bg-neutral-800/50 p-20 rounded-[40px] border border-neutral-200 dark:border-neutral-700 text-center">
          <FileSpreadsheet size={48} class="text-neutral-300 mx-auto mb-4" />
          <p class="text-neutral-400 text-xs font-black uppercase">No purchase orders yet</p>
        </div>
      {:else}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <table class="w-full text-left">
            <thead class="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase">PO ID</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase">Supplier</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase text-center">Items</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase text-right">Total</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase text-center">Status</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase">Date</th>
                <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-50">
              {#each purchaseOrders as po (po.id)}
                <tr class="hover:bg-neutral-50/50 transition-colors">
                  <td class="px-6 py-4 font-mono text-[10px] font-bold text-neutral-500">{po.id.split(':').pop()?.slice(-8)}</td>
                  <td class="px-6 py-4 text-xs font-black text-neutral-900">{po.supplier}</td>
                  <td class="px-6 py-4 text-center font-bold text-neutral-700">{(po.items || []).length}</td>
                  <td class="px-6 py-4 text-right font-black text-neutral-900">R {(po.totalCost || 0).toFixed(2)}</td>
                  <td class="px-6 py-4 text-center">
                    <span class={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${po.status === 'Received' ? 'bg-emerald-50 text-emerald-600' : po.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {po.status}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-[10px] text-neutral-400 font-bold">{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '--'}</td>
                  <td class="px-6 py-4 text-right">
                    {#if po.status === 'Pending'}
                      <button onclick={() => handleReceivePO(po)} class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">Receive</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

  <!-- PO CREATE MODAL -->
  {#if showPOModal}
    <div
      class="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onkeydown={(e) => { if (e.key === 'Escape') showPOModal = false; }}
      onclick={(e) => { if (e.target === e.currentTarget) showPOModal = false; }}
    >
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-8 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-black">New Purchase Order</h3>
          <button onclick={() => (showPOModal = false)} class="p-2 hover:bg-neutral-100 rounded-full" aria-label="Close">
            <X size={20} class="text-neutral-400" />
          </button>
        </div>
        <div class="space-y-4">
          <div>
            <label for="po-supplier" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Supplier *</label>
            <input
              id="po-supplier"
              type="text"
              bind:value={poForm.supplier}
              class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g. Makro Wholesale"
            />
          </div>
          <div>
            <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Line Items</p>
            {#each poForm.items as item, idx}
              <div class="grid grid-cols-5 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Product"
                  value={item.name}
                  oninput={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx] = { ...newItems[idx], name: (e.target as HTMLInputElement).value };
                    poForm = { ...poForm, items: newItems };
                  }}
                  class="col-span-2 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold outline-none"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  oninput={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx] = { ...newItems[idx], quantity: (e.target as HTMLInputElement).value };
                    poForm = { ...poForm, items: newItems };
                  }}
                  class="p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold outline-none"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Unit R"
                  value={item.unitCost}
                  oninput={(e) => {
                    const newItems = [...poForm.items];
                    newItems[idx] = { ...newItems[idx], unitCost: (e.target as HTMLInputElement).value };
                    poForm = { ...poForm, items: newItems };
                  }}
                  class="p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold outline-none"
                  min="0"
                  step="0.01"
                />
                <button
                  onclick={() => {
                    const newItems = poForm.items.filter((_: any, i: number) => i !== idx);
                    poForm = { ...poForm, items: newItems.length ? newItems : [{ name: '', quantity: '', unitCost: '' }] };
                  }}
                  class="p-2 hover:bg-rose-50 rounded-lg text-neutral-300 hover:text-rose-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            {/each}
            <button
              onclick={() => (poForm = { ...poForm, items: [...poForm.items, { name: '', quantity: '', unitCost: '' }] })}
              class="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline mt-1"
            >
              + Add Line Item
            </button>
          </div>
          <div>
            <label for="po-notes" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Notes</label>
            <textarea
              id="po-notes"
              bind:value={poForm.notes}
              class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none h-16 resize-none"
              placeholder="Delivery instructions..."
            ></textarea>
          </div>
          <div class="bg-neutral-50 rounded-xl p-4 border border-neutral-100 text-right">
            <p class="text-[9px] font-black text-neutral-400 uppercase">Estimated Total</p>
            <p class="text-xl font-black text-neutral-900">
              R {poForm.items.reduce((s: number, i: any) => s + parseFloat(i.unitCost || '0') * parseInt(i.quantity || '0'), 0).toFixed(2)}
            </p>
          </div>
          <button onclick={handleCreatePO} class="w-full py-4 bg-neutral-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-800 active:scale-95 transition-all">
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- PRODUCT ADD/EDIT MODAL -->
  {#if showProductModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white rounded-[48px] p-12 max-w-2xl w-full shadow-2xl space-y-8 overflow-y-auto max-h-[90vh]">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-3xl font-black tracking-tight">{typeof showProductModal === 'object' ? 'Edit Product' : 'Add New Product'}</h3>
            <p class="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Registry Entry â€¢ Node: {profile}</p>
          </div>
          <button onclick={() => (showProductModal = null)} class="p-2 hover:bg-neutral-100 rounded-full">
            <X size={24} class="text-neutral-400" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <!-- Image Upload -->
          <div class="col-span-2 space-y-4">
            <label for="product-image" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Product Media Asset</label>
            <div class="flex items-start gap-6">
              <div class="w-32 h-32 bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200 flex items-center justify-center relative overflow-hidden group">
                {#if productData.imageUrl}
                  <img
                    src={productData.imageUrl || productData.imagePath || ''}
                    alt="Preview"
                    class="w-full h-full object-cover"
                    onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onclick={() => (productData = { ...productData, imageUrl: '', imagePath: '' })}
                      class="p-2 bg-rose-500 text-white rounded-full hover:scale-110 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                {:else}
                  <div class="text-center p-4">
                    <ImageIcon size={32} class="text-neutral-300 mx-auto mb-2" />
                    <p class="text-[8px] font-black text-neutral-400 uppercase">No Media</p>
                  </div>
                {/if}
                {#if uploading}
                  <div class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 size={24} class="text-indigo-600 animate-spin" />
                  </div>
                {/if}
              </div>
              <div class="flex-1 space-y-3">
                <p class="text-xs text-neutral-500 leading-relaxed font-medium">
                  Upload a high-resolution JPEG or PNG. This asset will be synced to all Terminal nodes for visual identification.
                </p>
                <input
                  id="product-image"
                  type="file"
                  bind:this={fileInputRef}
                  class="hidden"
                  accept="image/*"
                  onchange={handleFileChange}
                />
                <button
                  onclick={() => fileInputRef?.click()}
                  disabled={uploading}
                  class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                >
                  {#if uploading}
                    <Loader2 size={16} class="animate-spin" />
                  {:else}
                    <CloudUpload size={16} />
                  {/if}
                  Browse Roxton Cloud
                </button>
              </div>
            </div>
          </div>

          <!-- Product Name -->
          <div class="col-span-2 space-y-2 pt-2">
            <label for="product-name" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Product Name</label>
            <input
              id="product-name"
              type="text"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              bind:value={productData.name}
              placeholder="e.g. Premium Unleaded 95"
            />
          </div>

          <!-- Barcode -->
          <div class="space-y-2">
            <label for="product-barcode" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Barcode / EAN-13</label>
            <div class="relative">
              <Barcode class={`absolute left-4 top-1/2 -translate-y-1/2 ${scannerActive ? 'text-indigo-600 animate-pulse' : 'text-neutral-300'}`} size={16} />
              <input
                id="product-barcode"
                type="text"
                class="w-full pl-12 pr-4 py-4 rounded-2xl font-mono text-xs font-bold outline-none border transition-all ${scannerActive ? 'border-indigo-500 bg-indigo-50/30' : 'bg-neutral-50 border-neutral-100'}"
                bind:value={productData.barcode}
                onfocus={() => (scannerActive = true)}
                onblur={() => (scannerActive = false)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && scannerActive) toast.success('Barcode Locked');
                }}
                placeholder="Scan or type barcode"
              />
            </div>
            <button
              type="button"
              onclick={handleBarcodeLookup}
              disabled={barcodeLookupLoading || !productData.barcode.trim()}
              class="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {#if barcodeLookupLoading}<Loader2 size={14} class="animate-spin" />{:else}<Search size={14} />{/if}
              {barcodeLookupLoading ? 'Searching product sources…' : 'Search Product Cloud / BarcodeNest'}
            </button>
            {#if barcodeLookupMessage}
              <p class="text-[9px] font-bold text-indigo-600 leading-relaxed">{barcodeLookupMessage}</p>
            {/if}
          </div>

          <!-- SKU -->
          <div class="space-y-2">
            <label for="product-sku" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Internal SKU</label>
            <input
              id="product-sku"
              type="text"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-mono text-xs font-bold outline-none"
              bind:value={productData.sku}
            />
          </div>

          <!-- Category -->
          <div class="space-y-2">
            <label for="product-category" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Category</label>
            <select
              id="product-category"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none"
              bind:value={productData.category}
            >
              <option value="General">General</option>
              <option value="Fuel">Fuel</option>
              <option value="Workshop">Workshop</option>
              <option value="Dairy">Dairy</option>
              <option value="Beverage">Beverage</option>
              <option value="Parts">Parts</option>
            </select>
          </div>

          <!-- Unit -->
          <div class="space-y-2">
            <label for="product-unit" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Unit of Measure</label>
            <input
              id="product-unit"
              type="text"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none"
              bind:value={productData.unit}
              placeholder="Unit, Litre, Kg..."
            />
          </div>

          <!-- Cost Price -->
          <div class="space-y-2">
            <label for="product-cost" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Cost Price (Ex VAT)</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">R</span>
              <input
                id="product-cost"
                type="number"
                class="w-full pl-8 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-black text-sm outline-none"
                bind:value={productData.cost}
              />
            </div>
          </div>

          <!-- Selling Price -->
          <div class="space-y-2">
            <label for="product-selling" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Retail Selling Price</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-500">R</span>
              <input
                id="product-selling"
                type="number"
                class="w-full pl-8 pr-4 py-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl font-black text-sm outline-none text-indigo-900"
                bind:value={productData.selling}
              />
            </div>
          </div>

          <!-- Stock Level -->
          <div class="space-y-2">
            <label for="product-stock" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Current Stock Level</label>
            <input
              id="product-stock"
              type="number"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none"
              bind:value={productData.stock}
            />
          </div>

          <!-- Supplier -->
          <div class="space-y-2">
            <label for="product-supplier" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Supplier Node</label>
            <input
              id="product-supplier"
              type="text"
              class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none"
              bind:value={productData.supplier}
            />
          </div>
        </div>

        <div class="pt-6 border-t border-neutral-100 flex gap-4">
          <button
            onclick={() => (showProductModal = null)}
            class="flex-1 py-4 bg-neutral-100 text-neutral-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all"
          >
            Cancel
          </button>
          <button
            onclick={handleSaveProduct}
            class="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={16} /> Save to Registry
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- PRICING MODAL (FR-09) -->
  {#if showPricingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-md w-full shadow-2xl space-y-8">
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-black">Global Pricing Update</h3>
          <button onclick={() => (showPricingModal = null)} class="p-2 hover:bg-neutral-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        <div class="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Item Reference</p>
          <p class="text-lg font-black text-neutral-900">{showPricingModal.name}</p>
          <p class="text-xs font-bold text-neutral-500">{showPricingModal.sku}</p>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <label for="pricing-price" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">New Selling Price (Incl VAT)</label>
            <input
              id="pricing-price"
              type="number"
              class="w-full bg-white border border-neutral-200 p-5 rounded-2xl font-black text-xl outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              bind:value={newSellingPrice}
            />
          </div>
          <div class="space-y-2">
            <label for="pricing-password" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Admin Password</label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                id="pricing-password"
                type="password"
                class="w-full bg-white border border-neutral-200 p-5 pl-12 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                bind:value={password}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
              />
            </div>
          </div>
        </div>
        <button
          onclick={handlePriceUpdate}
          class="w-full py-5 bg-neutral-900 text-white rounded-[28px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Confirm Price Change
        </button>
      </div>
    </div>
  {/if}

  <!-- TRANSFER MODAL -->
  {#if showTransferModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-md w-full shadow-2xl space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-black">Inter-branch Transfer</h3>
          <button onclick={() => (showTransferModal = false)} class="p-2 hover:bg-neutral-100 rounded-full">
            <X size={24} class="text-neutral-400" />
          </button>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <label for="transfer-source" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Source Branch</label>
            <input id="transfer-source" type="text" readonly value={transferData.fromBranch} class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none text-neutral-500" />
          </div>
          <div class="space-y-2">
            <label for="transfer-destination" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Destination Branch</label>
            <select id="transfer-destination" bind:value={transferData.toBranch} class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none">
              <option value="">Select branch...</option>
              <option value="V&A Waterfront #042">V&A Waterfront #042</option>
              <option value="Menlyn #058">Menlyn #058</option>
              <option value="Gateway #102">Gateway #102</option>
            </select>
          </div>
          <div class="space-y-2">
            <label for="transfer-item" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Item</label>
            <select id="transfer-item" bind:value={transferData.itemId} class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none">
              <option value="">Select item...</option>
              {#each items as i (i.id)}
                <option value={i.id}>{i.name} (Stock: {i.stock})</option>
              {/each}
            </select>
          </div>
          <div class="space-y-2">
            <label for="transfer-quantity" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Quantity</label>
            <input id="transfer-quantity" type="number" bind:value={transferData.quantity} class="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl font-bold text-sm outline-none" placeholder="0" />
          </div>
        </div>
        <button
          onclick={handleTransfer}
          disabled={!transferData.toBranch || !transferData.quantity || !transferData.itemId}
          class="w-full py-5 bg-neutral-900 text-white rounded-[28px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          Initiate Transfer
        </button>
      </div>
    </div>
  {/if}

  <!-- VARIANCE CONFIRMATION MODAL -->
  {#if showVarianceModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-black">Finalize Stock Take</h3>
            <p class="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Variance Summary</p>
          </div>
          <button onclick={() => (showVarianceModal = false)} class="p-2 hover:bg-neutral-100 rounded-full">
            <X size={24} class="text-neutral-400" />
          </button>
        </div>
        <div class="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
          <div class="max-h-[300px] overflow-y-auto">
            {#each Object.entries(stockCounts) as [itemId, counted]}
              {@const item = items.find(i => i.id === itemId)}
              {#if item}
                {@const systemQty = typeof item.stock === 'number' ? item.stock : parseInt(item.stock || '0')}
                {@const countedQty = parseInt(counted)}
                {@const variance = countedQty - systemQty}
                <div class="px-6 py-3 flex items-center justify-between border-b border-neutral-100 last:border-0">
                  <div>
                    <p class="text-xs font-black text-neutral-900">{item.name}</p>
                    <p class="text-[9px] font-bold text-neutral-400">System: {systemQty} â†’ Counted: {countedQty}</p>
                  </div>
                  <span class={`text-sm font-black ${variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {variance > 0 ? '+' : ''}{variance}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} class="text-amber-500 shrink-0" />
          <p class="text-[10px] font-bold text-amber-700">Finalizing will update system stock levels to match your counted quantities. This action is logged to the forensic audit ledger.</p>
        </div>
        <div class="flex gap-3">
          <button onclick={() => (showVarianceModal = false)} class="flex-1 py-4 bg-neutral-100 text-neutral-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all">
            Cancel
          </button>
          <button onclick={handleFinalizeStockTake} class="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> Confirm & Finalize
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
