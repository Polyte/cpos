<script lang="ts">
  import { Database, RefreshCw, Search, Package, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-svelte';
  import { api } from '../api';

  let { role }: { role: string } = $props();
  let products = $state<any[]>([]);
  let productCount = $state(0);
  let searchQuery = $state('');
  let categoryFilter = $state('all');
  let sourceFilter = $state('all');
  let imageFilter = $state<'all' | 'with' | 'without'>('all');
  let merchantFilter = $state<'all' | 'linked' | 'unlinked'>('all');
  let priceFilter = $state<'all' | 'priced' | 'missing'>('all');
  let loading = $state(true);
  let enriching = $state(false);
  let enrichmentMessage = $state('');
  let importing = $state(false);
  let importMessage = $state('');
  let importProgress = $state(0);
  let importBatch = $state(0);
  let importTotalRows = $state<number | null>(null);
  let importProcessedRows = $state(0);
  let importSummary = $state<any>({ status: 'never', sourceRows: null, processedRows: 0, completedAt: null });
  let exporting = $state(false);
  let exportProgress = $state(0);
  let exportMessage = $state('');
  let selectedProduct = $state<any | null>(null);
  let currentPage = $state(1);
  let pageRequestId = 0;
  const pageSize = 100;
  const importRefreshInterval = 5;

  let filteredProducts = $derived(products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [product.name, product.brand, product.barcode, product.sku]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const matchesCategory = categoryFilter === 'all' || (product.category || 'General') === categoryFilter;
    const matchesSource = sourceFilter === 'all' || (product.source || 'Clinton POS') === sourceFilter;
    const hasImage = Boolean(product.imageUrl);
    const matchesImage = imageFilter === 'all' || (imageFilter === 'with' ? hasImage : !hasImage);
    const hasMerchants = Array.isArray(product.merchantIds) && product.merchantIds.length > 0;
    const matchesMerchants = merchantFilter === 'all' || (merchantFilter === 'linked' ? hasMerchants : !hasMerchants);
    const hasPrice = productPrice(product) !== null && productPrice(product) !== undefined && productPrice(product) !== '';
    const matchesPrice = priceFilter === 'all' || (priceFilter === 'priced' ? hasPrice : !hasPrice);
    return matchesSearch && matchesCategory && matchesSource && matchesImage && matchesMerchants && matchesPrice;
  }));
  let productCategories = $derived([...new Set(products.map((product) => product.category || 'General'))].sort());
  let productSources = $derived([...new Set(products.map((product) => product.source || 'Clinton POS'))].sort());
  let totalPages = $derived(Math.max(1, Math.ceil(productCount / pageSize)));
  // Pagination is handled by the Product Cloud endpoint. The browser should
  // display the already-fetched page without applying a second page offset.
  let paginatedProducts = $derived(filteredProducts);

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  async function refreshProductsFromDatabase(page = currentPage) {
    const requestId = ++pageRequestId;
    const result = await api.getProductCloudPage(page, pageSize, searchQuery.trim());
    if (requestId !== pageRequestId) return;
    const pageProducts = Array.isArray(result?.products) ? result.products : [];
    const seen = new Set<string>();
    products = pageProducts.filter((product) => {
      const key = String(product.barcode || product.sku || product.id || '').replace(/[\s-]/g, '').toUpperCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    productCount = Number(result?.total || 0);
  }

  async function refreshImportSummary() {
    importSummary = await api.getProductCloudImportStatus();
  }

  async function loadProducts(resetPage = true) {
    loading = true;
    try {
      const page = resetPage ? 1 : currentPage;
      if (resetPage) currentPage = page;
      await refreshProductsFromDatabase(page);
    } finally {
      loading = false;
    }
  }

  async function searchProducts() {
    await loadProducts();
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

  function csvCell(value: unknown) {
    if (value === null || value === undefined) return '""';
    const raw = typeof value === 'object' ? (JSON.stringify(value) ?? '') : String(value);
    const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  async function exportAllProductsCsv() {
    if (exporting || importing) return;
    exporting = true;
    exportProgress = 0;
    exportMessage = 'Preparing full catalogue export…';

    const batchSize = 2000;
    const columns = [
      'id', 'barcode', 'canonical_gtin', 'sku', 'name', 'brand', 'description', 'category',
      'price', 'currency', 'unit', 'quantity', 'image_url', 'product_url', 'source',
      'merchant_ids', 'ingredients', 'allergens', 'nutrition', 'countries', 'barcodenest', 'loyaltyhub_retailer',
      'loyaltyhub_retailer_sku', 'loyaltyhub_price', 'loyaltyhub_currency',
      'loyaltyhub_unit_size', 'loyaltyhub_category', 'loyaltyhub_product_url',
      'loyaltyhub_in_stock', 'created_at', 'updated_at',
    ];
    const csvParts = ['\uFEFF' + columns.map(csvCell).join(',') + '\r\n'];

    try {
      const firstPage = await api.getProductCloudPage(1, batchSize);
      const total = Number(firstPage?.total);
      if (!Number.isFinite(total) || total < 0) throw new Error('Could not read the Product Cloud total.');
      if (total === 0) throw new Error('There are no products to export.');

      const pageCount = Math.ceil(total / batchSize);
      for (let page = 1; page <= pageCount; page += 1) {
        const result = page === 1 ? firstPage : await api.getProductCloudPage(page, batchSize);
        const batch = Array.isArray(result?.products) ? result.products : [];
        const expectedRows = Math.min(batchSize, total - (page - 1) * batchSize);
        if (Number(result?.total) !== total || batch.length !== expectedRows) {
          throw new Error(`Catalogue changed or a page could not be loaded (page ${page} of ${pageCount}). No CSV was downloaded.`);
        }

        const lines = batch.map((product: any) => {
          const loyaltyhub = product.loyaltyhub || {};
          const values = [
            product.id, product.barcode, product.canonicalGtin, product.sku, product.name,
            product.brand, product.description, product.category, product.price,
            product.currency, product.unit, product.quantity, product.imageUrl,
            product.productUrl, product.source,
            Array.isArray(product.merchantIds) ? product.merchantIds.join(' | ') : product.merchantIds,
            product.ingredients, product.allergens, product.nutrition, product.countries,
            product.barcodenest,
            loyaltyhub.retailer, loyaltyhub.retailerSku, loyaltyhub.price,
            loyaltyhub.currency, loyaltyhub.unitSize, loyaltyhub.category,
            loyaltyhub.productUrl, loyaltyhub.inStock, product.createdAt, product.updatedAt,
          ];
          return values.map(csvCell).join(',');
        });
        csvParts.push(lines.join('\r\n') + '\r\n');
        exportProgress = Math.round((page / pageCount) * 100);
        exportMessage = `Preparing CSV · ${Math.min(page * batchSize, total).toLocaleString()} of ${total.toLocaleString()} products`;
      }

      const blob = new Blob(csvParts, { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `product-cloud-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportMessage = `Export ready · ${total.toLocaleString()} products included.`;
    } catch (error: any) {
      exportProgress = 0;
      exportMessage = error?.message || 'Product Cloud export failed. Please try again.';
    } finally {
      exporting = false;
    }
  }

  async function importAllLoyaltyHub() {
    if (!['Admin', 'StockController'].includes(role)) {
      importMessage = 'Admin or Stock Controller access is required to import products.';
      return;
    }
    importing = true;
    importMessage = 'Importing LoyaltyHub catalogue…';
    importProgress = 4;
    importBatch = 0;
    let cursor: string | null = null;
    let batchSize = 500;
    const maxRowsPerImport = 5000;
    let runProcessedRows = 0;
    let total = 0;
    let pages = 0;
    let hasMore = true;
    try {
      await refreshImportSummary();
      const resumeCursor = importSummary.status === 'running' && typeof importSummary.nextCursor === 'string'
        ? importSummary.nextCursor
        : null;
      cursor = resumeCursor;
      importProcessedRows = resumeCursor ? Number(importSummary.processedRows || 0) : 0;
      importTotalRows = resumeCursor && Number(importSummary.sourceRows) > 0 ? Number(importSummary.sourceRows) : null;
      while (pages < 1000 && hasMore && runProcessedRows < maxRowsPerImport) {
        const requestLimit = Math.min(batchSize, maxRowsPerImport - runProcessedRows);
        const result = await api.importLoyaltyHubCatalog(cursor, requestLimit);
        if (!result.success) throw new Error(result.error || 'Import failed');
        total += Number(result.imported || 0);
        const suggestedBatchSize = Number(result.batchLimit);
        if (Number.isFinite(suggestedBatchSize) && suggestedBatchSize >= 100 && suggestedBatchSize < batchSize) {
          batchSize = suggestedBatchSize;
        }
        if (Number.isFinite(Number(result.totalRows)) && Number(result.totalRows) > 0) {
          importTotalRows = Number(result.totalRows);
        }
        pages += 1;
        importBatch = pages;
        const discovered = Number(result.discovered || 0);
        runProcessedRows += discovered;
        importProcessedRows = Number(result.processedRows || (importProcessedRows + discovered));
        importProgress = importTotalRows
          ? Math.min(99, Math.round(importProcessedRows / importTotalRows * 100))
          : Math.min(99, Math.round(runProcessedRows / maxRowsPerImport * 100));
        // Avoid reloading the product page after every batch. Each API call has
        // already committed its batch; refresh periodically and once at the end.
        if (pages % importRefreshInterval === 0) {
          await refreshProductsFromDatabase();
        }
        importMessage = `Imported ${total.toLocaleString()} products…`;
        hasMore = Boolean(result.hasMore && discovered > 0 && result.nextCursor);
        if (!hasMore) break;
        cursor = String(result.nextCursor);
      }
      if (hasMore && runProcessedRows < maxRowsPerImport) {
        throw new Error(`Import safeguard reached at ${importProcessedRows.toLocaleString()} rows. Run the import again to continue.`);
      }
      importProgress = 100;
      importMessage = hasMore
        ? `This import processed ${runProcessedRows.toLocaleString()} price rows (${importProcessedRows.toLocaleString()} total). Select Continue import to fetch the next batch.`
        : `LoyaltyHub import complete: ${importProcessedRows.toLocaleString()} price rows processed; ${total.toLocaleString()} catalogue records upserted.`;
      await refreshImportSummary();
      await loadProducts();
    } catch (error: any) {
      importMessage = error?.message || 'LoyaltyHub import failed. Please try again.';
    } finally {
      importing = false;
      if (importProgress < 100) importProgress = 0;
    }
  }

  $effect(() => {
    if (role !== 'Admin') return;
    loadProducts();
    refreshImportSummary();
    const refreshTimer = setInterval(() => {
      if (!searchQuery.trim() && !importing) loadProducts(false);
    }, 15000);
    return () => clearInterval(refreshTimer);
  });

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') searchProducts();
  }

  function resetProductPage() {
    currentPage = 1;
  }

  function goToPage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    void loadProducts(false);
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
  <div class="product-cloud-page p-6 lg:p-8 space-y-7 animate-in fade-in duration-500 max-w-[1600px] mx-auto overflow-y-auto h-full">
    <div class="product-cloud-hero relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-7 lg:p-9 text-white shadow-xl shadow-indigo-950/10">
      <div class="absolute -right-12 -top-20 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl"></div>
      <div class="absolute right-36 -bottom-32 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"></div>
      <div class="relative flex flex-col xl:flex-row xl:items-end justify-between gap-7">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-white/10 ring-1 ring-white/15 text-white flex items-center justify-center"><Database size={22} /></div>
          <div><p class="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Admin catalogue</p><h1 class="text-3xl lg:text-4xl font-black tracking-tight text-white">ClintonProduct Cloud</h1></div>
        </div>
        <p class="text-sm text-indigo-100/75 mt-4 max-w-2xl">A unified catalogue for products, pricing and inventory across every merchant and branch.</p>
        <div class="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-100 ring-1 ring-white/10"><span class="h-2 w-2 rounded-full bg-emerald-400"></span>Live catalogue · {productCount.toLocaleString()} indexed products</div>
      </div>
      <div class="relative flex flex-wrap xl:justify-end gap-2">{#if ['Admin', 'StockController'].includes(role)}<button onclick={importAllLoyaltyHub} disabled={importing || exporting} class="px-4 py-3 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-950/15"><RefreshCw size={15} class={importing ? 'animate-spin' : ''} /> {importing ? 'Importing…' : importSummary.status === 'running' && importSummary.nextCursor ? 'Continue import' : 'Import LoyaltyHub · 5,000 max'}</button><button onclick={enrichFromBarcodeNest} disabled={enriching || exporting} class="px-4 py-3 rounded-xl bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Sparkles size={15} class={enriching ? 'animate-pulse' : ''} /> {enriching ? 'Enriching…' : 'Enrich catalogue'}</button>{/if}<button onclick={exportAllProductsCsv} disabled={exporting || importing} class="px-4 py-3 rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-200 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-950/15"><Download size={15} class={exporting ? 'animate-bounce' : ''} /> {exporting ? `Exporting ${exportProgress}%` : 'Export all CSV'}</button><button onclick={loadProducts} disabled={exporting} class="px-4 py-3 rounded-xl bg-white text-slate-800 hover:bg-indigo-50 disabled:opacity-60 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><RefreshCw size={15} class={loading ? 'animate-spin' : ''} /> Sync</button></div>
      </div>
    </div>

    {#if exportMessage}<div class={`rounded-xl border px-4 py-3 text-sm font-semibold ${exporting || exportMessage.startsWith('Export ready') ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`} aria-live="polite">{exportMessage}{#if exporting}<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100"><div class="h-full rounded-full bg-amber-500 transition-all" style={`width:${exportProgress}%`}></div></div>{/if}</div>{/if}
    {#if enrichmentMessage}<div class="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">{enrichmentMessage}</div>{/if}
    {#if importMessage}<div class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{importMessage}</div>{/if}
    {#if importing}
      <div class="product-cloud-surface rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm" aria-live="polite">
        <div class="flex items-center justify-between gap-4 mb-3"><div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Fetching products from LoyaltyHub</p><p class="text-xs font-semibold text-neutral-500 mt-1">Processing batch {importBatch || 1} · {importMessage}</p></div><span class="text-sm font-black text-emerald-700">{importProgress}%</span></div>
        <div class="h-2.5 rounded-full bg-emerald-100 overflow-hidden"><div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style={`width: ${importProgress}%`}></div></div>
        <p class="text-[10px] font-bold text-neutral-400 mt-2">This may take a few moments while the catalogue is fetched and indexed.</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="product-cloud-surface group bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div class="flex items-center justify-between"><p class="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">Indexed products</p><span class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Database size={17} /></span></div><p class="text-3xl font-black tracking-tight text-slate-900 mt-4">{productCount.toLocaleString()}</p><p class="text-xs text-slate-500 mt-1">Unique records across the catalogue</p></div>
      <div class="product-cloud-surface group bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div class="flex items-center justify-between"><p class="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">LoyaltyHub rows · est.</p><span class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><RefreshCw size={17} /></span></div><p class="text-3xl font-black tracking-tight text-slate-900 mt-4">{(importing && importTotalRows ? importTotalRows : importSummary.sourceRows) ? `~${Number(importing && importTotalRows ? importTotalRows : importSummary.sourceRows).toLocaleString()}` : '—'}</p><p class="text-xs text-slate-500 mt-1">Estimated retailer price rows in the source</p></div>
      <div class="product-cloud-surface group bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div class="flex items-center justify-between"><p class="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">Rows processed</p><span class="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center"><Package size={17} /></span></div><p class="text-3xl font-black tracking-tight text-slate-900 mt-4">{(importing ? importProcessedRows : Number(importSummary.processedRows || 0)).toLocaleString()}</p><p class="text-xs text-slate-500 mt-1">{importSummary.status === 'complete' ? 'In the last completed import' : importing ? 'In this import' : 'From the last import'}</p></div>
      <div class="product-cloud-surface group bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"><div class="flex items-center justify-between"><p class="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">Images on this page</p><span class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><ImageIcon size={17} /></span></div><p class="text-3xl font-black tracking-tight text-slate-900 mt-4">{products.filter((p) => p.imageUrl).length}<span class="text-sm font-bold text-slate-400"> / {products.length}</span></p><p class="text-xs text-slate-500 mt-1">Page {currentPage} · {productCount.toLocaleString()} total records</p></div>
    </div>

    <div class="product-cloud-surface bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm shadow-slate-900/[0.03]">
      <div class="p-5 lg:p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div class="mr-auto"><p class="text-sm font-black text-slate-900">Product catalogue</p><p class="mt-1 text-xs text-slate-500">Search and review product identity, pricing and merchant links.</p></div>
        <div class="relative flex-1"><Search size={17} class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" /><input bind:value={searchQuery} oninput={resetProductPage} onkeydown={handleSearchKeydown} placeholder="Search name, brand, barcode or SKU..." class="w-full pl-11 pr-4 py-3.5 rounded-xl bg-neutral-50 border border-neutral-200 outline-none text-sm font-semibold focus:ring-4 focus:ring-indigo-50" /></div>
        <button onclick={searchProducts} class="px-5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700">Search</button>
      </div>
      <div class="px-5 pb-5 flex flex-wrap items-center gap-3 border-b border-neutral-100">
        <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 mr-1"><Filter size={14} /> Filters</div>
        <label><span class="sr-only">Filter by category</span><select bind:value={categoryFilter} onchange={resetProductPage} class="px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 outline-none focus:ring-4 focus:ring-indigo-50"><option value="all">All categories</option>{#each productCategories as category}<option value={category}>{category}</option>{/each}</select></label>
        <label><span class="sr-only">Filter by source</span><select bind:value={sourceFilter} onchange={resetProductPage} class="px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 outline-none focus:ring-4 focus:ring-indigo-50"><option value="all">All sources</option>{#each productSources as source}<option value={source}>{source}</option>{/each}</select></label>
        <label><span class="sr-only">Filter by images</span><select bind:value={imageFilter} onchange={resetProductPage} class="px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 outline-none focus:ring-4 focus:ring-indigo-50"><option value="all">Any image status</option><option value="with">With images</option><option value="without">Missing images</option></select></label>
        <label><span class="sr-only">Filter by merchant assignment</span><select bind:value={merchantFilter} onchange={resetProductPage} class="px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 outline-none focus:ring-4 focus:ring-indigo-50"><option value="all">Any merchant assignment</option><option value="linked">Linked to merchants</option><option value="unlinked">Unassigned</option></select></label>
        <label><span class="sr-only">Filter by price</span><select bind:value={priceFilter} onchange={resetProductPage} class="px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-neutral-600 outline-none focus:ring-4 focus:ring-indigo-50"><option value="all">Any price status</option><option value="priced">With price</option><option value="missing">Missing price</option></select></label>
        <span class="ml-auto text-[10px] font-black uppercase tracking-widest text-neutral-400">{filteredProducts.length} matching products</span>
      </div>
      {#if loading}
        <div class="py-20 text-center text-sm text-neutral-400">Syncing the product cloud…</div>
      {:else if filteredProducts.length === 0}
        <div class="py-20 text-center"><Package size={38} class="mx-auto text-neutral-300 mb-3" /><p class="text-sm font-bold text-neutral-400">No products found</p></div>
      {:else}
        <div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400"><th class="px-5 py-4 w-16">#</th><th class="px-5 py-4">Product</th><th class="px-5 py-4">Price</th><th class="px-5 py-4">Barcode</th><th class="px-5 py-4">Category</th><th class="px-5 py-4">Merchants</th><th class="px-5 py-4">Updated</th></tr></thead><tbody>
          {#each paginatedProducts as product, index (product.id)}
            <tr class="border-t border-neutral-100 hover:bg-indigo-50/30 cursor-pointer" onclick={() => selectedProduct = product} onkeydown={(event) => event.key === 'Enter' && (selectedProduct = product)} role="button" tabindex="0"><td class="px-5 py-4 text-xs font-black text-neutral-400">{(currentPage - 1) * pageSize + index + 1}</td><td class="px-5 py-4"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center">{#if product.imageUrl}<img src={product.imageUrl} alt={product.name} class="w-full h-full object-cover" />{:else}<ImageIcon size={17} class="text-neutral-300" />{/if}</div><div><p class="font-black text-sm text-neutral-900">{product.name}</p><p class="text-[10px] text-neutral-400">{product.brand || product.source || 'Clinton POS'}</p></div></div></td><td class="px-5 py-4 font-bold text-sm text-indigo-700">{formatPrice(product)}</td><td class="px-5 py-4 font-mono text-xs text-neutral-600">{product.barcode || '—'}</td><td class="px-5 py-4"><span class="px-2.5 py-1 rounded-lg bg-neutral-100 text-[10px] font-black uppercase text-neutral-500">{product.category || 'General'}</span></td><td class="px-5 py-4 text-xs font-bold text-neutral-500">{product.merchantIds?.length || 0}</td><td class="px-5 py-4 text-[10px] text-neutral-400">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-ZA') : '—'}</td></tr>
          {/each}
        </tbody></table></div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
          <p class="text-xs font-semibold text-neutral-500">Showing records {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, productCount)} of {productCount.toLocaleString()} products</p>
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Previous page" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} class="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /> Previous</button>
            <label class="flex items-center gap-2 text-xs font-black text-neutral-600"><span>Page</span><input type="number" min="1" max={totalPages} value={currentPage} aria-label="Enter page number" onchange={(event) => goToPage(Number((event.currentTarget as HTMLInputElement).value))} class="w-16 rounded-lg border border-neutral-200 px-2 py-2 text-center text-xs font-black outline-none focus:ring-4 focus:ring-indigo-50" /><span>of {totalPages.toLocaleString()}</span></label>
            <button type="button" aria-label="Next page" onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} class="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={15} /></button>
          </div>
        </div>
      {/if}
    </div>

    {#if selectedProduct}
      <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onclick={() => selectedProduct = null} onkeydown={(event) => event.key === 'Escape' && (selectedProduct = null)}>
        <div class="product-cloud-surface w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="product-details-title" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
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

<style>
  :global(.dark) .product-cloud-page .product-cloud-surface {
    background-color: #19232d;
    border-color: #34424e;
    color: #e9eef3;
  }

  :global(.dark) .product-cloud-page [class~="text-slate-900"],
  :global(.dark) .product-cloud-page [class~="text-neutral-900"] {
    color: #edf2f6;
  }

  :global(.dark) .product-cloud-page [class~="text-slate-500"],
  :global(.dark) .product-cloud-page [class~="text-neutral-500"],
  :global(.dark) .product-cloud-page [class~="text-neutral-600"] {
    color: #aab7c3;
  }

  :global(.dark) .product-cloud-page input,
  :global(.dark) .product-cloud-page select {
    background-color: #111820;
    border-color: #34424e;
    color: #e9eef3;
  }

  :global(.dark) .product-cloud-page input::placeholder {
    color: #82909d;
  }

  :global(.dark) .product-cloud-page table thead tr {
    background-color: #202c37;
  }

  :global(.dark) .product-cloud-page table tbody tr {
    border-color: #2b3945;
  }

  :global(.dark) .product-cloud-page table tbody tr:hover {
    background-color: #202c37;
  }
</style>
