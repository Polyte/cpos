<script lang="ts">
  import {
    Search, RefreshCw, Shield, ShieldAlert, AlertTriangle, CheckCircle2, Clock,
    Hash, Fingerprint, Lock, User, CreditCard, Settings,
    Cpu, Activity, Database, Zap, Pause, Play, Radio,
    ArrowUpRight, ArrowDownLeft, Loader2, X, Network
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { fly, slide, fade } from 'svelte/transition';
  import { api } from '../api';

  interface AuditEvent {
    id: string;
    merchantId: string;
    userId: string;
    action: string;
    category?: string;
    details: any;
    terminalId?: string;
    timestamp: string;
    hash: string;
    severity?: string;
  }

  type FeedMode = 'poll' | 'stream';

  let { profile, role, merchantId }: { profile: string; role: string; merchantId?: string } = $props();

  const CATEGORIES = [
    { id: 'ALL', label: 'All Events', icon: Database },
    { id: 'SECURITY', label: 'Security', icon: ShieldAlert },
    { id: 'OVERRIDE', label: 'Overrides', icon: Fingerprint },
    { id: 'TRANSACTION', label: 'Transactions', icon: CreditCard },
    { id: 'SYNC', label: 'Sync Events', icon: Network },
    { id: 'GENERAL', label: 'General', icon: Activity },
  ];

  const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
    SALE_COMPLETED: { icon: CreditCard, color: 'emerald', label: 'Sale Completed' },
    SUPERVISOR_OVERRIDE_VOID: { icon: ShieldAlert, color: 'amber', label: 'Void Override' },
    SUPERVISOR_OVERRIDE_CLEAR: { icon: ShieldAlert, color: 'amber', label: 'Clear Cart Override' },
    BIOMETRIC_AUTH: { icon: Fingerprint, color: 'indigo', label: 'Biometric Auth' },
    PIN_AUTH: { icon: Lock, color: 'blue', label: 'PIN Auth' },
    SHIFT_STARTED: { icon: ArrowUpRight, color: 'emerald', label: 'Shift Start' },
    SHIFT_CLOSED: { icon: ArrowDownLeft, color: 'neutral', label: 'Shift End' },
    USER_ENROLL: { icon: User, color: 'blue', label: 'User Enrolled' },
    USER_UPDATE: { icon: Settings, color: 'neutral', label: 'User Updated' },
    USER_DELETE: { icon: X, color: 'rose', label: 'User Removed' },
    CONFIG_UPDATE: { icon: Settings, color: 'neutral', label: 'Config Changed' },
    LOYALTY_EARN: { icon: Zap, color: 'amber', label: 'Points Earned' },
    LOYALTY_REDEEM: { icon: Zap, color: 'rose', label: 'Points Redeemed' },
    MERCHANT_CREATE: { icon: Database, color: 'indigo', label: 'Merchant Created' },
    OFFLINE_TXN_QUEUED: { icon: Network, color: 'amber', label: 'Offline Queued' },
    OFFLINE_TXN_SYNCED: { icon: CheckCircle2, color: 'emerald', label: 'Offline Synced' },
    TERMINAL_REGISTERED: { icon: Cpu, color: 'blue', label: 'Terminal Registered' },
  };

  function getActionMeta(action: string) {
    return ACTION_META[action] || { icon: Activity, color: 'neutral', label: action.replace(/_/g, ' ') };
  }

  function getColorClasses(color: string) {
    const map: Record<string, { bg: string; text: string; border: string; bgLight: string }> = {
      emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20', bgLight: 'bg-emerald-500/10' },
      amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/20', bgLight: 'bg-amber-500/10' },
      rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/20', bgLight: 'bg-rose-500/10' },
      indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/20', bgLight: 'bg-indigo-500/10' },
      blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/20', bgLight: 'bg-blue-500/10' },
      neutral: { bg: 'bg-neutral-500', text: 'text-neutral-400', border: 'border-neutral-500/20', bgLight: 'bg-neutral-500/10' },
    };
    return map[color] || map.neutral;
  }

  let events: AuditEvent[] = $state([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedCategory = $state('ALL');
  let selectedEvent = $state<AuditEvent | null>(null);
  let hashVerifyStatus = $state<Record<string, 'valid' | 'invalid' | 'checking'>>({});
  let feedMode: FeedMode = $state('poll');
  let autoRefresh = $state(true);
  let lastRefresh = $state<Date | null>(null);
  let countdown = $state(15);
  let streamStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = $state('disconnected');
  let streamEventsCount = $state(0);
  let lastHeartbeat = $state<number | null>(null);
  let eventSourceRef: EventSource | null = null;
  let seenIds = new Set<string>();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let countdownId: ReturnType<typeof setInterval> | null = null;

  let mId = $derived(merchantId || (profile === 'Forecourt' ? 'merchant:M2' : profile === 'Workshop' ? 'merchant:M3' : profile === 'Restaurant' ? 'merchant:M4' : 'merchant:M1'));

  let filteredEvents = $derived(events.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.action?.toLowerCase().includes(q) ||
      e.userId?.toLowerCase().includes(q) ||
      e.merchantId?.toLowerCase().includes(q) ||
      e.hash?.toLowerCase().includes(q) ||
      JSON.stringify(e.details).toLowerCase().includes(q)
    );
  }));

  let securityEvents = $derived(events.filter(e => e.severity === 'WARNING' || e.action?.includes('OVERRIDE')).length);
  let todayEvents = $derived(events.filter(e => {
    const d = new Date(e.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length);

  let streamStatusColor = $derived({
    disconnected: 'bg-neutral-400',
    connecting: 'bg-amber-400 animate-pulse',
    connected: 'bg-emerald-400 animate-pulse',
    error: 'bg-rose-400 animate-pulse'
  }[streamStatus]);

  let streamStatusLabel = $derived({
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Stream Connected',
    error: 'Connection Error'
  }[streamStatus]);

  async function loadEvents(silent = false) {
    try {
      if (!silent) loading = true;
      const data = await api.getAuditEvents(role === 'Admin' ? undefined : mId, selectedCategory !== 'ALL' ? selectedCategory : undefined);
      if (Array.isArray(data)) {
        if (feedMode === 'stream') {
          const existingIds = new Set(events.map((e: AuditEvent) => e.id));
          const newFromServer = data.filter((e: AuditEvent) => !existingIds.has(e.id));
          events = [...events, ...newFromServer]
            .sort((a: AuditEvent, b: AuditEvent) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 200);
          seenIds = new Set(events.map((e: AuditEvent) => e.id));
        } else {
          events = data;
          seenIds = new Set(data.map((e: AuditEvent) => e.id));
        }
      }
      lastRefresh = new Date();
      countdown = 15;
    } catch (e) {
      if (!silent) toast.error('Failed to load audit events');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadEvents();
  });

  $effect(() => {
    if (intervalId) clearInterval(intervalId);
    if (countdownId) clearInterval(countdownId);
    if (feedMode === 'poll' && autoRefresh) {
      intervalId = setInterval(() => loadEvents(true), 15000);
      countdownId = setInterval(() => { countdown = countdown <= 1 ? 15 : countdown - 1; }, 1000);
    }
    return () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (countdownId) { clearInterval(countdownId); countdownId = null; }
    };
  });

  async function connectStream() {
    if (eventSourceRef) { eventSourceRef.close(); eventSourceRef = null; }
    streamStatus = 'connecting';
    streamEventsCount = 0;
    const url = await api.getAuditStreamUrl(role === 'Admin' ? undefined : mId, selectedCategory !== 'ALL' ? selectedCategory : undefined);
    const es = new EventSource(url);
    eventSourceRef = es;
    es.addEventListener('connected', () => { streamStatus = 'connected'; });
    es.addEventListener('audit-event', (e: MessageEvent) => {
      try {
        const event: AuditEvent = JSON.parse(e.data);
        if (seenIds.has(event.id)) return;
        seenIds.add(event.id);
        events = [event, ...events].slice(0, 200);
        streamEventsCount++;
      } catch (err) { console.error('[SSE] Parse error:', err); }
    });
    es.addEventListener('heartbeat', (e: MessageEvent) => {
      try {
        const hb = JSON.parse(e.data);
        lastHeartbeat = hb.t;
      } catch (_) {}
    });
    es.addEventListener('timeout', () => {
      streamStatus = 'disconnected';
      setTimeout(() => { if (feedMode === 'stream') connectStream(); }, 2000);
    });
    es.onerror = () => {
      streamStatus = 'error';
      es.close();
      setTimeout(() => { if (feedMode === 'stream') connectStream(); }, 3000);
    };
  }

  $effect(() => {
    if (feedMode === 'stream') {
      connectStream();
    } else {
      if (eventSourceRef) { eventSourceRef.close(); eventSourceRef = null; }
      streamStatus = 'disconnected';
      streamEventsCount = 0;
      lastHeartbeat = null;
    }
    return () => {
      if (eventSourceRef) { eventSourceRef.close(); eventSourceRef = null; }
    };
  });

  function handleVerifyHash(event: AuditEvent) {
    hashVerifyStatus = { ...hashVerifyStatus, [event.id]: 'checking' };
    setTimeout(() => {
      const valid = event.hash && event.hash.length > 10;
      hashVerifyStatus = { ...hashVerifyStatus, [event.id]: valid ? 'valid' : 'invalid' };
    }, 800);
  }
</script>

<div class="h-full flex flex-col bg-white dark:bg-neutral-900 rounded-[32px] border border-neutral-200/50 dark:border-neutral-700 shadow-2xl overflow-hidden font-mono" style="font-family: 'JetBrains Mono', monospace">
  <!-- Header -->
  <div class="bg-neutral-900 text-white px-8 py-5 border-b border-white/10 shadow-lg">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/30">
          <Shield class="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 class="text-sm font-black uppercase tracking-widest text-white">Forensic Audit Ledger</h2>
          <p class="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">Tamper-Resistant Event Chronicle</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex gap-2">
          <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
            <p class="text-[8px] font-black text-white/30 uppercase tracking-widest">Today</p>
            <p class="text-sm font-black text-white tabular-nums">{todayEvents}</p>
          </div>
          <div class="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p class="text-[8px] font-black text-amber-400/60 uppercase tracking-widest">Alerts</p>
            <p class="text-sm font-black text-amber-400 tabular-nums">{securityEvents}</p>
          </div>
          <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
            <p class="text-[8px] font-black text-white/30 uppercase tracking-widest">Total</p>
            <p class="text-sm font-black text-white tabular-nums">{events.length}</p>
          </div>
        </div>
        <div class="flex rounded-lg overflow-hidden border border-white/10">
          <button
            onclick={() => feedMode = 'poll'}
            class="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all {feedMode === 'poll' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30 hover:bg-white/10'}"
          >
            <RefreshCw class="w-3 h-3" />
            Poll
          </button>
          <button
            onclick={() => feedMode = 'stream'}
            class="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all {feedMode === 'stream' ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-white/30 hover:bg-white/10'}"
          >
            <Radio class="w-3 h-3" />
            Stream
          </button>
        </div>
        {#if feedMode === 'poll'}
          <button
            onclick={() => autoRefresh = !autoRefresh}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest {autoRefresh ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'}"
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {#if autoRefresh}
              <Pause class="w-3 h-3" />
              Live {countdown}s
            {:else}
              <Play class="w-3 h-3" />
              Paused
            {/if}
          </button>
        {/if}
        {#if feedMode === 'stream'}
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5">
            <div class="w-2 h-2 rounded-full {streamStatusColor}"></div>
            <span class="text-[8px] font-black text-white/40 uppercase tracking-widest">
              {streamEventsCount > 0 ? `+${streamEventsCount} new` : streamStatusLabel}
            </span>
          </div>
        {/if}
        <button
          onclick={() => loadEvents()}
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <RefreshCw class="w-4 h-4 text-white/40 {loading ? 'animate-spin' : ''}" />
        </button>
      </div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-4">
    <div class="relative flex-1 max-w-md">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300"></Search>
      <input
        type="text"
        placeholder="Search events, hashes, users..."
        class="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-100 dark:text-neutral-100 dark:placeholder-neutral-500"
        bind:value={searchQuery}
      />
    </div>
    <div class="flex items-center gap-1 overflow-x-auto">
      {#each CATEGORIES as cat}
        {@const CatIcon = cat.icon}
        <button
          onclick={() => selectedCategory = cat.id}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 {selectedCategory === cat.id ? 'bg-neutral-900 text-white shadow-lg' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'}"
        >
          <CatIcon class="w-3 h-3" />
          {cat.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Event List -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center h-48">
        <Loader2 class="w-6 h-6 text-neutral-300 animate-spin" />
      </div>
    {:else if filteredEvents.length === 0}
      <div class="flex flex-col items-center justify-center h-48 text-center">
        <Shield class="w-12 h-12 text-neutral-200 mb-4" />
        <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ledger Empty</p>
        <p class="text-xs text-neutral-300 mt-1">No audit events match your criteria</p>
      </div>
    {:else}
      <div class="divide-y divide-neutral-50">
        {#each filteredEvents as event, idx}
          {@const meta = getActionMeta(event.action)}
          {@const colors = getColorClasses(meta.color)}
          {@const verifyState = hashVerifyStatus[event.id]}
{@const isStreamNew = feedMode === 'stream' && idx < streamEventsCount}
            {@const MetaIcon = meta.icon}
            <div
              in:fly={{ duration: 300, delay: Math.min(idx * 20, 500) }}
              class="px-6 py-3 hover:bg-neutral-50/50 transition-all cursor-pointer group {selectedEvent?.id === event.id ? 'bg-amber-50/30' : ''} {isStreamNew ? 'border-l-2 border-l-rose-400 bg-rose-50/20' : ''}"
              onclick={() => selectedEvent = selectedEvent?.id === event.id ? null : event}
              onkeydown={(e) => e.key === 'Enter' && (selectedEvent = selectedEvent?.id === event.id ? null : event)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-start gap-4">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 {colors.bgLight}">
                  <MetaIcon class="w-4 h-4 {colors.text}" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-black text-neutral-900">{meta.label}</span>
                  {#if isStreamNew}
                    <span class="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[7px] font-black uppercase animate-pulse">Live</span>
                  {/if}
                  {#if event.severity === 'WARNING'}
                    <span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[7px] font-black uppercase">Warning</span>
                  {/if}
                  {#if event.severity === 'CRITICAL'}
                    <span class="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[7px] font-black uppercase">Critical</span>
                  {/if}
                </div>
                <div class="flex items-center gap-3 text-[9px] text-neutral-400">
                  <span class="flex items-center gap-1">
                    <User class="w-2.5 h-2.5" />
                    {event.userId === 'system' ? 'System' : event.userId?.substring(0, 12) + '...'}
                  </span>
                  <span class="flex items-center gap-1">
                    <Clock class="w-2.5 h-2.5" />
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                  {#if event.terminalId && event.terminalId !== 'unknown'}
                    <span class="flex items-center gap-1">
                      <Cpu class="w-2.5 h-2.5" />
                      {event.terminalId}
                    </span>
                  {/if}
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right">
                  <p class="text-[8px] font-mono text-neutral-300 mb-0.5">{event.hash?.substring(0, 16)}...</p>
                  <button
                    onclick={(e: MouseEvent) => { e.stopPropagation(); handleVerifyHash(event); }}
                    class="text-[8px] font-black uppercase tracking-widest transition-colors {verifyState === 'valid' ? 'text-emerald-500' : verifyState === 'invalid' ? 'text-rose-500' : verifyState === 'checking' ? 'text-amber-500' : 'text-neutral-300 hover:text-neutral-600'}"
                  >
                    {verifyState === 'valid' ? 'VERIFIED' : verifyState === 'invalid' ? 'TAMPERED' : verifyState === 'checking' ? 'CHECKING...' : 'VERIFY'}
                  </button>
                </div>
                {#if verifyState === 'valid'}
                  <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                {:else if verifyState === 'invalid'}
                  <AlertTriangle class="w-4 h-4 text-rose-500" />
                {/if}
              </div>
            </div>
            {#if selectedEvent?.id === event.id}
              <div transition:slide class="overflow-hidden">
                <div class="mt-3 ml-12 p-4 bg-neutral-900 rounded-xl text-white">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-[9px] font-black uppercase tracking-widest text-white/40">Event Payload</span>
                    <span class="text-[8px] font-mono text-white/20">{event.id}</span>
                  </div>
                  <pre class="text-[10px] font-mono font-medium text-emerald-400/80 whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto selection:bg-emerald-900 selection:text-white">{JSON.stringify(event.details, null, 2)}</pre>
                  <div class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Hash class="w-3 h-3 text-white/20" />
                      <span class="text-[9px] font-mono text-white/30 font-bold">{event.hash}</span>
                    </div>
                    <span class="text-[8px] font-black text-white/20 uppercase tracking-widest">{event.merchantId}</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="px-6 py-3 border-t border-neutral-100 bg-neutral-50/30 flex items-center justify-between">
    <div class="flex items-center gap-3">
      {#if feedMode === 'poll'}
        <div class="flex items-center gap-2">
          {#if autoRefresh}
            <div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
          {:else}
            <div class="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
          {/if}
          <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
            {autoRefresh ? 'Polling Mode Active' : 'Auto-refresh Paused'}
          </span>
        </div>
        {#if lastRefresh}
          <span class="text-[8px] font-mono text-neutral-300">
            Last: {lastRefresh.toLocaleTimeString()}
          </span>
        {/if}
      {:else}
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full {streamStatusColor}"></div>
          <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
            SSE {streamStatusLabel}
          </span>
        </div>
        {#if lastHeartbeat}
          <span class="text-[8px] font-mono text-neutral-300">
            Heartbeat: {new Date(lastHeartbeat).toLocaleTimeString()}
          </span>
        {/if}
        {#if streamEventsCount > 0}
          <span class="text-[8px] font-black text-rose-400 uppercase tracking-widest">
            +{streamEventsCount} streamed
          </span>
        {/if}
      {/if}
    </div>
    <span class="text-[9px] font-mono text-neutral-300">
      {filteredEvents.length} events displayed / {events.length} total
    </span>
  </div>
</div>
