<script lang="ts">
  import {
    Users, Search, Plus, X, Phone, Mail, MapPin, Heart, ShoppingCart,
    TrendingUp, Star, ChevronRight, Edit3, Loader2, UserPlus, Hash, Clock
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';

  interface Customer {
    id: string;
    name: string;
    phone: string;
    email: string;
    address?: string;
    loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
    points: number;
    totalSpent: number;
    visitCount: number;
    lastVisit?: string;
    notes?: string;
    merchantId: string;
    createdAt: string;
  }

  const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Bronze: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    Silver: { bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-300' },
    Gold: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    Platinum: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  };

  let { merchantId }: { merchantId: string } = $props();

  let customers = $state<Customer[]>([]);
  let loading = $state(true);
  let search = $state('');
  let showAddModal = $state(false);
  let selectedCustomer = $state<Customer | null>(null);
  let saving = $state(false);

  let form = $state({
    name: '', phone: '', email: '', address: '', notes: ''
  });

  $effect(() => {
    loadCustomers();
  });

  const loadCustomers = async () => {
    try {
      loading = true;
      const data = await api.getCustomers(merchantId);
      if (Array.isArray(data)) customers = data;
    } catch {
      toast.error('Failed to load customers');
    } finally {
      loading = false;
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast.error('Name and phone are required');
      return;
    }
    saving = true;
    try {
      const customerData = {
        ...form,
        merchantId,
        id: selectedCustomer?.id || `cust:${merchantId}:${Date.now()}`,
        loyaltyTier: selectedCustomer?.loyaltyTier || 'Bronze',
        points: selectedCustomer?.points || 0,
        totalSpent: selectedCustomer?.totalSpent || 0,
        visitCount: selectedCustomer?.visitCount || 0,
        createdAt: selectedCustomer?.createdAt || new Date().toISOString(),
      };
      const result = await api.saveCustomer(customerData);
      if (result.success) {
        toast.success(selectedCustomer ? 'Customer updated' : 'Customer added');
        showAddModal = false;
        selectedCustomer = null;
        form = { name: '', phone: '', email: '', address: '', notes: '' };
        loadCustomers();
      }
    } catch {
      toast.error('Failed to save customer');
    } finally {
      saving = false;
    }
  };

  const openEdit = (c: Customer) => {
    selectedCustomer = c;
    form = { name: c.name, phone: c.phone, email: c.email, address: c.address || '', notes: c.notes || '' };
    showAddModal = true;
  };

  const filtered = $derived(
    customers.filter((c: Customer) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalCustomers = $derived(customers.length);
  const totalLoyaltyPoints = $derived(customers.reduce((s: number, c: Customer) => s + (c.points || 0), 0));
  const totalRevenue = $derived(customers.reduce((s: number, c: Customer) => s + (c.totalSpent || 0), 0));
</script>

<div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
    <div>
      <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Customer Intelligence</h2>
      <p class="text-neutral-500 font-medium">CRM Database â€¢ Loyalty Management â€¢ Purchase History</p>
    </div>
    <button
      onclick={() => { selectedCustomer = null; form = { name: '', phone: '', email: '', address: '', notes: '' }; showAddModal = true; }}
      class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-sm font-bold shadow-xl active:scale-95 transition-all"
      aria-label="Add new customer"
    >
      <UserPlus class="w-4 h-4" /> New Customer
    </button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
      <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Total Customers</p>
      <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{totalCustomers}</h4>
      <p class="text-[10px] text-emerald-500 font-black mt-2">Registered members</p>
    </div>
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
      <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Loyalty Points Pool</p>
      <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{totalLoyaltyPoints.toLocaleString()}</h4>
      <p class="text-[10px] text-amber-500 font-black mt-2">Across all tiers</p>
    </div>
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
      <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Customer Revenue</p>
      <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">R {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
      <p class="text-[10px] text-indigo-500 font-black mt-2">Lifetime value</p>
    </div>
    <div class="bg-indigo-900 p-6 rounded-[32px] text-white shadow-xl flex items-center justify-between">
      <div>
        <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Avg. Basket</p>
        <h4 class="text-2xl font-black tracking-tighter">
          R {totalCustomers > 0 ? (totalRevenue / Math.max(customers.reduce((s: number, c: Customer) => s + (c.visitCount || 1), 0), 1)).toFixed(2) : '0.00'}
        </h4>
      </div>
      <ShoppingCart class="w-10 h-10 text-white/10" />
    </div>
  </div>

  <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
    <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
      <h3 class="text-xl font-black dark:text-neutral-100">Customer Directory</h3>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400"></Search>
        <input
          type="text" placeholder="Search by name, phone, email..."
          class="pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none w-72 dark:text-neutral-100 dark:placeholder-neutral-500"
          bind:value={search}
          aria-label="Search customers"
        />
      </div>
    </div>

    {#if loading}
      <div class="p-10 flex justify-center"><Loader2 class="animate-spin text-neutral-300" /></div>
    {:else if filtered.length === 0}
      <div class="p-20 text-center text-neutral-400 text-xs font-black uppercase">
        {search ? 'No customers match search' : 'No customers registered yet'}
      </div>
    {:else}
      <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
        {#each filtered as customer (customer.id)}
          {@const tier = TIER_COLORS[customer.loyaltyTier] || TIER_COLORS.Bronze}
          <div
            class="p-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-all cursor-pointer group"
            onclick={() => openEdit(customer)}
            role="button"
            tabindex="0"
            aria-label={`Customer ${customer.name}`}
            onkeydown={e => e.key === 'Enter' && openEdit(customer)}
          >
            <div class="flex items-center gap-5">
              <div class="w-12 h-12 bg-neutral-900 text-white rounded-xl flex items-center justify-center text-sm font-black uppercase">
                {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{customer.name}</p>
                <div class="flex items-center gap-3 mt-0.5">
                  <span class="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                    <Phone class="w-3 h-3" /> {customer.phone}
                  </span>
                  {#if customer.email}
                    <span class="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                      <Mail class="w-3 h-3" /> {customer.email}
                    </span>
                  {/if}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-6">
              <div class="text-right hidden md:block">
                <p class="text-xs font-black text-neutral-900 dark:text-neutral-200">{customer.points.toLocaleString()} pts</p>
                <p class="text-[9px] font-bold text-neutral-400">{customer.visitCount} visits</p>
              </div>
              <div class="text-right hidden lg:block">
                <p class="text-xs font-black text-neutral-900 dark:text-neutral-200">R {(customer.totalSpent || 0).toFixed(2)}</p>
                <p class="text-[9px] font-bold text-neutral-400">Lifetime</p>
              </div>
              <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border {tier.bg} {tier.text} {tier.border}">
                {customer.loyaltyTier}
              </span>
              <ChevronRight class="w-4 h-4 text-neutral-300 group-hover:text-neutral-600 transition-colors" />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#key showAddModal}
    {#if showAddModal}
      <div class="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={selectedCustomer ? 'Edit customer' : 'Add customer'}>
        <div
          transition:fly={{ y: 20, scale: 0.9, opacity: 0, duration: 200 }}
          class="bg-white dark:bg-neutral-900 rounded-[40px] p-8 max-w-lg w-full shadow-2xl"
        >
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <UserPlus class="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 class="text-lg font-black dark:text-neutral-100">{selectedCustomer ? 'Edit Customer' : 'New Customer'}</h3>
                <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">CRM Record</p>
              </div>
            </div>
            <button onclick={() => { showAddModal = false; selectedCustomer = null; }} class="p-2 hover:bg-neutral-100 rounded-full" aria-label="Close modal">
              <X class="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label for="customer-full-name" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Full Name *</label>
              <input type="text" bind:value={form.name}
                id="customer-full-name"
                class="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200 dark:text-neutral-100 dark:placeholder-neutral-500"
                placeholder="e.g. John Mabena" aria-required="true" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="customer-phone" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Phone *</label>
                <input type="tel" bind:value={form.phone}
                  id="customer-phone"
                  class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="082 000 0000" aria-required="true" />
              </div>
              <div>
                <label for="customer-email" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Email</label>
                <input type="email" bind:value={form.email}
                  id="customer-email"
                  class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label for="customer-address" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Address</label>
              <input type="text" bind:value={form.address}
                id="customer-address"
                class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="123 Main Rd, Sandton" />
            </div>
            <div>
              <label for="customer-notes" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Notes</label>
              <textarea bind:value={form.notes}
                id="customer-notes"
                class="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200 h-20 resize-none"
                placeholder="VIP, prefers specific brands..."></textarea>
            </div>

            {#if selectedCustomer}
              <div class="bg-neutral-50 rounded-2xl p-4 grid grid-cols-3 gap-4 border border-neutral-100">
                <div class="text-center">
                  <p class="text-lg font-black text-neutral-900">{selectedCustomer.points}</p>
                  <p class="text-[8px] font-black text-neutral-400 uppercase">Points</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-black text-neutral-900">{selectedCustomer.visitCount}</p>
                  <p class="text-[8px] font-black text-neutral-400 uppercase">Visits</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-black text-neutral-900">R {(selectedCustomer.totalSpent || 0).toFixed(0)}</p>
                  <p class="text-[8px] font-black text-neutral-400 uppercase">Lifetime</p>
                </div>
              </div>
            {/if}

            <button
              onclick={handleSave} disabled={saving}
              class="w-full py-4 bg-neutral-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {#if saving}
                <Loader2 class="w-4 h-4 animate-spin" />
              {/if}
              {saving ? 'Saving...' : selectedCustomer ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/key}
</div>
