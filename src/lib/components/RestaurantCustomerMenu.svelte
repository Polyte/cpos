<script lang="ts">
  import { Loader2, Minus, Plus, Send, UtensilsCrossed, Play, Sparkles, Search, ShoppingBag, Phone, ReceiptText, X, ChevronRight } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { api } from '../api';

  const params = new URLSearchParams(window.location.search);
  const merchantId = params.get('merchantId') || 'merchant:M4';
  const tableId = params.get('tableId') || '';
  const heroVideos = [
    { id: 'rKxMho_g4oI', title: 'Good food, beautifully served', label: 'Our kitchen' },
    { id: '9OquUp6x5IU', title: 'Make your table a moment', label: 'The Roxton experience' },
  ];
  const fallbackMenu = [
    { id: 'R1', name: 'Classic Eggs Benedict', category: 'Food', course: 'Main', price: 74, image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=640&q=82', description: 'Poached eggs and generous toppings layered over a toasted base with a silky sauce.' },
    { id: 'R2', name: 'Chicken Burger', category: 'Food', course: 'Main', price: 74, image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=640&q=82', description: 'A juicy, generously layered burger served with fresh toppings and a toasted bun.' },
    { id: 'R5', name: 'Beef Burger', category: 'Food', course: 'Main', price: 99, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=82', description: 'A rich, savoury burger with a juicy centre and fresh toppings.' },
    { id: 'R6', name: 'Smashed Avo & Poached Egg', category: 'Food', course: 'Main', price: 74, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=640&q=82', description: 'Creamy smashed avocado and a perfectly poached egg on toasted bread.' },
    { id: 'R9', name: 'Bottomless Filter Coffee', category: 'Beverage', course: 'Drink', price: 49, image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=640&q=82', description: 'Smooth, freshly brewed coffee with a warm aroma and balanced finish.' },
    { id: 'R12', name: 'Cappuccino', category: 'Beverage', course: 'Drink', price: 45, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=82', description: 'Smooth espresso and velvety steamed milk finished with soft foam.' },
    { id: 'R16', name: 'Famous Giant Muffin', category: 'Food', course: 'Dessert', price: 52, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=640&q=82', description: 'A freshly baked, generously sized muffin with a soft crumb.' },
    { id: 'R20', name: 'Triple Chocolate Brownie', category: 'Food', course: 'Dessert', price: 40, image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?auto=format&fit=crop&w=640&q=82', description: 'A rich, fudgy chocolate brownie made for an indulgent finish.' },
  ];
  let activeVideo = $state(0);
  let menu = $state<any[]>([]);
  let cart = $state<Record<string, any>>({});
  let customerName = $state('');
  let notes = $state('');
  let paymentMethod = $state<'At table' | 'Card on phone' | 'Apple Pay' | 'Online bank'>('Card on phone');
  let loading = $state(true);
  let menuError = $state('');
  let submitting = $state(false);
  let submitted = $state<any>(null);
  let paymentRequested = $state(false);
  let search = $state('');
  let category = $state('All');
  let selectedItem = $state<any>(null);
  let itemNotes = $state('');
  let activeSection = $state<'menu' | 'order'>('menu');
  let requestSent = $state('');

  let cartItems = $derived(Object.values(cart));
  let cartCount = $derived(cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0));
  let total = $derived(cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0));
  let categories = $derived(['All', ...Array.from(new Set(menu.map((item: any) => item.course || item.category).filter(Boolean)))].slice(0, 12));
  let filteredMenu = $derived(menu.filter((item: any) => {
    const text = `${item.name} ${item.description || ''} ${item.category || ''}`.toLowerCase();
    return (category === 'All' || item.course === category || item.category === category) && (!search || text.includes(search.toLowerCase()));
  }));

  $effect(() => {
    (async () => {
      try {
        const nextMenu = await api.getRestaurantMenu(merchantId);
        menu = Array.isArray(nextMenu) && nextMenu.length ? nextMenu : fallbackMenu;
        if (!Array.isArray(nextMenu) || !nextMenu.length) menuError = 'Live menu connection unavailable — showing the saved restaurant menu.';
      } catch (error) {
        console.error('[Restaurant menu] load error:', error);
        menu = fallbackMenu;
        menuError = 'Live menu connection unavailable — showing the saved restaurant menu.';
      } finally {
        loading = false;
      }
    })();
  });

  function add(item: any) {
    cart = { ...cart, [item.id]: { ...item, quantity: (cart[item.id]?.quantity || 0) + 1 } };
  }
  function openItem(item: any) {
    selectedItem = item;
    itemNotes = '';
  }
  function addSelectedItem() {
    if (!selectedItem) return;
    const item = { ...selectedItem, notes: itemNotes };
    cart = { ...cart, [item.id]: { ...item, quantity: (cart[item.id]?.quantity || 0) + 1 } };
    selectedItem = null;
  }
  async function createRequest(type: string, note = '') {
    if (!tableId) return toast.error('This QR code is missing a table number.');
    const result = await api.createRestaurantRequest({ merchantId, tableId, type, note });
    if (!result.success) return toast.error(result.error || 'Could not contact your waiter');
    requestSent = type;
    toast.success(type === 'BILL_REQUESTED' ? 'Bill requested' : 'Your waiter has been notified');
  }
  function remove(item: any) {
    const next = Math.max(0, (cart[item.id]?.quantity || 0) - 1);
    const updated = { ...cart };
    if (next === 0) delete updated[item.id];
    else updated[item.id] = { ...updated[item.id], quantity: next };
    cart = updated;
  }
  async function submit() {
    if (!tableId) return toast.error('This QR code is missing a table number.');
    if (!cartItems.length) return toast.error('Add at least one item.');
    submitting = true;
    const result = await api.submitRestaurantOrder({ merchantId, tableId, customerName, notes, items: cartItems.map((item: any) => ({ id: item.id, quantity: item.quantity })) });
    submitting = false;
    if (!result.success) return toast.error(result.error || 'Could not send order');
    submitted = result.order;
    cart = {};
  }
  async function requestPayment() {
    if (!submitted?.id) return;
    submitting = true;
    const result = await api.requestRestaurantPayment(submitted.id, paymentMethod);
    submitting = false;
    if (!result.success) return toast.error(result.error || 'Could not send payment request');
    submitted = result.order || { ...submitted, paymentMethod };
    paymentRequested = true;
    toast.success('Payment request sent to your waiter');
  }
</script>

<main class="min-h-screen bg-[#f8f5ef] text-stone-900 pb-32">
  <header class="sticky top-0 z-20 bg-stone-950/95 px-5 py-4 text-white shadow-lg backdrop-blur">
    <div class="mx-auto flex max-w-2xl items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-stone-950"><UtensilsCrossed size={22} /></div><div><p class="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Melrose Arch Kitchen</p><h1 class="text-xl font-black">Scan & order</h1></div></div><div class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-right"><p class="text-[8px] font-black uppercase tracking-widest text-stone-400">Table</p><p class="text-sm font-black text-amber-300">{tableId || '—'}</p></div></div>
  </header>
  <section class="mx-auto max-w-2xl space-y-5 px-4 pb-6 pt-4 sm:p-5">
    <section class="overflow-hidden rounded-[2rem] bg-stone-950 text-white shadow-xl shadow-stone-900/15">
      <div class="relative aspect-[16/10] overflow-hidden bg-stone-900">
        <iframe class="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${heroVideos[activeVideo].id}?autoplay=1&mute=1&loop=1&playlist=${heroVideos[activeVideo].id}&rel=0&modestbranding=1&playsinline=1`} title={heroVideos[activeVideo].title} allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stone-950/80 to-transparent"></div>
      </div>
      <div class="space-y-4 p-5">
        <div class="flex items-start justify-between gap-4"><div><div class="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-amber-300"><Sparkles size={13} /> Welcome to Roxton</div><h2 class="text-2xl font-black leading-tight">{heroVideos[activeVideo].title}</h2><p class="mt-2 text-sm leading-relaxed text-stone-400">Take a seat, explore the menu, and let us bring the experience to your table.</p></div><div class="hidden rounded-2xl bg-amber-400/10 p-3 text-amber-300 sm:block"><UtensilsCrossed size={20} /></div></div>
        <div class="grid grid-cols-2 gap-3">
          {#each heroVideos as video, index (video.id)}
            <button onclick={() => activeVideo = index} class="group relative overflow-hidden rounded-2xl border text-left transition-all {activeVideo === index ? 'border-amber-300 ring-2 ring-amber-300/20' : 'border-white/10 opacity-75 hover:opacity-100'}">
              <img src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`} alt={video.title} class="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div><div class="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2"><span class="text-[9px] font-black leading-tight text-white">{video.label}</span><span class="rounded-full bg-amber-400 p-1.5 text-stone-950"><Play size={11} fill="currentColor" /></span></div>
            </button>
          {/each}
        </div>
      </div>
    </section>
    {#if submitted}
      <div class="rounded-3xl bg-emerald-600 p-6 text-white shadow-xl"><p class="text-xs font-black uppercase tracking-widest text-emerald-100">Order received</p><h2 class="mt-2 text-2xl font-black">Waiting for waiter approval</h2><p class="mt-2 text-sm text-emerald-50">Your waiter has received the order. Choose how you would like to pay from your phone.</p><p class="mt-5 text-3xl font-black">R{Number(submitted.total || 0).toFixed(2)}</p></div>
      <div class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><p class="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">Pay from your phone</p><div class="mt-3 grid grid-cols-2 gap-2"><button onclick={() => paymentMethod = 'Card on phone'} class="rounded-xl border px-3 py-3 text-left text-xs font-black {paymentMethod === 'Card on phone' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}">Card on phone</button><button onclick={() => paymentMethod = 'Apple Pay'} class="rounded-xl border px-3 py-3 text-left text-xs font-black {paymentMethod === 'Apple Pay' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}">Apple Pay</button><button onclick={() => paymentMethod = 'Online bank'} class="rounded-xl border px-3 py-3 text-left text-xs font-black {paymentMethod === 'Online bank' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}">Online bank</button><button onclick={() => paymentMethod = 'At table'} class="rounded-xl border px-3 py-3 text-left text-xs font-black {paymentMethod === 'At table' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}">Pay at table</button></div><button onclick={requestPayment} disabled={submitting || paymentRequested} class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 py-4 text-xs font-black text-white disabled:opacity-50"><Send size={16} />{paymentRequested ? `Payment request sent: ${paymentMethod}` : submitting ? 'Sending request…' : `Request ${paymentMethod}`}</button><p class="mt-3 text-[11px] leading-relaxed text-stone-500">Your waiter will confirm the request. Card, Apple Pay, and online bank settlement require the restaurant’s payment provider to be configured.</p></div>
    {:else if loading}
      <div class="py-20 text-center text-stone-500"><Loader2 class="animate-spin mx-auto mb-3" />Loading menu…</div>
    {:else}
      {#if menuError}<div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><span class="font-black">Offline menu:</span> {menuError} <button onclick={() => window.location.reload()} class="ml-2 font-black underline">Retry</button></div>{/if}
      <div class="sticky top-[76px] z-10 -mx-1 space-y-3 bg-[#f8f5ef]/95 py-2 backdrop-blur"><div class="relative"><Search class="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input bind:value={search} placeholder="Search dishes, drinks and specials" class="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none focus:border-amber-400" /></div><div class="flex gap-2 overflow-x-auto pb-1">{#each categories as cat}<button onclick={() => category = cat} class="shrink-0 rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition {category === cat ? 'bg-stone-950 text-white' : 'bg-white text-stone-500 shadow-sm'}">{cat}</button>{/each}</div></div>
      <div class="flex items-center justify-between px-1"><div><p class="text-[9px] font-black uppercase tracking-[0.25em] text-amber-700">From our kitchen</p><h2 class="mt-1 text-2xl font-black tracking-tight text-stone-950">Choose your favourites</h2></div><span class="rounded-full bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-stone-500 shadow-sm">{menu.length} items</span></div>
      <div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {#each filteredMenu as item (item.id)}
          <article class="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"><button onclick={() => openItem(item)} class="block w-full text-left"><div class="relative h-36 overflow-hidden bg-stone-100">{#if item.image}<img src={item.image} alt={item.name} class="h-full w-full object-cover" loading="lazy" />{:else}<div class="flex h-full items-center justify-center text-stone-300"><UtensilsCrossed size={28} /></div>{/if}<span class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-stone-700">{item.category || item.course || 'Menu item'}</span></div><div class="p-4 pb-2"><div class="flex items-start justify-between gap-3"><div><p class="font-black leading-tight">{item.name}</p><p class="mt-2 text-lg font-black text-amber-700">R{Number(item.price || 0).toFixed(2)}</p></div><ChevronRight class="mt-1 h-4 w-4 text-stone-300" /></div><p class="mt-3 line-clamp-2 text-xs leading-relaxed text-stone-500">{item.description || 'Prepared fresh in our kitchen with carefully selected ingredients.'}</p></div></button><div class="flex items-center justify-between border-t border-stone-100 px-4 py-3"><span class="text-[9px] font-black uppercase tracking-widest text-stone-400">{cart[item.id]?.quantity || 0} in order</span><div class="flex items-center gap-2"><button aria-label="Remove {item.name}" onclick={() => remove(item)} class="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200"><Minus size={15} /></button><button aria-label="Add {item.name}" onclick={() => add(item)} class="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-950 text-white"><Plus size={15} /></button></div></div></article>
        {/each}
        {#if !filteredMenu.length}<div class="col-span-full rounded-3xl bg-white p-10 text-center text-sm text-stone-500">No dishes match your search.</div>{/if}
      </div>
      <div id="order-form" class="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm"><p class="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">Before we send it</p><div class="space-y-3"><input bind:value={customerName} placeholder="Your name (optional)" class="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-amber-400" /><textarea bind:value={notes} placeholder="Allergies or special requests" class="min-h-20 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-amber-400"></textarea><div class="hidden items-center justify-between sm:flex"><span class="font-black">Total</span><span class="text-2xl font-black">R{Number(total).toFixed(2)}</span></div><button onclick={submit} disabled={submitting || !cartItems.length} class="hidden w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 font-black disabled:opacity-50 sm:flex"><Send size={17} />{submitting ? 'Sending…' : 'Send order to waiter'}</button></div></div>
    {/if}
  </section>
</main>
<nav class="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_25px_rgba(67,47,27,0.1)] backdrop-blur sm:hidden"><div class="mx-auto grid max-w-2xl grid-cols-4 gap-1"><button onclick={() => activeSection = 'menu'} class="flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest {activeSection === 'menu' ? 'text-amber-700' : 'text-stone-400'}"><UtensilsCrossed size={17} />Menu</button><button onclick={() => { activeSection = 'order'; document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' }); }} class="relative flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest {activeSection === 'order' ? 'text-amber-700' : 'text-stone-400'}"><ShoppingBag size={17} />Order{#if cartCount}<span class="absolute right-5 top-0 rounded-full bg-amber-500 px-1.5 text-[8px] text-stone-950">{cartCount}</span>{/if}</button><button onclick={() => createRequest('WAITER_ASSISTANCE')} class="flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest text-stone-400"><Phone size={17} />Waiter</button><button onclick={() => createRequest('BILL_REQUESTED')} class="flex flex-col items-center gap-1 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest text-stone-400"><ReceiptText size={17} />Bill</button></div></nav>
{#if selectedItem}<div class="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 sm:rounded-[2rem]"><div class="mb-4 flex items-center justify-between"><div><p class="text-[9px] font-black uppercase tracking-widest text-amber-700">Customize your dish</p><h2 class="mt-1 text-2xl font-black">{selectedItem.name}</h2></div><button onclick={() => selectedItem = null} class="rounded-full bg-stone-100 p-2"><X size={18} /></button></div>{#if selectedItem.image}<img src={selectedItem.image} alt={selectedItem.name} class="mb-4 h-48 w-full rounded-2xl object-cover" />{/if}<p class="text-sm leading-relaxed text-stone-600">{selectedItem.description}</p><div class="mt-5 rounded-2xl bg-stone-50 p-4"><label class="text-[9px] font-black uppercase tracking-widest text-stone-500" for="special-note">Special instructions</label><textarea id="special-note" bind:value={itemNotes} placeholder="No onions, extra sauce..." class="mt-2 min-h-24 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-amber-400"></textarea></div><div class="mt-5 flex items-center justify-between"><span class="text-2xl font-black text-amber-700">R{Number(selectedItem.price || 0).toFixed(2)}</span><button onclick={addSelectedItem} class="rounded-2xl bg-stone-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white">Add to order</button></div></div></div>{/if}
{#if !submitted && !loading && cartItems.length > 0}
  <div class="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-12px_35px_rgba(67,47,27,0.15)] backdrop-blur sm:hidden">
    <div class="mx-auto flex max-w-2xl items-center gap-3"><div class="min-w-0 flex-1"><p class="text-[9px] font-black uppercase tracking-widest text-stone-500">Your order · {cartCount} {cartCount === 1 ? 'item' : 'items'}</p><p class="mt-0.5 text-xl font-black text-stone-950">R{Number(total).toFixed(2)}</p></div><button onclick={submit} disabled={submitting} class="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 text-xs font-black text-white shadow-lg shadow-stone-950/20 disabled:opacity-50"><Send size={16} />{submitting ? 'Sending…' : 'Send order'}</button></div>
  </div>
{/if}
