<script lang="ts">
  import { Database, RefreshCw, Search, Package, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { api } from '../api';

  let { role }: { role: string } = $props();
  let products = $state<any[]>([]);
  let searchQuery = $state('');
  let loading = $state(true);
  let enriching = $state(false);
  let enrichmentMessage = $state('');
  let importing = $state(false);
  let importMessage = $state('');
  let selectedProduct = $state<any | null>(null);
  let currentPage = $state(1);
  const pageSize = 20;

  let filteredProducts = $derived(products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [product.name, product.brand, product.barcode, product.sku]
      .some((value) => String(value || '').toLowerCase().includes(query));
  }));
  let totalPages = $derived(Math.max(1, Math.ceil(filteredProducts.length / pageSize)));
  let paginatedProducts = $derived(filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize));

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  async function loadProducts(resetPage = true) {
    loading = true;
    const data = await api.getProductCloud();
    products = Array.isArray(data) ? data : [];
    if (resetPage) currentPage = 1;
    loading = false;
  }

  async function searchProducts() {
    if (!searchQuery.trim()) return loadProducts();
    loading = true;
    const data = await api.searchProductCloud(searchQuery.trim());
    products = Array.isArray(data) ? data : [];
    currentPage = 1;
    loading = false;
  }

  async function enrichFromBarcodeNest() {
    enriching = true;
    enrichmentMessage = '';
    const result = await api.enrichProductCloud(100);
    enrichmentMessage = result.success
      ? `Enriched ${result.enriched} products. ${result.notFound} barcodes were not found.`
      : (result.error || 'BarcodeNest enrichment failed');
    enriching = false;
    await loadProducts();
  }

  async function importAllLoyaltyHub() {
    importing = true;
    importMessage = 'Importing LoyaltyHub catalogue…';
    let offset = 0;
    let total = 0;
    let pages = 0;
    try {
      while (pages < 200) {
        const result = await api.importLoyaltyHubCatalog(offset, 500);
        if (!result.success) throw new Error(result.error || 'Import failed');
        total += Number(result.imported || 0);
        pages += 1;
        importMessage = `Imported ${total.toLocaleString()} products…`;
        const discovered = Number(result.discovered || 0);
        if (!result.hasMore || discovered === 0) break;
        offset += discovered;
      }
      importMessage = `LoyaltyHub import complete: ${total.toLocaleString()} products processed.`;
      await loadProducts();
    } catch (error: any) {
      importMessage = error?.message || 'LoyaltyHub import failed';
    } finally {
      importing = false;
    }
  }

  $effect(() => {
    if (role !== 'Admin') return;
    loadProducts();
    const refreshTimer = setInterval(() => {
      if (!searchQuery.trim()) loadProducts(false);
    }, 15000);
    return () => clearInterval(refreshTimer);
  });

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') searchProducts();
  }

  function goToPage(page: number) {
    currentPage = Math.min(Math.max(page, 1), totalPages);
  }

  function productPrice(product: any) {
    return product.price ?? product.loyaltyhub?.price ?? product.loyaltyhub?.startingPrice ?? null;
  }

  function formatPrice(product: any) {
    const value = productPrice(product);
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string' && value.trim().toUpperCase().startsWith('R')) return value;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `R${numeric.toFixed(2)}` : String(value);
  }
</script>

{#if role !== 'Admin'}
  <div class="p-10 text-center text-sm font-bold text-neutral-400">Admin access required.</div>
{:else}
  <div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto overflow-y-auto h-full">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20"><Database size={22} /></div>
          <div><p class="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600">Admin Catalogue</p><h1 class="text-3xl font-black tracking-tight text-neutral-900">ClintonProduct Cloud</h1></div>
        </div>
        <p class="text-sm text-neutral-500 mt-3 max-w-2xl">The shared product identity layer for every merchant, branch and inventory node.</p>
      </div>
      <div class="flex flex-wrap justify-end gap-2"><button onclick={importAllLoyaltyHub} disabled={importing} class="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><RefreshCw size={15} class={importing ? 'animate-spin' : ''} /> {importing ? 'Importing…' : 'Import all LoyaltyHub'}</button><button onclick={enrichFromBarcodeNest} disabled={enriching} class="px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Sparkles size={15} class={enriching ? 'animate-pulse' : ''} /> {enriching ? 'Enriching…' : 'Enrich from BarcodeNest'}</button><button onclick={loadProducts} class="px-4 py-3 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><RefreshCw size={15} class={loading ? 'animate-spin' : ''} /> Sync inventory</button></div>
    </div>

    {#if enrichmentMessage}<div class="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">{enrichmentMessage}</div>{/if}
    {#if importMessage}<div class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{importMessage}</div>{/if}

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white border border-neutral-200 rounded-2xl p-5"><p class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Products indexed</p><p class="text-3xl font-black mt-2">{products.length}</p></div>
      <div class="bg-white border border-neutral-200 rounded-2xl p-5"><p class="text-[10px] uppercase tracking-widest font-black text-neutral-400">With images</p><p class="text-3xl font-black mt-2">{products.filter((p) => p.imageUrl).length}</p></div>
      <div class="bg-white border border-neutral-200 rounded-2xl p-5"><p class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Search scope</p><p class="text-3xl font-black mt-2">All merchants</p></div>
    </div>

    <div class="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
      <div class="p-5 border-b border-neutral-100 flex gap-3">
        <div class="relative flex-1"><Search size={17} class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" /><input bind:value={searchQuery} onkeydown={handleSearchKeydown} placeholder="Search name, brand, barcode or SKU..." class="w-full pl-11 pr-4 py-3.5 rounded-xl bg-neutral-50 border border-neutral-200 outline-none text-sm font-semibold focus:ring-4 focus:ring-indigo-50" /></div>
        <button onclick={searchProducts} class="px-5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700">Search</button>
      </div>
      {#if loading}
        <div class="py-20 text-center text-sm text-neutral-400">Syncing the product cloud…</div>
      {:else if filteredProducts.length === 0}
        <div class="py-20 text-center"><Package size={38} class="mx-auto text-neutral-300 mb-3" /><p class="text-sm font-bold text-neutral-400">No products found</p></div>
      {:else}
        <div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400"><th class="px-5 py-4">Product</th><th class="px-5 py-4">Price</th><th class="px-5 py-4">Barcode</th><th class="px-5 py-4">Category</th><th class="px-5 py-4">Merchants</th><th class="px-5 py-4">Updated</th></tr></thead><tbody>
          {#each paginatedProducts as product (product.id)}
            <tr class="border-t border-neutral-100 hover:bg-indigo-50/30 cursor-pointer" onclick={() => selectedProduct = product} onkeydown={(event) => event.key === 'Enter' && (selectedProduct = product)} role="button" tabindex="0"><td class="px-5 py-4"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center">{#if product.imageUrl}<img src={product.imageUrl} alt={product.name} class="w-full h-full object-cover" />{:else}<ImageIcon size={17} class="text-neutral-300" />{/if}</div><div><p class="font-black text-sm text-neutral-900">{product.name}</p><p class="text-[10px] text-neutral-400">{product.brand || product.source || 'Clinton POS'}</p></div></div></td><td class="px-5 py-4 font-bold text-sm text-indigo-700">{formatPrice(product)}</td><td class="px-5 py-4 font-mono text-xs text-neutral-600">{product.barcode || '—'}</td><td class="px-5 py-4"><span class="px-2.5 py-1 rounded-lg bg-neutral-100 text-[10px] font-black uppercase text-neutral-500">{product.category || 'General'}</span></td><td class="px-5 py-4 text-xs font-bold text-neutral-500">{product.merchantIds?.length || 0}</td><td class="px-5 py-4 text-[10px] text-neutral-400">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-ZA') : '—'}</td></tr>
          {/each}
        </tbody></table></div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
          <p class="text-xs font-semibold text-neutral-500">Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products</p>
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Previous page" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} class="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /> Previous</button>
            <span class="min-w-20 text-center text-xs font-black text-neutral-600">Page {currentPage} of {totalPages}</span>
            <button type="button" aria-label="Next page" onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} class="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={15} /></button>
          </div>
        </div>
      {/if}
    </div>

    {#if selectedProduct}
      <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onclick={() => selectedProduct = null} onkeydown={(event) => event.key === 'Escape' && (selectedProduct = null)}>
        <div class="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="product-details-title" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
          <div class="p-6 border-b border-neutral-100 flex items-start justify-between gap-4">
            <div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Product details</p><h2 id="product-details-title" class="text-2xl font-black text-neutral-900 mt-1">{selectedProduct.name}</h2></div>
            <button class="text-neutral-400 hover:text-neutral-900 text-2xl leading-none" aria-label="Close product details" onclick={() => selectedProduct = null}>×</button>
          </div>
          <div class="p-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6">
            <div class="h-40 rounded-2xl bg-neutral-100 overflow-hidden flex items-center justify-center">{#if selectedProduct.imageUrl}<img src={selectedProduct.imageUrl} alt={selectedProduct.name} class="w-full h-full object-cover" />{:else}<ImageIcon size={32} class="text-neutral-300" />{/if}</div>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Price</dt><dd class="font-bold text-indigo-700 mt-1">{formatPrice(selectedProduct)}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Barcode</dt><dd class="font-mono font-bold text-neutral-900 mt-1">{selectedProduct.barcode || '—'}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">SKU</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.sku || '—'}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Brand</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.brand || '—'}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Category</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.category || 'General'}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Unit</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.unit || 'Unit'}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Merchants</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.merchantIds?.length || 0}</dd></div>
              <div class="col-span-2"><dt class="text-[10px] uppercase tracking-widest font-black text-neutral-400">Source</dt><dd class="font-bold text-neutral-900 mt-1">{selectedProduct.source || 'Clinton POS inventory'}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
