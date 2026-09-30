<script lang="ts">
  import { ChefHat, Check, Clock3, Flame, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-svelte';
  import { api } from '../api';

  const params = new URLSearchParams(window.location.search);
  const merchantId = params.get('merchantId') || 'merchant:M4';
  let tickets = $state<any[]>([]);
  let menu = $state<any[]>([]);
  let loading = $state(true);
  let updating = $state<string | null>(null);
  let lastUpdated = $state(new Date());

  let activeTickets = $derived(tickets.filter((ticket) => !['SERVED', 'CANCELLED', 'Completed'].includes(ticket.status)));
  let menuByName = $derived(new Map(menu.map((item) => [String(item.name).toLowerCase(), item])));

  async function load() {
    const [nextTickets, nextMenu] = await Promise.all([api.getKOTs(merchantId), api.getRestaurantMenu(merchantId)]);
    if (Array.isArray(nextTickets)) tickets = nextTickets;
    if (Array.isArray(nextMenu)) menu = nextMenu;
    lastUpdated = new Date();
    loading = false;
  }

  $effect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  });

  function itemImage(item: any) {
    return item.image || item.imageUrl || menuByName.get(String(item.name || '').toLowerCase())?.image || '';
  }

  function nextStatus(status: string) {
    if (status === 'NEW' || status === 'Open') return 'IN_PROGRESS';
    if (status === 'IN_PROGRESS' || status === 'Fired') return 'READY';
    if (status === 'READY') return 'SERVED';
    return null;
  }

  async function advance(ticket: any) {
    const status = nextStatus(ticket.status);
    if (!status) return;
    updating = ticket.id;
    await api.updateKOTStatus(ticket.id, { status });
    await load();
    updating = null;
  }
</script>

<main class="min-h-screen bg-neutral-950 text-white p-5 md:p-8">
  <header class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-8">
    <div class="flex items-center gap-3"><div class="w-12 h-12 rounded-2xl bg-orange-500 text-neutral-950 flex items-center justify-center"><ChefHat size={25} /></div><div><p class="text-[10px] uppercase tracking-[0.3em] font-black text-orange-400">Kitchen Display</p><h1 class="text-3xl font-black">Melrose Arch Kitchen</h1><p class="text-xs text-neutral-500">Live order rail · updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p></div></div>
    <div class="flex items-center gap-3"><span class="rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm font-black">{activeTickets.length} active orders</span><button aria-label="Refresh kitchen orders" onclick={load} class="rounded-xl bg-neutral-900 border border-neutral-800 p-3 hover:border-orange-500/50"><RefreshCw size={17} /></button></div>
  </header>

  {#if loading}
    <div class="py-24 text-center text-neutral-500"><Loader2 class="animate-spin mx-auto mb-3" />Loading kitchen orders…</div>
  {:else if activeTickets.length === 0}
    <div class="max-w-2xl mx-auto py-24 text-center rounded-3xl border border-dashed border-neutral-800"><UtensilsCrossed size={40} class="mx-auto text-neutral-700 mb-4" /><h2 class="text-xl font-black text-neutral-300">Kitchen is clear</h2><p class="text-sm text-neutral-600 mt-2">New approved orders will appear automatically.</p></div>
  {:else}
    <section class="max-w-7xl mx-auto grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {#each activeTickets as ticket (ticket.id)}
        {@const status = ticket.status === 'NEW' || ticket.status === 'Open' ? { label: 'New', color: 'text-amber-300', bg: 'bg-amber-500/15', next: 'Start cooking' } : ticket.status === 'READY' ? { label: 'Ready', color: 'text-emerald-300', bg: 'bg-emerald-500/15', next: 'Mark served' } : { label: 'Cooking', color: 'text-blue-300', bg: 'bg-blue-500/15', next: 'Mark ready' }}
        <article class="rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xl"><div class="p-4 border-b border-neutral-800 flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black text-neutral-500">{ticket.tableName || ticket.tableId || 'Order'}</p><h2 class="text-xl font-black mt-1">#{String(ticket.id).split(':').pop()?.slice(-5)}</h2><p class="text-xs text-neutral-500 mt-1"><Clock3 size={12} class="inline mr-1" />{new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ticket.serverName || 'Waiter'}</p></div><span class="rounded-xl px-3 py-2 text-[10px] uppercase tracking-widest font-black {status.bg} {status.color}">{status.label}</span></div><div class="p-4 space-y-3">{#each ticket.items || [] as item, index (item.id || `${item.name}-${index}`)}<div class="flex items-center gap-3 rounded-2xl bg-neutral-950/70 p-3"><div class="h-16 w-16 shrink-0 rounded-xl bg-neutral-800 overflow-hidden flex items-center justify-center">{#if itemImage(item)}<img src={itemImage(item)} alt={item.name} class="h-full w-full object-cover" />{:else}<Flame size={20} class="text-neutral-600" />{/if}</div><div class="min-w-0 flex-1"><p class="font-black text-sm">{item.name}</p><p class="text-xs text-neutral-500 mt-1">{item.qty || item.quantity || 1} × R{Number(item.price || 0).toFixed(2)} {item.course ? `· ${item.course}` : ''}</p>{#if item.notes}<p class="text-xs text-orange-300 mt-1">Note: {item.notes}</p>{/if}</div></div>{/each}</div><div class="px-4 pb-4"><button onclick={() => advance(ticket)} disabled={updating === ticket.id || !nextStatus(ticket.status)} class="w-full rounded-xl bg-orange-500 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-950 hover:bg-orange-400 disabled:opacity-50">{updating === ticket.id ? 'Updating…' : status.next}</button></div></article>
      {/each}
    </section>
  {/if}
</main>
