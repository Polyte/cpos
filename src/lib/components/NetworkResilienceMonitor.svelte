<script lang="ts">
  import {
    Network, Wifi, WifiOff, Activity, AlertCircle, Clock,
    Terminal, ShieldCheck, Database, RefreshCw, X, ChevronDown,
    Server, Zap, Globe, Smartphone, Lock
  } from 'lucide-svelte';
  import { subscribeToNetworkEvents } from '../api';
  import { syncManager } from '../SyncManager';
  import { toast } from 'svelte-sonner';

  interface NetworkEvent {
    id: string;
    type: 'TIMEOUT' | 'NETWORK_FAILURE' | 'OFFLINE' | 'UNKNOWN_ERROR';
    url: string;
    method: string;
    error: string;
    timestamp: number;
  }

  let events = $state<NetworkEvent[]>([]);
  let isOnline = $state(navigator.onLine);
  let isExpanded = $state(false);
  let isLive = $state(true);
  let isSimulatingOffline = $state(false);
  let scrollRef = $state<HTMLDivElement | null>(null);

  function toggleSimulatedOffline() {
    const newVal = !isSimulatingOffline;
    isSimulatingOffline = newVal;
    syncManager.setForceOffline(newVal);
    toast.info(newVal ? 'Forced Offline Mode Active' : 'Normal Network Connectivity Restored');
  }

  $effect(() => {
    const handleOnline = () => {
      isOnline = true;
      const onlineEvent: NetworkEvent = {
        id: `net-${Date.now()}-online`,
        type: 'OFFLINE',
        url: 'SYSTEM',
        method: 'STATUS',
        error: 'Network connectivity restored. Uplink active.',
        timestamp: Date.now()
      };
      events = [onlineEvent, ...events].slice(0, 50);
    };

    const handleOffline = () => {
      isOnline = false;
      const offlineEvent: NetworkEvent = {
        id: `net-${Date.now()}-offline`,
        type: 'OFFLINE',
        url: 'SYSTEM',
        method: 'STATUS',
        error: 'Critical: Network uplink lost. Switching to LocalDB buffer.',
        timestamp: Date.now()
      };
      events = [offlineEvent, ...events].slice(0, 50);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToNetworkEvents((event) => {
      const newEvent: NetworkEvent = {
        ...event,
        id: `net-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      };
      events = [newEvent, ...events].slice(0, 50);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  });

  $effect(() => {
    // Track events and isLive to trigger scroll
    const _ = events;
    if (isLive && scrollRef) {
      scrollRef.scrollTop = 0;
    }
  });

  const stats = $derived({
    total: events.length,
    timeouts: events.filter(e => e.type === 'TIMEOUT').length,
    failures: events.filter(e => e.type === 'NETWORK_FAILURE').length,
    critical: events.filter(e => e.type === 'OFFLINE').length
  });

  const nodeId = localStorage.getItem('clintpos_node_id') || 'NODE-UNDEFINED';
</script>

<div
  class={`fixed bottom-4 right-4 z-[9999] transition-all duration-500 font-mono ${isExpanded ? 'w-96' : 'w-14 h-14'}`}
  style="font-family: 'JetBrains Mono', monospace;"
>
  {#if !isExpanded}
    <!-- Collapsed pill button -->
    <button
      onclick={() => (isExpanded = true)}
      class={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all relative ${
        !isOnline
          ? 'bg-rose-600 border-rose-400 animate-pulse text-white'
          : stats.failures > 0
          ? 'bg-amber-500 border-amber-300 text-black animate-pulse'
          : 'bg-neutral-900 border-neutral-700 text-emerald-500 hover:border-emerald-500'
      }`}
    >
      {#if !isOnline}
        <WifiOff class="w-6 h-6" />
      {:else}
        <Activity class="w-6 h-6" />
      {/if}
      {#if stats.failures > 0}
        <span class="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border border-rose-400">
          {stats.failures}
        </span>
      {/if}
    </button>
  {:else}
    <!-- Expanded panel -->
    <div class="bg-black border-2 border-neutral-800 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
      <!-- Industrial Header -->
      <div class="bg-neutral-900 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></div>
          <div>
            <h3 class="text-[10px] font-black uppercase tracking-widest text-white">Forensic Network Node</h3>
            <p class="text-[7px] font-bold text-neutral-500 tracking-widest">{nodeId}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={toggleSimulatedOffline}
            class={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 transition-all ${
              isSimulatingOffline
                ? 'bg-rose-600 text-white border border-rose-400 animate-pulse'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'
            }`}
          >
            {#if isSimulatingOffline}
              <WifiOff class="w-2.5 h-2.5" />
              FORCED OFFLINE
            {:else}
              <Wifi class="w-2.5 h-2.5" />
              FORCE OFFLINE
            {/if}
          </button>
          <button
            onclick={() => (isLive = !isLive)}
            class={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
            }`}
          >
            LIVE FEED
          </button>
          <button onclick={() => (isExpanded = false)} class="text-neutral-500 hover:text-white transition-colors p-1">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Dashboard Stats -->
      <div class="grid grid-cols-4 divide-x divide-neutral-800 bg-neutral-900/80 border-b border-neutral-800">
        <div class="p-2 text-center">
          <p class="text-[8px] font-bold text-neutral-500 uppercase mb-0.5 tracking-tighter">ALERTS</p>
          <p class="text-xs font-black text-white">{stats.total}</p>
        </div>
        <div class="p-2 text-center">
          <p class="text-[8px] font-bold text-neutral-500 uppercase mb-0.5 tracking-tighter">TIMEOUTS</p>
          <p class="text-xs font-black text-amber-500">{stats.timeouts}</p>
        </div>
        <div class="p-2 text-center">
          <p class="text-[8px] font-bold text-neutral-500 uppercase mb-0.5 tracking-tighter">FAULTS</p>
          <p class="text-xs font-black text-rose-500">{stats.failures}</p>
        </div>
        <div class="p-2 text-center">
          <p class="text-[8px] font-bold text-neutral-500 uppercase mb-0.5 tracking-tighter">UPLINK</p>
          <p class={`text-xs font-black ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isOnline ? 'ACTIVE' : 'LOST'}
          </p>
        </div>
      </div>

      <!-- Event Feed -->
      <div
        bind:this={scrollRef}
        class="h-80 overflow-y-auto p-4 space-y-3 bg-[#050505] selection:bg-emerald-900/50 scrollbar-hide"
      >
        {#if events.length === 0}
          <div class="h-full flex flex-col items-center justify-center opacity-20">
            <Terminal class="w-12 h-12 mb-2 text-emerald-500" />
            <p class="text-[10px] font-black uppercase tracking-[0.3em]">No Faults Detected</p>
            <p class="text-[8px] mt-1">Listening on port 443...</p>
          </div>
        {:else}
          {#each events as event (event.id)}
            <div
              class={`p-3 rounded-lg border leading-tight ${
                event.type === 'OFFLINE'
                  ? 'bg-rose-950/20 border-rose-900/50'
                  : event.type === 'TIMEOUT'
                  ? 'bg-amber-950/20 border-amber-900/50'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div class="flex items-center justify-between mb-2">
                <span
                  class={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                    event.type === 'OFFLINE'
                      ? 'bg-rose-500 text-white'
                      : event.type === 'TIMEOUT'
                      ? 'bg-amber-500 text-black'
                      : 'bg-neutral-700 text-neutral-100'
                  }`}
                >
                  {event.type}
                </span>
                <span class="text-[8px] font-bold text-neutral-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p class="text-[10px] font-black text-neutral-100 break-all mb-1">
                {event.method} {event.url.split('/').pop() || '/'}
              </p>
              <p class="text-[9px] text-neutral-400 font-mono italic">
                {event.error}
              </p>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">
                  Forensic UID: {event.id.slice(-6)}
                </span>
                <div class="flex gap-1">
                  <div class="w-1 h-1 bg-emerald-500/20 rounded-full"></div>
                  <div class="w-1 h-1 bg-emerald-500/20 rounded-full"></div>
                  <div class="w-1 h-1 bg-emerald-500/20 rounded-full"></div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Forensic Trace / Clear Cache -->
      <div class="p-3 bg-neutral-900/90 border-t border-neutral-800">
        <button
          class="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all active:scale-[0.98] group"
          onclick={() => {
            events = [];
            toast.success('Fault cache flushed');
            console.log('[Network Resilience] Manual Flush Triggered');
          }}
        >
          <RefreshCw class="w-3 h-3 text-rose-400 group-hover:rotate-180 transition-transform duration-500" />
          <span class="text-[9px] font-black text-rose-400 uppercase tracking-widest">Clear Fault Cache</span>
        </button>
      </div>
    </div>
  {/if}
</div>
