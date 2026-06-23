<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { ShoppingCart, Tag, Zap, CheckCircle2 } from 'lucide-svelte';
  import {
    subscribeDisplayState,
    emptyDisplayState,
    type CustomerDisplayState,
  } from '../customerDisplay';

  let state: CustomerDisplayState = $state(emptyDisplayState);
  let now = $state(new Date());

  onMount(() => {
    const unsub = subscribeDisplayState((s) => { state = s; });
    const clock = setInterval(() => { now = new Date(); }, 1000);
    return () => { unsub(); clearInterval(clock); };
  });

  const money = (n: number) => `R ${(n || 0).toFixed(2)}`;
  let itemCount = $derived(state.items.reduce((acc, i) => acc + i.quantity, 0));
</script>

<div class="h-screen w-screen flex flex-col bg-neutral-950 text-white overflow-hidden">
  <!-- Header -->
  <header class="flex-none flex items-center justify-between px-10 py-6 border-b border-white/5">
    <div class="flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.3)]">
        <ShoppingCart class="w-6 h-6 text-black" />
      </div>
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 leading-none mb-1.5">Clinton POS</p>
        <h1 class="text-xl font-black uppercase tracking-tight leading-none">Welcome</h1>
      </div>
    </div>
    <div class="text-right">
      <p class="text-2xl font-black font-mono tabular-nums leading-none">
        {now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {#if state.terminalId}
        <p class="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1.5">Terminal {state.terminalId}</p>
      {/if}
    </div>
  </header>

  <!-- Body -->
  <div class="flex-1 flex min-h-0">
    <!-- Items -->
    <div class="flex-1 flex flex-col min-h-0 px-10 py-6">
      <div class="flex items-center justify-between mb-4">
        <p class="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">Your Items</p>
        {#if itemCount > 0}
          <p class="text-[11px] font-black uppercase tracking-widest text-amber-400">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto space-y-3 pr-2">
        {#if state.items.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-center opacity-30" in:fade>
            <div class="w-28 h-28 rounded-[40px] border-4 border-dashed border-white/30 flex items-center justify-center mb-6">
              <ShoppingCart class="w-12 h-12 text-white/40" />
            </div>
            <p class="text-lg font-black uppercase tracking-[0.3em] text-white/50">Awaiting Items</p>
            <p class="text-sm text-white/30 mt-2 uppercase tracking-widest">Your purchase will appear here</p>
          </div>
        {:else}
          {#each state.items as item (item.id)}
            <div
              animate:flip={{ duration: 250 }}
              in:fly={{ x: 30, duration: 200 }}
              class="flex items-center gap-5 px-6 py-4 bg-white/5 border border-white/10 rounded-3xl"
            >
              <div class="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-black text-lg tabular-nums shrink-0">
                {item.quantity}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-lg font-black uppercase tracking-tight truncate">{item.name}</p>
                <p class="text-sm text-white/40 font-mono">{money(item.price)} each</p>
              </div>
              <p class="text-xl font-black font-mono tabular-nums text-amber-400 shrink-0">{money(item.lineTotal)}</p>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Totals sidebar -->
    <div class="w-[400px] flex-none flex flex-col border-l border-white/5 bg-black/40 px-10 py-6">
      {#if state.status === 'paid'}
        <div class="flex-1 flex flex-col items-center justify-center text-center" in:scale={{ start: 0.9 }}>
          <CheckCircle2 class="w-24 h-24 text-emerald-400 mb-6" />
          <h2 class="text-3xl font-black uppercase tracking-tight mb-2">Thank You!</h2>
          <p class="text-white/40 uppercase tracking-widest text-sm">Payment received</p>
        </div>
      {:else}
        <div class="flex-1 flex flex-col justify-end space-y-4">
          {#if state.customerName}
            <div class="px-5 py-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl">
              <p class="text-[9px] font-black uppercase tracking-widest text-amber-400/60">Loyalty Member</p>
              <p class="text-sm font-black uppercase tracking-tight text-amber-400">{state.customerName}</p>
            </div>
          {/if}

          <div class="space-y-3 text-sm">
            <div class="flex justify-between text-white/50 font-bold uppercase tracking-widest text-[11px]">
              <span>Subtotal</span>
              <span class="font-mono text-white/80">{money(state.subtotal)}</span>
            </div>
            {#if state.promoDiscount > 0}
              <div class="flex justify-between text-emerald-400 font-bold uppercase tracking-widest text-[11px]">
                <span class="flex items-center gap-1.5"><Zap class="w-3.5 h-3.5" /> Promotions</span>
                <span class="font-mono">- {money(state.promoDiscount)}</span>
              </div>
            {/if}
            {#if state.pointsDiscount > 0}
              <div class="flex justify-between text-rose-400 font-bold uppercase tracking-widest text-[11px]">
                <span class="flex items-center gap-1.5"><Tag class="w-3.5 h-3.5" /> Rewards</span>
                <span class="font-mono">- {money(state.pointsDiscount)}</span>
              </div>
            {/if}
            <div class="flex justify-between text-white/50 font-bold uppercase tracking-widest text-[11px]">
              <span>VAT (15%)</span>
              <span class="font-mono text-white/80">{money(state.vat)}</span>
            </div>
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-white/10">
          <p class="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Total Due</p>
          <p class="text-6xl font-black font-mono tabular-nums tracking-tighter text-amber-400 leading-none">
            {money(state.grandTotal)}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
