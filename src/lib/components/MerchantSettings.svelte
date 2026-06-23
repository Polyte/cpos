<script lang="ts">
  import {
    Settings, Store, CreditCard, ShieldCheck, Printer, Clock, Globe, Percent, Save, RefreshCw,
    Bell, Heart, Palette, ShieldAlert, Zap, Fingerprint, ChevronRight, Monitor, Smartphone, Server,
    Database, Lock, History, Info, Layers, BarChart4, Sliders, Download, Crown, Star, ArrowRight,
    Check, X, FileText, AlertTriangle, ArrowDown, Gift, MessageSquare, ThumbsDown, Ban, Undo2,
    Loader2, ChevronDown, TrendingDown, ShieldOff
  } from 'lucide-svelte';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';
  import { fly, scale, fade } from 'svelte/transition';
  import TerminalManager from './TerminalManager.svelte';

  let { merchantId, role, initialTab }: { merchantId?: string; role: string; initialTab?: 'config' | 'terminals' | 'forensics' | 'receipt' | 'billing' } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let activeSubTab = $state<'config' | 'terminals' | 'forensics' | 'receipt' | 'billing'>(initialTab || 'config');
  let config = $state<any>({
    taxRate: 15,
    currency: 'ZAR',
    loyaltyEnabled: true,
    loyaltyMultiplier: 1.0,
    pointValue: 0.10,
    primaryColor: '#4f46e5',
    terminalTimeout: 60,
    autoPrintReceipts: true,
    storeAddress: 'Unit 1, Mall of Africa, Sandton',
    supportContact: '+27 11 000 0000',
    forensicLevel: 'Maximum',
    biometricMandatory: true,
    failoverEnabled: true,
  });

  let receiptConfig = $state<any>({
    storeName: 'ROXTON RETAIL',
    headerLine1: 'Mall of Africa, Sandton',
    headerLine2: 'VAT No: 4920123456',
    footerLine1: 'Thank you for shopping!',
    footerLine2: 'Loyalty points earned this visit',
    showLogo: true,
    showBarcode: true,
    showLoyalty: true,
    paperWidth: '80mm',
  });
  let receiptSaving = $state(false);

  let auditLogs: any[] = $state([]);

  let trialInfo: any = $state(null);
  let billingPlans: any[] = $state([]);
  let subscription: any = $state(null);
  let invoices: any[] = $state([]);
  let billingLoading = $state(false);
  let upgrading = $state(false);
  let showCancelModal = $state(false);
  let cancelStep = $state(1);
  let cancelReason = $state('');
  let cancelFeedback = $state('');
  let cancelling = $state(false);
  let retentionAccepted = $state(false);

  const CANCELLATION_REASONS = [
    { id: 'too_expensive', label: 'Pricing is too high', icon: TrendingDown },
    { id: 'missing_features', label: 'Missing critical features', icon: Sliders },
    { id: 'technical_issues', label: 'Technical reliability issues', icon: ShieldOff },
    { id: 'switching', label: 'Switching to another provider', icon: RefreshCw },
    { id: 'business_closing', label: 'Business is closing', icon: Ban },
    { id: 'other', label: 'Other', icon: MessageSquare }
  ];

  let RETENTION_OFFER = $derived({
    title: "Wait! Don't go just yet.",
    description: "We'd love to keep you as a Roxton partner. How about 50% off your subscription for the next 3 months while we help you optimize your setup?",
    discount: '50% for 3 months',
    savings: 'R' + Math.round((subscription?.price || 0) * 1.5)
  });

  $effect(() => {
    loadConfig();
  });

  $effect(() => {
    if (initialTab) activeSubTab = initialTab;
  });

  $effect(() => {
    if (activeSubTab === 'billing') {
      loadBillingData();
    }
  });

  async function loadConfig() {
    try {
      loading = true;
      const mId = merchantId || 'merchant:M1';
      const data = await api.getMerchantConfig(mId, 'config');
      if (data) config = data;
      try {
        const rcptData = await api.getMerchantConfig(mId, 'receipt');
        if (rcptData) receiptConfig = rcptData;
      } catch {}
      const logs = await api.getAuditLogs(mId);
      if (logs) auditLogs = logs;
    } catch (e) {
      console.error('Config load failed, using local defaults:', e);
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    if (role !== 'Admin' && role !== 'Manager') {
      toast.error('Access Denied: Insufficient permissions');
      return;
    }
    try {
      saving = true;
      await api.updateMerchantConfig(merchantId || 'merchant:M1', 'config', config);
      toast.success('System Configuration Committed', { description: 'Parameters synced across all terminal nodes.' });
      loadConfig();
    } catch (e) {
      console.error('Failed to save settings:', e);
      toast.error('Failed to commit configuration change');
    } finally {
      saving = false;
    }
  }

  async function handleReceiptSave() {
    if (role !== 'Admin' && role !== 'Manager') {
      toast.error('Access Denied: Insufficient permissions');
      return;
    }
    try {
      receiptSaving = true;
      await api.updateMerchantConfig(merchantId || 'merchant:M1', 'receipt', receiptConfig);
      toast.success('Receipt Template Committed', { description: 'Template synced across all terminal nodes.' });
      loadConfig();
    } catch (e) {
      console.error('Failed to save receipt template:', e);
      toast.error('Failed to commit receipt template change');
    } finally {
      receiptSaving = false;
    }
  }

  async function loadBillingData() {
    billingLoading = true;
    try {
      const mId = merchantId || 'merchant:M1';
      const [trial, plans, sub, invs] = await Promise.all([
        api.getTrialStatus(mId),
        api.getBillingPlans(),
        api.getBillingSubscriptions(mId),
        api.getBillingInvoices(mId)
      ]);
      if (trial && !trial.error) trialInfo = trial;
      if (Array.isArray(plans)) billingPlans = plans;
      if (sub) subscription = sub;
      if (Array.isArray(invs)) invoices = invs;
    } catch (e) {
      console.error('[MerchantSettings] Failed to load billing data:', e);
    } finally {
      billingLoading = false;
    }
  }

  async function handleUpgrade(planId: string) {
    const mId = merchantId || 'merchant:M1';
    upgrading = true;
    try {
      const res = await api.createSubscription(mId, planId);
      if (res?.success) {
        toast.success('Plan upgraded successfully!', { description: `You are now on the ${res.subscription?.planName || planId} plan.` });
        await loadBillingData();
      } else {
        toast.error('Upgrade failed', { description: res?.error || 'Unknown error' });
      }
    } catch (e) {
      console.error('[MerchantSettings] Upgrade error:', e);
      toast.error('Failed to upgrade plan');
    } finally {
      upgrading = false;
    }
  }

  async function handleCancellationAction(acceptRetention: boolean = false) {
    cancelling = true;
    try {
      const mId = merchantId || 'merchant:M1';
      const res = await api.cancelSubscriptionWithReason(mId, {
        reason: cancelReason,
        feedback: cancelFeedback,
        acceptRetention
      });
      if (res?.success) {
        if (acceptRetention) {
          toast.success('Retention Offer Applied!', {
            description: `You've accepted the ${RETENTION_OFFER.discount} discount. Your next invoice will reflect this change.`,
          });
        } else {
          toast.info('Subscription Scheduled for Cancellation', {
            description: `Your access will continue until the end of the current billing cycle: ${new Date(subscription?.nextBillingAt).toLocaleDateString()}.`
          });
        }
        showCancelModal = false;
        await loadBillingData();
      } else {
        toast.error('Operation failed', { description: res?.error || 'Unknown error' });
      }
    } catch (e) {
      toast.error('Failed to process cancellation request');
    } finally {
      cancelling = false;
    }
  }
</script>

{#if loading}
  <div class="flex h-[600px] items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <RefreshCw class="w-10 h-10 text-indigo-500 animate-spin" />
      <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Syncing System Parameters...</p>
    </div>
  </div>
{:else}
  <div class="p-10 space-y-10 max-w-[1400px] mx-auto animate-in fade-in duration-700">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white dark:bg-neutral-800/50 p-8 rounded-[40px] border border-neutral-200 dark:border-neutral-700 shadow-sm">
      <div class="flex items-center gap-6">
        <div class="w-16 h-16 bg-neutral-900 rounded-[28px] flex items-center justify-center text-white shadow-2xl">
          <Settings class="w-8 h-8" />
        </div>
        <div>
          <h2 class="text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">System Parameterization</h2>
          <p class="text-neutral-500 font-medium flex items-center gap-2">
            <Layers class="w-3.5 h-3.5" />
            Terminal Behavior â€¢ Financial Rules â€¢ Governance â€¢ Identity Policy
          </p>
        </div>
      </div>
      <div class="flex flex-col md:flex-row items-center gap-4">
        <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-inner">
          {#each [
            { id: 'config', label: 'Configurations', icon: Sliders },
            { id: 'terminals', label: 'Terminal Registry', icon: Monitor },
            { id: 'forensics', label: 'Forensic Audit', icon: ShieldAlert },
            { id: 'receipt', label: 'Receipt Template', icon: Printer },
            { id: 'billing', label: 'Plan & Billing', icon: CreditCard }
          ] as tab}
            {@const TabIcon = tab.icon}
            <button
              onclick={() => activeSubTab = tab.id as any}
              class={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === tab.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <TabIcon class="w-4 h-4" />
              {tab.label}
            </button>
          {/each}
        </div>
        {#if activeSubTab === 'config'}
          <button onclick={handleSave} disabled={saving} class="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50">
            {#if saving}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Save class="w-4 h-4" />{/if}
            {saving ? 'Syncing...' : 'Commit Changes'}
          </button>
        {/if}
        {#if activeSubTab === 'receipt'}
          <button onclick={handleReceiptSave} disabled={receiptSaving} class="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50">
            {#if receiptSaving}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Save class="w-4 h-4" />{/if}
            {receiptSaving ? 'Syncing...' : 'Commit Changes'}
          </button>
        {/if}
      </div>
    </div>

    {#key activeSubTab}
      {#if activeSubTab === 'config'}
        <div in:fly={{ y: 20, opacity: 0, duration: 500 }} class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="space-y-8">
            <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10 group hover:border-indigo-200 transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Globe class="w-6 h-6" />
                </div>
                <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Regional & Fiscal</h3>
              </div>
              <div class="space-y-8">
                <div class="space-y-2">
                  <label for="ms-currency" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Base Operating Currency</label>
                  <select
                    id="ms-currency"
                    bind:value={config.currency}
                    class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100"
                  >
                    <option value="ZAR">South African Rand (ZAR)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label for="ms-vat-rate" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Standard VAT Rate (%)</label>
                  <div class="relative">
                    <Percent class="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                    <input type="number" id="ms-vat-rate" bind:value={config.taxRate} class="w-full pl-14 pr-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10 group hover:border-rose-200 transition-all">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all">
                    <Heart class="w-6 h-6" />
                  </div>
                  <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Loyalty Engine</h3>
                </div>
                <button onclick={() => config.loyaltyEnabled = !config.loyaltyEnabled} aria-label="Toggle loyalty engine" class={`w-14 h-8 rounded-full relative transition-all ${config.loyaltyEnabled ? 'bg-rose-500' : 'bg-neutral-200'}`}>
                  <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.loyaltyEnabled ? 'left-7' : 'left-1'} shadow-sm`}></div>
                </button>
              </div>
              <div class={`space-y-8 transition-all ${config.loyaltyEnabled ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                <div class="space-y-2">
                  <label for="ms-point-multiplier" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Point Velocity Multiplier</label>
                  <input type="number" step="0.1" id="ms-point-multiplier" bind:value={config.loyaltyMultiplier} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none dark:text-neutral-100" />
                </div>
                <div class="space-y-2">
                  <label for="ms-redemption-value" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Redemption Value (per 1 Pt)</label>
                  <div class="relative">
                    <span class="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">R</span>
                    <input type="number" step="0.01" id="ms-redemption-value" bind:value={config.pointValue} class="w-full pl-10 pr-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none dark:text-neutral-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-8">
            <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10 group hover:border-emerald-200 transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Printer class="w-6 h-6" />
                </div>
                <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Output & Interface</h3>
              </div>
              <div class="space-y-8">
                <div class="flex items-center justify-between p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700">
                  <div>
                    <p class="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-neutral-100">Auto-Print Ledger</p>
                    <p class="text-[10px] text-neutral-500 font-medium">Automatic receipt generation</p>
                  </div>
                  <button onclick={() => config.autoPrintReceipts = !config.autoPrintReceipts} aria-label="Toggle auto-print ledger" class={`w-14 h-8 rounded-full relative transition-all ${config.autoPrintReceipts ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
                    <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.autoPrintReceipts ? 'left-7' : 'left-1'} shadow-sm`}></div>
                  </button>
                </div>
                <div class="space-y-2">
                  <label for="ms-inactivity" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Inactivity Lockdown (Seconds)</label>
                  <div class="relative">
                    <Clock class="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                    <input type="number" id="ms-inactivity" bind:value={config.terminalTimeout} class="w-full pl-14 pr-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-50 transition-all dark:text-neutral-100" />
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-10 group hover:border-amber-200 transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <Palette class="w-6 h-6" />
                </div>
                <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Identity & Branding</h3>
              </div>
              <div class="space-y-8">
                <div class="space-y-2">
                  <label for="ms-accent-color" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Terminal Accent Color</label>
                  <div class="flex gap-4">
                    <input type="color" id="ms-accent-color" bind:value={config.primaryColor} class="w-20 h-16 p-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl cursor-pointer" />
                    <input type="text" bind:value={config.primaryColor} class="flex-1 px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-mono font-bold outline-none dark:text-neutral-100" />
                  </div>
                </div>
                <div class="space-y-2">
                  <label for="ms-store-address" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Registered Store Address</label>
                  <textarea id="ms-store-address" bind:value={config.storeAddress} rows={3} class="w-full px-6 py-5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-amber-50 transition-all resize-none dark:text-neutral-100"></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-8">
            <div class="bg-neutral-900 p-10 rounded-[48px] text-white shadow-2xl space-y-10 border border-white/5 relative overflow-hidden">
              <div class="relative z-10 flex items-center gap-4">
                <div class="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <ShieldCheck class="w-6 h-6" />
                </div>
                <h3 class="text-xl font-black tracking-tight">Security & Governance</h3>
              </div>
              <div class="relative z-10 space-y-8">
                <div class="space-y-2">
                  <label for="ms-forensic-level" class="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-1">Forensic Logging Level</label>
                  <select id="ms-forensic-level" bind:value={config.forensicLevel} class="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="Standard">Standard (Transactions)</option>
                    <option value="Extended">Extended (User Behavior)</option>
                    <option value="Maximum">Maximum (Full Forensic Chain)</option>
                  </select>
                </div>
                <div class="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                  <div>
                    <p class="text-xs font-black uppercase tracking-widest text-white">Biometric Mandatory</p>
                    <p class="text-[10px] text-neutral-500 font-medium">Force fingerprint for overrides</p>
                  </div>
                  <button onclick={() => config.biometricMandatory = !config.biometricMandatory} aria-label="Toggle biometric mandatory" class={`w-14 h-8 rounded-full relative transition-all ${config.biometricMandatory ? 'bg-indigo-500' : 'bg-white/10'}`}>
                    <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.biometricMandatory ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div class="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                  <div>
                    <p class="text-xs font-black uppercase tracking-widest text-white">4G/LTE Failover</p>
                    <p class="text-[10px] text-neutral-500 font-medium">Automatic Teltonika switching</p>
                  </div>
                  <button onclick={() => config.failoverEnabled = !config.failoverEnabled} aria-label="Toggle failover" class={`w-14 h-8 rounded-full relative transition-all ${config.failoverEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.failoverEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
              <div class="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
            </div>
            <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h3 class="text-lg font-black mb-6 flex items-center gap-2 dark:text-neutral-100"><History class="w-5 h-5 text-neutral-400" /> Recent Configuration Changes</h3>
              <div class="space-y-4">
                {#each auditLogs.filter(l => l.action.includes('UPDATE') || l.action.includes('CONFIG')).slice(0, 3) as log}
                  <div class="flex gap-4 p-4 hover:bg-neutral-50 rounded-2xl transition-all">
                    <div class="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                      <Zap class="w-5 h-5 text-neutral-400" />
                    </div>
                    <div>
                      <p class="text-[10px] font-black uppercase text-neutral-900 leading-none mb-1">{log.action.replace('_',' ')}</p>
                      <p class="text-[9px] font-bold text-neutral-400">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                {/each}
                {#if auditLogs.length === 0}
                  <p class="text-[10px] font-black uppercase text-neutral-300 text-center py-4 tracking-widest">No recent changes</p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {:else if activeSubTab === 'terminals'}
        <div in:scale={{ start: 0.98, opacity: 0, duration: 300 }}>
          <TerminalManager merchantId={merchantId || 'merchant:M1'} {role} onUpgrade={() => activeSubTab = 'billing'} />
        </div>
      {:else if activeSubTab === 'forensics'}
        <div in:fly={{ x: 20, opacity: 0, duration: 500 }} class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-10 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
            <div>
              <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100">Forensic Identity Chain</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Immutable System Governance Ledger</p>
            </div>
            <div class="flex gap-4">
              <button class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                <Download class="w-4 h-4" /> Export Signed Dossier
              </button>
            </div>
          </div>
          <div class="p-10">
            <div class="bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700 overflow-hidden">
              <table class="w-full text-left">
                <thead class="bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                  <tr>
                    <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Event Time</th>
                    <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Action</th>
                    <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Operator</th>
                    <th class="px-10 py-6 text-right font-mono text-[10px] text-emerald-500 font-black tracking-tighter">Verification Hash</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {#each auditLogs as log}
                    <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                      <td class="px-10 py-6">
                        <div class="flex items-center gap-3">
                          <Clock class="w-4 h-4 text-neutral-300" />
                          <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>
                      <td class="px-10 py-6">
                        <span class={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${log.action.includes('SALE') ? 'bg-emerald-50 text-emerald-600' : log.action.includes('USER') ? 'bg-indigo-50 text-indigo-600' : 'bg-neutral-100 text-neutral-500'}`}>{log.action.replace('_',' ')}</span>
                      </td>
                      <td class="px-10 py-6">
                        <span class="text-[10px] font-black text-neutral-500 uppercase">{log.userId}</span>
                      </td>
                      <td class="px-10 py-6 text-right font-mono text-[10px] text-emerald-500 font-black tracking-tighter group-hover:text-emerald-400">{log.hash}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {:else if activeSubTab === 'receipt'}
        <div in:fly={{ x: 20, opacity: 0, duration: 500 }} class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-10 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
            <div>
              <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100">Receipt Template Configuration</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Customize Receipt Layout & Content</p>
            </div>
          </div>
          <div class="p-10">
            <div class="bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700 overflow-hidden">
              <table class="w-full text-left">
                <thead class="bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                  <tr>
                    <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Field</th>
                    <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Value</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Store class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Store Name</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <input type="text" bind:value={receiptConfig.storeName} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Globe class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Header Line 1</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <input type="text" bind:value={receiptConfig.headerLine1} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Globe class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Header Line 2</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <input type="text" bind:value={receiptConfig.headerLine2} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Heart class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Footer Line 1</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <input type="text" bind:value={receiptConfig.footerLine1} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Heart class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Footer Line 2</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <input type="text" bind:value={receiptConfig.footerLine2} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100" />
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Palette class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Paper Width</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <select bind:value={receiptConfig.paperWidth} class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all dark:text-neutral-100">
                        <option value="80mm">80mm</option>
                        <option value="58mm">58mm</option>
                      </select>
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Palette class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Show Logo</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <button onclick={() => receiptConfig.showLogo = !receiptConfig.showLogo} aria-label="Toggle show logo" class={`w-14 h-8 rounded-full relative transition-all ${receiptConfig.showLogo ? 'bg-indigo-500' : 'bg-neutral-200'}`}>
                        <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${receiptConfig.showLogo ? 'left-7' : 'left-1'} shadow-sm`}></div>
                      </button>
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Palette class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Show Barcode</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <button onclick={() => receiptConfig.showBarcode = !receiptConfig.showBarcode} aria-label="Toggle show barcode" class={`w-14 h-8 rounded-full relative transition-all ${receiptConfig.showBarcode ? 'bg-indigo-500' : 'bg-neutral-200'}`}>
                        <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${receiptConfig.showBarcode ? 'left-7' : 'left-1'} shadow-sm`}></div>
                      </button>
                    </td>
                  </tr>
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all group">
                    <td class="px-10 py-6">
                      <div class="flex items-center gap-3">
                        <Palette class="w-4 h-4 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">Show Loyalty Points</span>
                      </div>
                    </td>
                    <td class="px-10 py-6">
                      <button onclick={() => receiptConfig.showLoyalty = !receiptConfig.showLoyalty} aria-label="Toggle show loyalty points" class={`w-14 h-8 rounded-full relative transition-all ${receiptConfig.showLoyalty ? 'bg-indigo-500' : 'bg-neutral-200'}`}>
                        <div class={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${receiptConfig.showLoyalty ? 'left-7' : 'left-1'} shadow-sm`}></div>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {:else if activeSubTab === 'billing'}
        <div in:fly={{ x: 20, opacity: 0, duration: 500 }} class="space-y-8">
          {#if billingLoading}
            <div class="flex h-[400px] items-center justify-center">
              <div class="flex flex-col items-center gap-4">
                <RefreshCw class="w-10 h-10 text-indigo-500 animate-spin" />
                <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Loading Billing Data...</p>
              </div>
            </div>
          {:else}
            {#if trialInfo?.trial?.active}
              <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-[40px] border border-amber-200 dark:border-amber-800/40 p-8 relative overflow-hidden">
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-[60px]"></div>
                <div class="relative z-10">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-200 dark:shadow-amber-900/30">
                        <Clock class="w-7 h-7" />
                      </div>
                      <div>
                        <h3 class="text-xl font-black tracking-tight text-amber-900 dark:text-amber-200">Trial Active</h3>
                        <p class="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">{trialInfo.plan?.toUpperCase()} Plan â€¢ 30-Day Trial</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class={`text-3xl font-black tabular-nums ${trialInfo.trial.daysRemaining <= 7 ? 'text-rose-600' : trialInfo.trial.daysRemaining <= 14 ? 'text-amber-600' : 'text-emerald-600'}`}>{trialInfo.trial.daysRemaining}</p>
                      <p class="text-[9px] font-black uppercase tracking-widest text-neutral-500">Days Left</p>
                    </div>
                  </div>
                  <div class="w-full h-3 bg-white/60 dark:bg-neutral-800/60 rounded-full overflow-hidden">
                    <div class={`h-full rounded-full transition-all duration-700 ${trialInfo.trial.daysRemaining <= 3 ? 'bg-rose-500' : trialInfo.trial.daysRemaining <= 7 ? 'bg-amber-500' : 'bg-emerald-500'}`} style="width: {Math.max(3, ((30 - trialInfo.trial.daysRemaining) / 30) * 100)}%"></div>
                  </div>
                  <div class="flex justify-between mt-2">
                    <span class="text-[9px] font-bold text-amber-700/60 dark:text-amber-400/60">{trialInfo.trial.startDate ? new Date(trialInfo.trial.startDate).toLocaleDateString() : 'Start'}</span>
                    <span class="text-[9px] font-bold text-amber-700/60 dark:text-amber-400/60">{trialInfo.trial.endDate ? new Date(trialInfo.trial.endDate).toLocaleDateString() : 'End'}</span>
                  </div>
                  {#if trialInfo.trial.daysRemaining <= 7}
                    <div class="mt-4 flex items-center gap-2 px-4 py-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl border border-rose-200 dark:border-rose-800/40">
                      <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
                      <p class="text-[10px] font-bold text-rose-700 dark:text-rose-300">Your trial is expiring soon. Upgrade to a paid plan to avoid service interruption.</p>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            {#if subscription}
              <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8">
                <div class="flex items-center gap-4 mb-6">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                    <CreditCard class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="text-lg font-black tracking-tight dark:text-neutral-100">Active Subscription</h3>
                    <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Current billing details</p>
                  </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Plan</p>
                    <p class="text-lg font-black dark:text-neutral-100">{subscription.planName}</p>
                  </div>
                  <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Price</p>
                    <p class="text-lg font-black dark:text-neutral-100">R{subscription.price}<span class="text-xs text-neutral-400">/mo</span></p>
                  </div>
                  <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Status</p>
                    <span class={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${subscription.status === 'Cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{subscription.status}</span>
                  </div>
                  <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Next Billing</p>
                    <p class="text-sm font-black dark:text-neutral-100">{subscription.nextBillingAt ? new Date(subscription.nextBillingAt).toLocaleDateString() : 'â€”'}</p>
                  </div>
                </div>
                {#if subscription.status !== 'Cancelled'}
                  <div class="mt-8 flex justify-end">
                    <button onclick={() => { cancelStep = 1; showCancelModal = true; }} class="flex items-center gap-2 px-6 py-3 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                      <Ban class="w-4 h-4" /> Cancel Subscription
                    </button>
                  </div>
                {/if}
              </div>
            {/if}

            <div>
              <h3 class="text-lg font-black tracking-tight dark:text-neutral-100 mb-6 flex items-center gap-3">
                <Crown class="w-5 h-5 text-amber-500" /> Available Plans
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                {#each billingPlans as plan}
                  {@const isCurrent = subscription?.planId === plan.id}
                  {@const planIcons: Record<string, any> = { starter: Zap, growth: Star, enterprise: Crown }}
                  {@const PIcon = planIcons[plan.id] || Zap}
                  {@const planBgs: Record<string, string> = { starter: 'from-amber-500 to-orange-500', growth: 'from-indigo-500 to-violet-500', enterprise: 'from-neutral-800 to-neutral-900' }}
                  <div class={`relative rounded-[32px] border-2 overflow-hidden transition-all ${isCurrent ? 'border-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'}`}>
                    {#if plan.popular}
                      <div class="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl z-10">Most Popular</div>
                    {/if}
                    {#if isCurrent}
                      <div class="absolute top-0 left-0 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-br-2xl z-10">Current Plan</div>
                    {/if}
                    <div class={`p-6 bg-gradient-to-br ${planBgs[plan.id] || planBgs.starter} text-white`}>
                      <div class="flex items-center gap-3 mb-4 mt-2">
                        <PIcon class="w-6 h-6" />
                        <span class="text-lg font-black">{plan.name}</span>
                      </div>
                      <div class="flex items-baseline gap-1">
                        <span class="text-4xl font-black">R{plan.price}</span>
                        <span class="text-sm font-bold opacity-70">/{plan.interval}</span>
                      </div>
                      <p class="text-xs font-medium opacity-80 mt-2">{plan.description}</p>
                    </div>
                    <div class="p-6 bg-white dark:bg-neutral-800/50">
                      <p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-4">Includes</p>
                      <div class="space-y-2.5 mb-6">
                        {#each plan.features || [] as f}
                          <div class="flex items-center gap-2.5">
                            <div class="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                              <Check class="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span class="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">{f}</span>
                          </div>
                        {/each}
                      </div>
                      {#if isCurrent}
                        <div class="w-full py-3.5 text-center rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Active Plan</div>
                      {:else}
                        <button onclick={() => handleUpgrade(plan.id)} disabled={upgrading} class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          {#if upgrading}
                            <RefreshCw class="w-4 h-4 animate-spin" />
                          {:else}
                            <ArrowRight class="w-4 h-4" />
                            {subscription ? 'Switch Plan' : 'Subscribe'}
                          {/if}
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
                {#if billingPlans.length === 0 && !billingLoading}
                  <div class="flex flex-col items-center justify-center py-16 opacity-40">
                    <CreditCard class="w-12 h-12 text-neutral-400 mb-4" />
                    <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">No plans available</p>
                    <p class="text-xs text-neutral-400 mt-1">Contact support to configure billing plans.</p>
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                    <FileText class="w-5 h-5 text-neutral-500" />
                  </div>
                  <div>
                    <h3 class="text-lg font-black tracking-tight dark:text-neutral-100">Invoice History</h3>
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">All billing transactions</p>
                  </div>
                </div>
              </div>
              {#if invoices.length > 0}
                <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {#each invoices as inv}
                    <div class="px-8 py-5 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-700/30 transition-all">
                      <div class="flex items-center gap-4">
                        <div class={`w-2 h-2 rounded-full shrink-0 ${inv.status === 'paid' ? 'bg-emerald-500' : inv.status === 'pending' ? 'bg-amber-500' : 'bg-neutral-300'}`}></div>
                        <div>
                          <p class="text-xs font-black text-neutral-900 dark:text-neutral-200">{inv.id}</p>
                          <p class="text-[9px] font-bold text-neutral-400 mt-0.5">{inv.planName} â€¢ {inv.period}</p>
                        </div>
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">R{inv.amount}</p>
                        <span class={`text-[8px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{inv.status}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="flex flex-col items-center justify-center py-16 opacity-40">
                  <FileText class="w-10 h-10 text-neutral-400 mb-3" />
                  <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">No invoices yet</p>
                  <p class="text-xs text-neutral-400 mt-1">Invoices will appear here once you subscribe to a plan.</p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/key}

    {#key showCancelModal}
      {#if showCancelModal}
        <div class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div in:fade={{ duration: 200 }} onclick={() => showCancelModal = false} onkeydown={(e) => e.key === 'Enter' && (showCancelModal = false)} role="button" tabindex="0" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div in:scale={{ start: 0.95, opacity: 0, y: 20 }} out:scale={{ start: 0.95, opacity: 0, y: 20 }} class="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-[40px] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
            {#if cancelStep === 1}
              <div class="p-10 space-y-8">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600"><AlertTriangle class="w-6 h-6" /></div>
                    <h3 class="text-xl font-black tracking-tight dark:text-neutral-100 uppercase">Subscription Cancellation</h3>
                  </div>
                  <button onclick={() => showCancelModal = false} class="text-neutral-400 hover:text-neutral-600"><X /></button>
                </div>
                <p class="text-sm font-medium text-neutral-500">We're sorry to see you go. Please let us know why you're cancelling so we can improve Roxton POS for everyone.</p>
                <div class="grid grid-cols-2 gap-3">
                  {#each CANCELLATION_REASONS as reason}
                    {@const ReasonIcon = reason.icon}
                    <button
                      onclick={() => cancelReason = reason.id}
                      class={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${cancelReason === reason.id ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300 dark:text-neutral-300'}`}
                    >
                      <ReasonIcon class="w-4 h-4 shrink-0" />
                      <span class="text-[10px] font-black uppercase tracking-wider">{reason.label}</span>
                    </button>
                  {/each}
                </div>
                <textarea bind:value={cancelFeedback} placeholder="Any additional feedback? (Optional)" rows={3} class="w-full p-5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-rose-50 transition-all dark:text-neutral-100 resize-none"></textarea>
                <div class="flex gap-4">
                  <button onclick={() => showCancelModal = false} class="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600">Keep Subscription</button>
                  <button disabled={!cancelReason} onclick={() => cancelStep = 2} class="flex-1 py-4 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50">Next Step</button>
                </div>
              </div>
            {:else if cancelStep === 2}
              <div class="p-10 space-y-8 bg-gradient-to-br from-indigo-50/30 to-white dark:from-indigo-900/10 dark:to-neutral-900">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><Gift class="w-6 h-6" /></div>
                    <h3 class="text-xl font-black tracking-tight dark:text-neutral-100 uppercase">{RETENTION_OFFER.title}</h3>
                  </div>
                </div>
                <div class="p-8 bg-white dark:bg-neutral-800 rounded-[32px] border border-indigo-100 dark:border-indigo-900 shadow-xl shadow-indigo-100/50 dark:shadow-none space-y-6">
                  <p class="text-sm font-medium text-neutral-600 dark:text-neutral-300 leading-relaxed">{RETENTION_OFFER.description}</p>
                  <div class="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <div>
                      <p class="text-[8px] font-black uppercase tracking-widest text-indigo-400">Your Special Offer</p>
                      <p class="text-lg font-black text-indigo-900 dark:text-indigo-200">{RETENTION_OFFER.discount}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">Est. Savings</p>
                      <p class="text-lg font-black text-emerald-600 dark:text-emerald-400">{RETENTION_OFFER.savings}</p>
                    </div>
                  </div>
                </div>
                <div class="space-y-4">
                  <button disabled={cancelling} onclick={() => handleCancellationAction(true)} class="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-3">
                    {#if cancelling}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Check class="w-4 h-4" />{/if}
                    Claim Offer & Keep Plan
                  </button>
                  <button disabled={cancelling} onclick={() => cancelStep = 3} class="w-full py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600">No thanks, continue with cancellation</button>
                </div>
              </div>
            {:else}
              <div class="p-10 space-y-8">
                <div class="text-center space-y-4">
                  <div class="w-20 h-20 bg-rose-50 rounded-[32px] flex items-center justify-center text-rose-600 mx-auto"><ShieldOff class="w-10 h-10" /></div>
                  <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100 uppercase">Final Confirmation</h3>
                  <p class="text-sm font-medium text-neutral-500 max-w-sm mx-auto">Cancelling your subscription will result in the loss of premium features including <span class="font-bold text-neutral-900 dark:text-neutral-200"> Forensic Ledgers, Priority Support, and Unlimited SKUs.</span></p>
                </div>
                <div class="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700">
                  <div class="flex items-center gap-3 mb-2">
                    <Clock class="w-4 h-4 text-neutral-400" />
                    <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Scheduled End Date</p>
                  </div>
                  <p class="text-lg font-black dark:text-neutral-100">{new Date(subscription?.nextBillingAt).toLocaleDateString()}</p>
                </div>
                <div class="flex gap-4">
                  <button onclick={() => showCancelModal = false} class="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">Go Back</button>
                  <button disabled={cancelling} onclick={() => handleCancellationAction(false)} class="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 shadow-xl shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-3">
                      {#if cancelling}<Loader2 class="w-4 h-4 animate-spin" />{:else}<Ban class="w-4 h-4" />{/if}
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/key}
  </div>
{/if}
