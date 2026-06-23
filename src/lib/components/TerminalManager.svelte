<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { fly, fade } from 'svelte/transition';
  import {
    Monitor, Smartphone, Plus, RefreshCw, Search, X, Wifi, WifiOff, Shield,
    Clock, Server, Hash, Activity, Download, Trash2, ArrowLeftRight, Radar,
    AlertTriangle, CheckCircle, Gauge, Package, MapPinned, Crown,
    AlertCircle, Layers, Zap, Cpu, Printer, Loader2, Info, ArrowRight
  } from 'lucide-svelte';
  import { api } from '../api';

  interface Terminal {
    id: string; name: string; status: 'Online' | 'Offline' | 'Discovered';
    ip: string; version: string; type: 'Stationary' | 'Handheld' | 'Self-Service';
    lastSeen: string; merchantId: string; serialNumber?: string; model?: string;
  }
  interface DiscoveredTerminal {
    id: string; name: string; ip: string; type: string; version: string;
    status: string; serialNumber: string; model: string;
  }
  interface UsageMetric { current: number; limit: number; unlimited: boolean; percentage: number }
  interface UsageData { plan: string; usage: { terminals: UsageMetric; skus: UsageMetric; locations: UsageMetric } }

  let { merchantId, role = 'Cashier', onUpgrade }: {
    merchantId: string; role: string; onUpgrade?: () => void
  } = $props();

  let terminals = $state<Terminal[]>([]);
  let loading = $state(true);
  let search = $state('');
  let showProvisionModal = $state(false);
  let showDiscoverPanel = $state(false);

  let discoverIp = $state('');
  let discovering = $state(false);
  let discoveredTerminal = $state<DiscoveredTerminal | null>(null);
  let alreadyRegistered = $state(false);
  let discoveryError = $state('');
  let editDiscoveredName = $state('');
  let registering = $state(false);

  let decommissionTarget = $state<Terminal | null>(null);
  let decommissioning = $state(false);
  let firmwareTarget = $state<Terminal | null>(null);
  let firmwareUpdating = $state(false);
  let replaceTarget = $state<Terminal | null>(null);
  let replaceIp = $state('');
  let replaceDiscovered = $state<DiscoveredTerminal | null>(null);
  let replaceName = $state('');
  let replaceDiscovering = $state(false);
  let replaceExecuting = $state(false);
  let replaceError = $state('');

  let usageData = $state<UsageData | null>(null);
  let usageLoading = $state(false);
  let printers = $state<any[]>([]);

  let newTerminal = $state({ name: '', type: 'Stationary' as const, ip: '192.168.1.1' });

  let provisioning = $state(false);

  const LATEST_FIRMWARE = '5.2.0';
  let canManage = $derived(role === 'Admin' || role === 'Manager');

  $effect(() => { loadData(); loadUsageMetrics(); loadPrinters(); });

  async function loadData() {
    try {
      loading = true;
      const data = await api.getTerminals(merchantId || 'merchant:M1');
      terminals = data || [];
    } catch (e) { console.error('Failed to sync terminal registry', e); }
    finally { loading = false; }
  }
  async function loadUsageMetrics() {
    usageLoading = true;
    try {
      const data = await api.getUsageMetrics(merchantId || 'merchant:M1');
      if (data?.success !== false) usageData = data;
    } catch (e) { console.error('[TerminalManager] Failed to load usage metrics:', e); }
    finally { usageLoading = false; }
  }
  async function loadPrinters() {
    try {
      const res = await api.getPrinters(merchantId || 'merchant:M1');
      if (res.success) printers = res.printers || [];
    } catch (e) { /* silent */ }
  }

  let filtered = $derived(terminals.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  ));

  let stats = $derived({
    total: terminals.length,
    online: terminals.filter(t => t.status === 'Online').length,
    outdated: terminals.filter(t => t.version !== LATEST_FIRMWARE).length,
  });

  function getUsageColor(pct: number) {
    if (pct >= 100) return { bar: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    if (pct >= 80) return { bar: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  }
  function getUsageColors(metric: UsageMetric) {
    return metric.unlimited ? { bar: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' } : getUsageColor(metric.percentage);
  }
  const planDisplayName: Record<string, string> = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

  async function handleProvision() {
    if (!newTerminal.name) { toast.error('Terminal Name Required'); return; }
    provisioning = true;
    try {
      const mId = merchantId || 'merchant:M1';
      const tId = `TERM-${Math.floor(1000 + Math.random() * 8999)}`;
      await api.pingTerminal(mId, {
        id: tId, name: newTerminal.name, type: newTerminal.type,
        ip: newTerminal.ip, version: '4.2.1', status: 'Online'
      });
      toast.success('Terminal Provisioned', { description: `Device ${tId} authorized for ${mId}.` });
      showProvisionModal = false;
      newTerminal = { name: '', type: 'Stationary', ip: '192.168.1.1' };
      loadData(); loadUsageMetrics();
    } catch (e) { toast.error('Provisioning Failed'); }
    finally { provisioning = false; }
  }

  async function handleDiscover() {
    if (!discoverIp.trim()) { discoveryError = 'Enter an IP address'; return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(discoverIp.trim())) {
      discoveryError = 'Invalid IP format. Use IPv4 (e.g. 192.168.1.100)'; return;
    }
    discovering = true; discoveryError = ''; discoveredTerminal = null; alreadyRegistered = false;
    try {
      const result = await api.discoverTerminal(merchantId || 'merchant:M1', discoverIp.trim());
      if (result.error) { discoveryError = result.error; return; }
      if (result.success && result.terminal) {
        discoveredTerminal = result.terminal;
        alreadyRegistered = result.alreadyRegistered || false;
        editDiscoveredName = result.terminal.name || '';
        toast.success(alreadyRegistered ? 'Terminal Already Registered' : 'Terminal Discovered');
      }
    } catch (e: any) { discoveryError = e?.message || 'Network probe failed'; }
    finally { discovering = false; }
  }

  async function handleRegisterDiscovered() {
    if (!discoveredTerminal || !editDiscoveredName.trim()) { toast.error('Terminal name is required'); return; }
    registering = true;
    try {
      await api.pingTerminal(merchantId || 'merchant:M1', {
        id: discoveredTerminal.id, name: editDiscoveredName.trim(), type: discoveredTerminal.type,
        ip: discoveredTerminal.ip, version: discoveredTerminal.version, status: 'Online',
        serialNumber: discoveredTerminal.serialNumber, model: discoveredTerminal.model,
      });
      toast.success('Terminal Registered');
      discoveredTerminal = null; discoverIp = ''; showDiscoverPanel = false;
      loadData(); loadUsageMetrics();
    } catch (e) { toast.error('Registration Failed'); }
    finally { registering = false; }
  }

  async function handleDecommission() {
    if (!decommissionTarget) return;
    decommissioning = true;
    try {
      const result = await api.decommissionTerminal(merchantId || 'merchant:M1', decommissionTarget.id);
      if (result.success) {
        toast.success('Terminal Decommissioned');
        decommissionTarget = null; loadData(); loadUsageMetrics();
      } else { toast.error('Decommission Failed', { description: result.error }); }
    } catch (e) { toast.error('Decommission Failed'); }
    finally { decommissioning = false; }
  }

  async function handleFirmwareUpdate() {
    if (!firmwareTarget) return;
    firmwareUpdating = true;
    try {
      const result = await api.updateTerminalFirmware(merchantId || 'merchant:M1', firmwareTarget.id, LATEST_FIRMWARE);
      if (result.success) {
        if (result.alreadyLatest) {
          toast.info('Already Up to Date');
        } else {
          toast.success('Firmware Updated', { description: `${firmwareTarget.id}: v${result.previousVersion} → v${result.newVersion}` });
        }
        firmwareTarget = null; loadData();
      } else { toast.error('Firmware Update Failed', { description: result.error }); }
    } catch (e) { toast.error('Firmware Update Failed'); }
    finally { firmwareUpdating = false; }
  }

  async function handleReplaceDiscover() {
    if (!replaceIp.trim()) { replaceError = 'Enter replacement terminal IP'; return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(replaceIp.trim())) { replaceError = 'Invalid IP format'; return; }
    replaceDiscovering = true; replaceError = ''; replaceDiscovered = null;
    try {
      const result = await api.discoverTerminal(merchantId || 'merchant:M1', replaceIp.trim());
      if (result.error) { replaceError = result.error; return; }
      if (result.alreadyRegistered) { replaceError = `IP ${replaceIp} already registered.`; return; }
      if (result.success && result.terminal) {
        replaceDiscovered = result.terminal;
        replaceName = replaceTarget?.name || result.terminal.name || '';
      }
    } catch (e: any) { replaceError = e?.message || 'Discovery failed'; }
    finally { replaceDiscovering = false; }
  }

  async function handleReplaceExecute() {
    if (!replaceTarget || !replaceDiscovered || !replaceName.trim()) { toast.error('Replacement name required'); return; }
    replaceExecuting = true;
    try {
      const result = await api.replaceTerminal(merchantId || 'merchant:M1', replaceTarget.id, {
        id: replaceDiscovered.id, name: replaceName.trim(), type: replaceDiscovered.type,
        ip: replaceDiscovered.ip, version: replaceDiscovered.version,
        serialNumber: replaceDiscovered.serialNumber, model: replaceDiscovered.model,
      });
      if (result.success) {
        toast.success('Terminal Replaced');
        replaceTarget = null; replaceDiscovered = null; replaceIp = ''; replaceError = '';
        loadData(); loadUsageMetrics();
      } else { toast.error('Replacement Failed', { description: result.error }); }
    } catch (e) { toast.error('Replacement Failed'); }
    finally { replaceExecuting = false; }
  }


</script>

<div class="space-y-6">
  <!-- Usage Meters -->
  {#if usageData}
    <div class="bg-neutral-900 rounded-[32px] border border-white/5 p-6 shadow-xl">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center"><Gauge class="w-5 h-5 text-amber-400" /></div>
          <div>
            <h4 class="text-sm font-black text-white tracking-tight">Plan Usage Meters</h4>
            <p class="text-[9px] font-black uppercase tracking-widest text-neutral-500">
              Plan: <span class="text-amber-400">{planDisplayName[usageData.plan] || usageData.plan}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {#if onUpgrade && usageData.plan !== 'enterprise'}
            <button onclick={onUpgrade} class="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-amber-500/30 transition-all flex items-center gap-1.5">
              <Crown class="w-3 h-3" /> Upgrade
            </button>
          {/if}
          <button onclick={loadUsageMetrics} class="p-2 hover:bg-white/5 rounded-xl transition-colors text-neutral-500 hover:text-neutral-300">
            <RefreshCw class="w-3.5 h-3.5 {usageLoading ? 'animate-spin' : ''}" />
          </button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each [['Terminals', Monitor, usageData.usage.terminals], ['SKUs/Products', Package, usageData.usage.skus], ['Locations', MapPinned, usageData.usage.locations]] as [label, Icon, metric]}
          {@const c = getUsageColors(metric)}
          <div class="rounded-2xl border {c.border} {c.bg} p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Icon class="w-4 h-4 {c.text}" />
                <span class="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</span>
              </div>
              <span class="text-xs font-black {c.text}">
                {metric.current} / {#if metric.unlimited}<span class="text-[10px]">Unlimited</span>{:else}{metric.limit}{/if}
              </span>
            </div>
            <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500 {c.bar}" style="width: {metric.unlimited ? '15%' : `${Math.min(metric.percentage, 100)}%`}"></div>
            </div>
            {#if !metric.unlimited && metric.percentage >= 80}
              <p class="mt-2 text-[9px] font-bold {c.text}">
                {#if metric.percentage >= 100}
                  <span>Limit reached — {#if onUpgrade}<button onclick={onUpgrade} class="underline hover:opacity-80">upgrade</button>{:else}upgrade{/if} to add more</span>
                {:else}
                  {100 - metric.percentage}% remaining
                {/if}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Stats -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Total Terminals</p>
        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{stats.total}</p>
      </div>
      <div class="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white"><Monitor class="w-6 h-6" /></div>
    </div>
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Online Now</p>
        <div class="flex items-center gap-2">
          <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{stats.online}</p>
          <span class="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md text-[8px] font-bold uppercase tracking-widest">Stable</span>
        </div>
      </div>
      <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><Wifi class="w-6 h-6" /></div>
    </div>
    <div class="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Firmware</p>
        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{stats.outdated === 0 ? 'All Current' : `${stats.outdated} Pending`}</p>
      </div>
      <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600"><Activity class="w-6 h-6" /></div>
    </div>
  </div>

  <!-- Controls -->
  <div class="flex flex-col md:flex-row items-center justify-between gap-4">
    <div class="relative w-full md:w-96">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
      <input type="text" placeholder="Search terminal ID or name..." bind:value={search}
        class="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100 dark:placeholder-neutral-500" />
    </div>
    <div class="flex gap-2 w-full md:w-auto flex-wrap">
      <button onclick={loadData} class="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all">
        <RefreshCw class="w-4 h-4" />
      </button>
      {#if canManage}
        <button onclick={() => { showDiscoverPanel = !showDiscoverPanel; discoveredTerminal = null; discoveryError = ''; }}
          class="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all {showDiscoverPanel ? 'bg-amber-500 text-black' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'}">
          <Radar class="w-4 h-4" /> IP Discovery
        </button>
      {/if}
      <button onclick={() => showProvisionModal = true}
        class="flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all">
        <Plus class="w-4 h-4" /> Provision
      </button>
    </div>
  </div>

  <!-- Discovery Panel -->
  {#if showDiscoverPanel && canManage}
    <div class="bg-neutral-900 rounded-[32px] border border-amber-500/20 shadow-2xl shadow-amber-500/5 overflow-hidden">
      <div class="p-8 pb-0">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center"><Radar class="w-6 h-6 text-amber-400" /></div>
            <div>
              <h3 class="text-xl font-black tracking-tight text-white">Terminal IP Discovery</h3>
              <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Probe network address to auto-detect terminal ID & hardware info</p>
            </div>
          </div>
          <button onclick={() => { showDiscoverPanel = false; discoveredTerminal = null; discoveryError = ''; }}
            class="p-2 hover:bg-white/10 rounded-xl transition-colors"><X class="w-5 h-5 text-neutral-500" /></button>
        </div>
        <div class="flex gap-3 mb-6">
          <div class="relative flex-1">
            <Wifi class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input type="text" placeholder="Enter terminal IP (e.g. 192.168.1.100)" bind:value={discoverIp}
              onkeydown={(e) => e.key === 'Enter' && handleDiscover()}
              class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-mono font-bold text-white placeholder-neutral-600 outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
          <button onclick={handleDiscover} disabled={discovering || !discoverIp.trim()}
            class="px-8 py-4 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-3 min-w-[160px] justify-center">
            {#if discovering}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Radar class="w-4 h-4" />{/if}
            {discovering ? 'Probing...' : 'Discover'}
          </button>
        </div>
        {#if discoveryError}
          <div class="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
            <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
            <p class="text-[11px] font-bold text-rose-400">{discoveryError}</p>
          </div>
        {/if}
      </div>
      {#if discoveredTerminal}
        <div in:fly={{ y: 20 }} class="p-8 pt-2">
          <div class="rounded-[24px] border overflow-hidden {alreadyRegistered ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}">
            <div class="p-6 pb-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center {alreadyRegistered ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}">
                  {#if alreadyRegistered}<Info class="w-5 h-5" />{:else}<CheckCircle class="w-5 h-5" />{/if}
                </div>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-neutral-500">{alreadyRegistered ? 'Already Registered' : 'New Terminal Discovered'}</p>
                  <p class="text-lg font-black text-white tracking-tight">{discoveredTerminal.id}</p>
                </div>
              </div>
              <span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest {alreadyRegistered ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}">
                {discoveredTerminal.status}
              </span>
            </div>
            <div class="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {#each [{ label: 'Model', value: discoveredTerminal.model || 'Unknown', icon: Server }, { label: 'Type', value: discoveredTerminal.type, icon: discoveredTerminal.type === 'Handheld' ? Smartphone : Monitor }, { label: 'Serial', value: discoveredTerminal.serialNumber || 'N/A', icon: Hash }, { label: 'Firmware', value: `v${discoveredTerminal.version}`, icon: Shield }] as field}
                {@const FieldIcon = field.icon}
                <div class="space-y-1">
                  <p class="text-[9px] font-black uppercase tracking-widest text-neutral-600">{field.label}</p>
                  <div class="flex items-center gap-1.5">
                    <FieldIcon class="w-3 h-3 text-amber-400" />
                    <p class="text-[11px] font-bold text-neutral-300">{field.value}</p>
                  </div>
                </div>
              {/each}
            </div>
            {#if !alreadyRegistered}
              <div class="p-6 pt-4 border-t border-white/5">
                <div class="flex flex-col md:flex-row gap-4 items-end">
                  <div class="flex-1 space-y-2">
                    <label for="tm-display-name" class="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-1">Display Name</label>
                    <input type="text" id="tm-display-name" bind:value={editDiscoveredName} placeholder="e.g. Front Counter POS 1"
                      class="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                  <button onclick={handleRegisterDiscovered} disabled={registering}
                    class="px-8 py-3.5 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-3 min-w-[200px] justify-center whitespace-nowrap">
                    {#if registering}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Zap class="w-4 h-4" />{/if}
                    {registering ? 'Registering...' : 'Register & Authorize'}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      {#if discovering}
        <div class="px-8 pb-8">
          <div class="rounded-[24px] bg-white/5 border border-white/10 p-8 flex flex-col items-center gap-4">
            <div class="relative">
              <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center"><Radar class="w-8 h-8 text-amber-400 animate-spin" style="animation-duration:2s" /></div>
              <div class="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping"></div>
            </div>
            <p class="text-[10px] font-black uppercase tracking-widest text-neutral-500">Probing <span class="text-amber-400 font-mono">{discoverIp}</span> ...</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Provision Modal -->
  {#if showProvisionModal}
    <div class="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div in:fly={{ y: 20, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-xl w-full shadow-2xl relative">
        <button onclick={() => showProvisionModal = false} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors"><X class="w-6 h-6 text-neutral-400" /></button>
        <div class="flex items-center gap-4 mb-8">
          <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Monitor class="w-6 h-6" /></div>
          <div>
            <h3 class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Provision Device</h3>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Register New Hardware Node</p>
          </div>
        </div>
        <div class="space-y-6">
          <div class="space-y-2">
            <label for="tm-terminal-name" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Terminal Name</label>
            <input type="text" id="tm-terminal-name" placeholder="e.g. Front Counter POS 1" bind:value={newTerminal.name}
              class="w-full px-6 py-4 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-500/20 transition-all dark:text-white" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label for="tm-device-category" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Device Category</label>
              <select id="tm-device-category" bind:value={newTerminal.type}
                class="w-full px-6 py-4 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/10 rounded-2xl text-sm font-bold outline-none dark:text-white">
                <option value="Stationary">Stationary Unit</option>
                <option value="Handheld">Handheld Device</option>
                <option value="Self-Service">Kiosk / Self-Service</option>
              </select>
            </div>
            <div class="space-y-2">
              <label for="tm-ip-address" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">IP Address</label>
              <input type="text" id="tm-ip-address" placeholder="192.168.1.10" bind:value={newTerminal.ip}
                class="w-full px-6 py-4 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/10 rounded-2xl text-sm font-bold outline-none dark:text-white" />
            </div>
          </div>
          <div class="p-6 bg-amber-50 dark:bg-amber-500/10 rounded-3xl border border-amber-100 dark:border-amber-500/20 flex items-start gap-4">
            <AlertCircle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400 mb-1">Authorization Notice</p>
              <p class="text-[10px] font-bold text-amber-600 dark:text-amber-500/80 leading-relaxed">Provisioning creates a secure cryptographic link. The terminal must be running CLINT OS to complete the handshake.</p>
            </div>
          </div>
          <button onclick={handleProvision} disabled={provisioning}
            class="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
            {#if provisioning}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<CheckCircle class="w-4 h-4" />{/if}
            {provisioning ? 'Authorizing...' : 'Commit Provisioning'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Decommission Modal -->
  {#if decommissionTarget}
    <div class="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div in:fly={{ y: 20, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative">
        <button onclick={() => decommissionTarget = null} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors"><X class="w-6 h-6 text-neutral-400" /></button>
        <div class="flex items-center gap-4 mb-6">
          <div class="w-14 h-14 bg-rose-50 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400"><AlertTriangle class="w-7 h-7" /></div>
          <div>
            <h3 class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Decommission Terminal</h3>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Irreversible Unlink Operation</p>
          </div>
        </div>
        <div class="bg-neutral-50 dark:bg-white/5 rounded-2xl p-5 mb-6 border border-neutral-100 dark:border-white/10">
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">ID</p><p class="text-sm font-black text-neutral-900 dark:text-white font-mono">{decommissionTarget.id}</p></div>
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Name</p><p class="text-sm font-black text-neutral-900 dark:text-white">{decommissionTarget.name}</p></div>
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">IP</p><p class="text-sm font-bold text-neutral-600 dark:text-neutral-300 font-mono">{decommissionTarget.ip}</p></div>
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Status</p><span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest {decommissionTarget.status === 'Online' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}">{decommissionTarget.status}</span></div>
          </div>
        </div>
        <div class="p-5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-100 dark:border-rose-500/20 mb-6 flex items-start gap-3">
          <AlertTriangle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p class="text-[11px] font-black uppercase text-rose-700 dark:text-rose-400 mb-1">Warning</p>
            <p class="text-[10px] font-bold text-rose-600 dark:text-rose-400/80 leading-relaxed">This will permanently remove the terminal. The cryptographic bond will be severed. An audit log entry will be created.</p>
          </div>
        </div>
        <div class="flex gap-3">
          <button onclick={() => decommissionTarget = null} class="flex-1 py-4 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-white/10 transition-all">Cancel</button>
          <button onclick={handleDecommission} disabled={decommissioning}
            class="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
            {#if decommissioning}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Trash2 class="w-4 h-4" />{/if}
            {decommissioning ? 'Decommissioning...' : 'Confirm Decommission'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Firmware Update Modal -->
  {#if firmwareTarget}
    <div class="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div in:fly={{ y: 20, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative">
        <button onclick={() => firmwareTarget = null} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors"><X class="w-6 h-6 text-neutral-400" /></button>
        <div class="flex items-center gap-4 mb-6">
          <div class="w-14 h-14 bg-amber-50 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400"><Download class="w-7 h-7" /></div>
          <div>
            <h3 class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Firmware Update</h3>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">OTA Push to {firmwareTarget.id}</p>
          </div>
        </div>
        <div class="bg-neutral-50 dark:bg-white/5 rounded-2xl p-5 mb-5 border border-neutral-100 dark:border-white/10">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Current</p><p class="text-lg font-black text-neutral-900 dark:text-white font-mono">v{firmwareTarget.version}</p></div>
            <div><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Target</p><p class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">v{LATEST_FIRMWARE}</p></div>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
            <Monitor class="w-3.5 h-3.5" /> {firmwareTarget.name} <span class="text-neutral-300 dark:text-neutral-600">&middot;</span> <span class="font-mono">{firmwareTarget.ip}</span>
            {#if firmwareTarget.model}<span class="text-neutral-300 dark:text-neutral-600">&middot;</span> <span>{firmwareTarget.model}</span>{/if}
          </div>
        </div>
        <div class="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20 mb-6 flex items-start gap-3">
          <AlertCircle class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p class="text-[9px] font-bold text-amber-600 dark:text-amber-500/80 leading-relaxed">The terminal will briefly restart during the update. Active transactions will be queued and replayed after boot.</p>
        </div>
        <div class="flex gap-3">
          <button onclick={() => firmwareTarget = null} class="flex-1 py-4 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-white/10 transition-all">Cancel</button>
          <button onclick={handleFirmwareUpdate} disabled={firmwareUpdating}
            class="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
            {#if firmwareUpdating}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<Download class="w-4 h-4" />{/if}
            {firmwareUpdating ? 'Pushing...' : 'Push Firmware'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Replace Terminal Modal -->
  {#if replaceTarget}
    <div class="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onclick={() => { replaceTarget = null; replaceDiscovered = null; }} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors"><X class="w-6 h-6 text-neutral-400" /></button>
        <div class="flex items-center gap-4 mb-6">
          <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><ArrowLeftRight class="w-7 h-7" /></div>
          <div>
            <h3 class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Replace Terminal</h3>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Decommission & Swap in One Operation</p>
          </div>
        </div>
        <div class="bg-rose-50 dark:bg-rose-500/5 rounded-2xl p-5 mb-5 border border-rose-200 dark:border-rose-500/20">
          <p class="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-3">Terminal Being Replaced</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">ID</p><p class="text-xs font-black text-neutral-900 dark:text-white font-mono">{replaceTarget.id}</p></div>
            <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Name</p><p class="text-xs font-black text-neutral-900 dark:text-white">{replaceTarget.name}</p></div>
            <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">IP</p><p class="text-xs font-bold text-neutral-600 dark:text-neutral-300 font-mono">{replaceTarget.ip}</p></div>
            <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Status</p><span class="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest {replaceTarget.status === 'Online' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">{replaceTarget.status}</span></div>
          </div>
        </div>
        <div class="flex justify-center my-2"><div class="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center"><ArrowRight class="w-5 h-5 text-neutral-400 rotate-90" /></div></div>
        <div class="bg-neutral-50 dark:bg-white/5 rounded-2xl p-5 mb-5 border border-neutral-200 dark:border-white/10">
          <p class="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-3">Replacement Terminal</p>
          <div class="flex gap-3 mb-4">
            <div class="relative flex-1">
              <Wifi class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input type="text" placeholder="Enter replacement IP" bind:value={replaceIp}
                onkeydown={(e) => e.key === 'Enter' && handleReplaceDiscover()}
                class="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all dark:text-white dark:placeholder-neutral-600" />
            </div>
            <button onclick={handleReplaceDiscover} disabled={replaceDiscovering || !replaceIp.trim()}
              class="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2">
              {#if replaceDiscovering}<RefreshCw class="w-3.5 h-3.5 animate-spin" />{:else}<Radar class="w-3.5 h-3.5" />{/if}
              Probe
            </button>
          </div>
          {#if replaceError}
            <div class="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-2 mb-4">
              <AlertCircle class="w-3.5 h-3.5 text-rose-500 shrink-0" /><p class="text-[10px] font-bold text-rose-500">{replaceError}</p>
            </div>
          {/if}
          {#if replaceDiscovered}
            <div in:fly={{ y: 10 }} class="space-y-4">
              <div class="bg-emerald-50 dark:bg-emerald-500/5 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
                <div class="flex items-center gap-2 mb-3"><CheckCircle class="w-4 h-4 text-emerald-500" /><span class="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Replacement Found</span></div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">ID</p><p class="text-xs font-black text-neutral-900 dark:text-white font-mono">{replaceDiscovered.id}</p></div>
                  <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Model</p><p class="text-xs font-bold text-neutral-600 dark:text-neutral-300">{replaceDiscovered.model}</p></div>
                  <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Type</p><p class="text-xs font-bold text-neutral-600 dark:text-neutral-300">{replaceDiscovered.type}</p></div>
                  <div><p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">Firmware</p><p class="text-xs font-bold text-neutral-600 dark:text-neutral-300 font-mono">v{replaceDiscovered.version}</p></div>
                </div>
              </div>
              <div class="space-y-2">
                <label for="tm-replacement-name" class="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-1">Replacement Name</label>
                <input type="text" id="tm-replacement-name" bind:value={replaceName} placeholder="e.g. Front Counter POS 1"
                  class="w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all dark:text-white dark:placeholder-neutral-600" />
              </div>
            </div>
          {/if}
        </div>
        {#if replaceDiscovered}
          <div class="flex gap-3">
            <button onclick={() => { replaceTarget = null; replaceDiscovered = null; }} class="flex-1 py-4 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-white/10 transition-all">Cancel</button>
            <button onclick={handleReplaceExecute} disabled={replaceExecuting || !replaceName.trim()}
              class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
              {#if replaceExecuting}<RefreshCw class="w-4 h-4 animate-spin" />{:else}<ArrowLeftRight class="w-4 h-4" />{/if}
              {replaceExecuting ? 'Swapping...' : 'Confirm Swap'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Terminal Grid -->
  {#if loading}
    <div class="flex h-64 items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <RefreshCw class="w-8 h-8 text-indigo-500 animate-spin" />
        <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Scanning Infrastructure...</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {#each filtered as terminal (terminal.id)}
        <div class="group bg-white dark:bg-neutral-800 rounded-[32px] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div class="p-6 space-y-4">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center {terminal.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-400'}">
                  {#if terminal.type === 'Handheld'}<Smartphone class="w-6 h-6" />{:else}<Monitor class="w-6 h-6" />{/if}
                </div>
                <div>
                  <h4 class="font-black text-neutral-900 dark:text-neutral-100 tracking-tight">{terminal.name}</h4>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{terminal.id}</p>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1">
                <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 {terminal.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                  <div class="w-1.5 h-1.5 rounded-full {terminal.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></div>
                  {terminal.status}
                </span>
                <p class="text-[8px] font-bold text-neutral-400">{terminal.type}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 py-4 border-t border-neutral-50 dark:border-neutral-700">
              <div class="space-y-1">
                <p class="text-[9px] font-black uppercase tracking-widest text-neutral-400">IP Address</p>
                <div class="flex items-center gap-1.5"><Wifi class="w-3 h-3 text-indigo-400" /><p class="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">{terminal.ip}</p></div>
              </div>
              <div class="space-y-1">
                <p class="text-[9px] font-black uppercase tracking-widest text-neutral-400">Firmware</p>
                <div class="flex items-center gap-1.5">
                  <Shield class="w-3 h-3 {terminal.version === LATEST_FIRMWARE ? 'text-emerald-400' : 'text-amber-400'}" />
                  <p class="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">v{terminal.version}</p>
                  {#if terminal.version !== LATEST_FIRMWARE}
                    <span class="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded text-[7px] font-black uppercase tracking-widest">Update</span>
                  {/if}
                </div>
              </div>
            </div>
            {#if terminal.model || terminal.serialNumber}
              <div class="grid grid-cols-2 gap-3 pb-2">
                {#if terminal.model}
                  <div class="space-y-1"><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model</p><div class="flex items-center gap-1.5"><Server class="w-3 h-3 text-amber-400" /><p class="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{terminal.model}</p></div></div>
                {/if}
                {#if terminal.serialNumber}
                  <div class="space-y-1"><p class="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial</p><div class="flex items-center gap-1.5"><Hash class="w-3 h-3 text-amber-400" /><p class="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 font-mono">{terminal.serialNumber}</p></div></div>
                {/if}
              </div>
            {/if}
            <div class="pt-4 border-t border-neutral-50 dark:border-neutral-700 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-neutral-300" />
                  <span class="text-[10px] font-bold text-neutral-500">Seen {new Date(terminal.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {#each printers.filter(p => p.terminalId === terminal.id) as ap (ap.id)}
                  <div class="flex items-center gap-1" title={ap.name}><Printer class="w-3 h-3 text-violet-400" /><span class="text-[9px] font-black text-violet-400">{printers.filter(p => p.terminalId === terminal.id).length}</span></div>
                {/each}
              </div>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {#if canManage && terminal.version !== LATEST_FIRMWARE}
                  <button onclick={() => firmwareTarget = terminal} class="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg text-neutral-400 hover:text-amber-600 transition-all" title="Update firmware"><Download class="w-4 h-4" /></button>
                {/if}
                {#if canManage}
                  <button onclick={() => { replaceTarget = terminal; replaceIp = ''; replaceDiscovered = null; replaceName = ''; replaceError = ''; }} class="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg text-neutral-400 hover:text-indigo-600 transition-all" title="Replace terminal"><ArrowLeftRight class="w-4 h-4" /></button>
                  <button onclick={() => decommissionTarget = terminal} class="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-neutral-400 hover:text-rose-600 transition-all" title="Decommission"><Trash2 class="w-4 h-4" /></button>
                {/if}
              </div>
            </div>
          </div>
          <div class="h-1 w-full {terminal.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}"></div>
        </div>
      {:else}
        <div class="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-[48px] bg-neutral-50/50 dark:bg-neutral-800/30">
          <div class="w-16 h-16 bg-neutral-200 dark:bg-neutral-700 rounded-3xl flex items-center justify-center text-neutral-400 mb-4"><Monitor class="w-8 h-8" /></div>
          <p class="text-sm font-black text-neutral-500 uppercase tracking-widest">No terminals registered</p>
          <p class="text-[11px] text-neutral-400 mt-2 max-w-md text-center">
            {canManage ? 'Use IP Discovery to scan a terminal by its network address, or manually provision a new device.' : 'Contact your administrator to register terminal devices.'}
          </p>
          {#if canManage}
            <button onclick={() => showDiscoverPanel = true} class="mt-4 flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest hover:underline">
              <Radar class="w-3.5 h-3.5" /> Discover via IP
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Command Center -->
  {#if terminals.length > 0}
    <div class="bg-neutral-900 rounded-[32px] border border-white/5 overflow-hidden shadow-xl">
      <div class="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div class="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0"><Cpu class="w-8 h-8 text-indigo-400" /></div>
        <div class="flex-1">
          <h4 class="text-lg font-black text-white tracking-tight">Infrastructure Command Center</h4>
          <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-1">
            CLINT OS v{LATEST_FIRMWARE} &middot;
            {#if stats.outdated === 0}
              <span class="text-emerald-400">All {stats.total} terminals current</span>
            {:else}
              <span class="text-amber-400">{stats.outdated} of {stats.total} terminal(s) need updating</span>
            {/if}
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>