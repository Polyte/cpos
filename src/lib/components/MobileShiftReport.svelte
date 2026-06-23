<script lang="ts">
  import {
    X, Clock, CreditCard, Banknote, ShoppingCart, TrendingUp, BarChart3,
    AlertTriangle, Tag, Zap, Hash, ArrowUpRight,
    ArrowDownLeft, Loader2, ChevronLeft, Share2, Printer
  } from 'lucide-svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';

  interface HourlyEntry {
    hour: string;
    count: number;
    total: number;
  }

  interface ShiftReportData {
    shift: any;
    transactions: number;
    totalSales: number;
    totalItems: number;
    cardSales: number;
    cashSales: number;
    totalChange: number;
    promoSavings: number;
    loyaltyRedeemed: number;
    hourlyBreakdown: Record<string, { count: number; total: number }>;
    transactionList: any[];
  }

  let {
    shiftId,
    onClose
  }: {
    shiftId: string;
    onClose: () => void;
  } = $props();

  let data = $state<ShiftReportData | null>(null);
  let loading = $state(true);
  let activeTab = $state<'summary' | 'hourly' | 'transactions'>('summary');

  function formatDuration(start: string, end?: string) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = e - s;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  }

  let hourlyData = $derived.by<HourlyEntry[]>(() => {
    if (!data?.hourlyBreakdown) return [];
    return Object.entries(data.hourlyBreakdown)
      .map(([hour, vals]) => ({ hour, ...vals }))
      .sort((a: any, b: any) => a.hour.localeCompare(b.hour));
  });

  let maxHourlyTotal = $derived.by(() => {
    return hourlyData.length > 0 ? Math.max(...hourlyData.map(h => h.total)) : 1;
  });

  let cardPct = $derived.by(() => data && data.totalSales > 0 ? Math.round((data.cardSales / data.totalSales) * 100) : 0);
  let cashPct = $derived.by(() => data && data.totalSales > 0 ? Math.round((data.cashSales / data.totalSales) * 100) : 0);
  let avgBasket = $derived.by(() => data && data.transactions > 0 ? (data.totalSales / data.transactions) : 0);

  $effect(() => {
    loadReport();
  });

  async function loadReport() {
    try {
      loading = true;
      const cleanId = shiftId.startsWith('shift:') ? shiftId.replace('shift:', '') : shiftId;
      const result = await api.getShiftReport(cleanId);
      if (result && !result.error) data = result;
    } catch (e) {
      console.error('Failed to load shift report:', e);
    } finally {
      loading = false;
    }
  }

  function handleShare() {
    if (!data) return;
    const dur = formatDuration(data.shift.startTime, data.shift.endTime);
    const text = [
      `ROXTON SHIFT REPORT`,
      `Operator: ${data.shift.userName || 'Unknown'}`,
      `Date: ${new Date(data.shift.startTime).toLocaleDateString()}`,
      `Duration: ${dur}`,
      ``,
      `Total Sales: R ${data.totalSales.toFixed(2)}`,
      `Transactions: ${data.transactions}`,
      `Items Sold: ${data.totalItems}`,
      `Card: R ${data.cardSales.toFixed(2)}`,
      `Cash: R ${data.cashSales.toFixed(2)}`,
      data.promoSavings > 0 ? `Promo Savings: R ${data.promoSavings.toFixed(2)}` : '',
      ``,
      `Ref: ${shiftId}`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      navigator.share({ title: 'Shift Report', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Report copied to clipboard');
    }
  }

  function handlePrint() {
    if (!data) return;
    const dur = formatDuration(data.shift.startTime, data.shift.endTime);
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      toast.error('Print popup blocked');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>ShiftReport_${shiftId}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              margin: 0; 
              padding: 10mm 5mm; 
              font-family: 'Courier New', monospace; 
              background: white; 
              color: black; 
              font-size: 10pt; 
            }
            .text-center { text-align: center; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .border-b { border-bottom: 1px dashed #000; margin: 5px 0; }
            .font-black { font-weight: 900; }
            h2 { font-size: 14pt; margin-bottom: 5px; }
            .stat { margin: 5px 0; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2>SHIFT REPORT</h2>
            <p>${new Date().toLocaleString()}</p>
            <div class="border-b"></div>
          </div>
          <div class="stat"><span>Operator:</span><span>${data.shift.userName}</span></div>
          <div class="stat"><span>Duration:</span><span>${dur}</span></div>
          <div class="border-b"></div>
          <div class="stat font-black"><span>TOTAL SALES:</span><span>R ${data.totalSales.toFixed(2)}</span></div>
          <div class="stat"><span>Transactions:</span><span>${data.transactions}</span></div>
          <div class="stat"><span>Card:</span><span>R ${data.cardSales.toFixed(2)}</span></div>
          <div class="stat"><span>Cash:</span><span>R ${data.cashSales.toFixed(2)}</span></div>
          <div class="border-b"></div>
          <div class="text-center" style="margin-top: 20px;">
            <p style="font-size: 8pt;">Ref: ${shiftId}</p>
            <p style="font-size: 8pt;">Roxton OS v4.2</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
</script>

{#if loading}
  <div class="fixed inset-0 z-[700] bg-neutral-950 flex flex-col items-center justify-center safe-area-inset">
    <Loader2 class="w-12 h-12 text-amber-400 animate-spin mb-4" />
    <p class="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-600">Compiling Shift Data...</p>
  </div>
{:else if !data}
  <div class="fixed inset-0 z-[700] bg-neutral-950 flex flex-col items-center justify-center p-6 safe-area-inset">
    <div transition:scale={{start: 0.9, duration: 200}} class="text-center">
      <AlertTriangle class="w-14 h-14 text-amber-400 mx-auto mb-4" />
      <h3 class="text-sm font-black text-white uppercase tracking-widest mb-2">No Report Data</h3>
      <p class="text-xs text-neutral-500 mb-6">No transactions found for this shift period.</p>
      <button onclick={onClose} class="px-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform">Close</button>
    </div>
  </div>
{:else}
  <div class="fixed inset-0 z-[700] bg-neutral-950 flex flex-col safe-area-inset">
    <!-- Header -->
    <div class="px-4 pt-4 pb-3 flex items-center justify-between border-b border-neutral-800 shrink-0">
      <button onclick={onClose} class="flex items-center gap-1 text-neutral-400 active:text-white">
        <ChevronLeft class="w-5 h-5" />
        <span class="text-xs font-black uppercase tracking-widest">Back</span>
      </button>
      <span class="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Shift Report</span>
      <div class="flex items-center">
        <button onclick={handlePrint} class="p-2 text-neutral-500 active:text-amber-400">
          <Printer class="w-4 h-4" />
        </button>
        <button onclick={handleShare} class="p-2 text-neutral-500 active:text-amber-400">
          <Share2 class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Operator Info Card -->
    <div class="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
          <BarChart3 class="w-5 h-5 text-amber-400" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-black text-white truncate">{data.shift.userName || 'Operator'}</p>
          <p class="text-[9px] font-bold text-neutral-500">{new Date(data.shift.startTime).toLocaleDateString()}</p>
        </div>
        <div class="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider {data.shift.endTime ? 'bg-neutral-800 text-neutral-400' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
          {data.shift.endTime ? 'Closed' : 'Active'}
        </div>
      </div>
      <div class="flex gap-4 text-[9px]">
        <div class="flex items-center gap-1.5">
          <ArrowUpRight class="w-3 h-3 text-emerald-400" />
          <span class="text-neutral-500">In</span>
          <span class="font-black text-white">{new Date(data.shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <ArrowDownLeft class="w-3 h-3 text-rose-400" />
          <span class="text-neutral-500">Out</span>
          <span class="font-black text-white">
            {data.shift.endTime ? new Date(data.shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <Clock class="w-3 h-3 text-amber-400" />
          <span class="font-black text-amber-400">{formatDuration(data.shift.startTime, data.shift.endTime)}</span>
        </div>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="px-4 py-2 flex gap-2 border-b border-neutral-800 shrink-0">
      {#each [
        { id: 'summary' as const, label: 'Summary', icon: TrendingUp },
        { id: 'hourly' as const, label: 'Hourly', icon: BarChart3 },
        { id: 'transactions' as const, label: 'Log', icon: ShoppingCart },
      ] as tab}
        {@const TabIcon = tab.icon}
        <button
          onclick={() => activeTab = tab.id}
          class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 {activeTab === tab.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}"
        >
          <TabIcon class="w-3 h-3" />
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {#key activeTab}
        {#if activeTab === 'summary'}
          <div transition:fly={{x: -10, duration: 200, opacity: 0}} class="space-y-3">
            <!-- Hero KPI -->
            <div class="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-5 text-center">
              <p class="text-[8px] font-black text-amber-500/60 uppercase tracking-[0.3em] mb-1">Total Sales</p>
              <p class="text-4xl font-black text-white tabular-nums">R {data.totalSales.toFixed(2)}</p>
            </div>

            <!-- Mini KPIs -->
            <div class="grid grid-cols-3 gap-2">
              <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
                <ShoppingCart class="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <p class="text-lg font-black text-white tabular-nums">{data.transactions}</p>
                <p class="text-[7px] font-black text-neutral-600 uppercase tracking-wider">Transactions</p>
              </div>
              <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
                <Tag class="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p class="text-lg font-black text-white tabular-nums">{data.totalItems}</p>
                <p class="text-[7px] font-black text-neutral-600 uppercase tracking-wider">Items Sold</p>
              </div>
              <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
                <TrendingUp class="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p class="text-lg font-black text-white tabular-nums">R {avgBasket().toFixed(0)}</p>
                <p class="text-[7px] font-black text-neutral-600 uppercase tracking-wider">Avg Basket</p>
              </div>
            </div>

            <!-- Payment Breakdown -->
            <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <p class="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">Payments</p>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                    <CreditCard class="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p class="text-xs font-black text-white">Card</p>
                    <p class="text-[8px] font-bold text-neutral-500">{cardPct()}%</p>
                  </div>
                </div>
                <span class="text-sm font-black text-white tabular-nums">R {data.cardSales.toFixed(2)}</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Banknote class="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p class="text-xs font-black text-white">Cash</p>
                    <p class="text-[8px] font-bold text-neutral-500">{cashPct()}%</p>
                  </div>
                </div>
                <span class="text-sm font-black text-white tabular-nums">R {data.cashSales.toFixed(2)}</span>
              </div>
              {#if data.totalChange > 0}
                <div class="flex items-center justify-between pl-10">
                  <span class="text-[9px] text-neutral-500">Change Dispensed</span>
                  <span class="text-xs font-bold text-neutral-400 tabular-nums">R {data.totalChange.toFixed(2)}</span>
                </div>
              {/if}
              <!-- Ratio Bar -->
              <div class="h-2 bg-neutral-800 rounded-full overflow-hidden flex">
                {#if data.totalSales > 0}
                  <div class="h-full bg-indigo-500 rounded-l-full transition-all" style="width: {cardPct()}%"></div>
                  <div class="h-full bg-emerald-500 rounded-r-full transition-all" style="width: {cashPct()}%"></div>
                {/if}
              </div>
            </div>

            <!-- Discounts -->
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                <div class="flex items-center gap-1.5 mb-1">
                  <Zap class="w-3 h-3 text-amber-400" />
                  <span class="text-[7px] font-black text-amber-400/60 uppercase tracking-wider">Promo Savings</span>
                </div>
                <p class="text-lg font-black text-amber-400 tabular-nums">R {data.promoSavings.toFixed(2)}</p>
              </div>
              <div class="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                <div class="flex items-center gap-1.5 mb-1">
                  <Tag class="w-3 h-3 text-rose-400" />
                  <span class="text-[7px] font-black text-rose-400/60 uppercase tracking-wider">Loyalty</span>
                </div>
                <p class="text-lg font-black text-rose-400 tabular-nums">R {data.loyaltyRedeemed.toFixed(2)}</p>
              </div>
            </div>
          </div>

        {:else if activeTab === 'hourly'}
          <div transition:fly={{x: -10, duration: 200, opacity: 0}} class="space-y-3">
            <p class="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">Hourly Sales Distribution</p>
            {#if hourlyData.length === 0}
              <div class="flex flex-col items-center justify-center py-16 opacity-30">
                <BarChart3 class="w-10 h-10 text-neutral-600 mb-3" />
                <p class="text-[9px] font-black text-neutral-600 uppercase tracking-widest">No hourly data</p>
              </div>
            {:else}
              {#each hourlyData as h, i}
                <div
                  in:fly={{x: 20, duration: 200, delay: i * 30, opacity: 0}}
                  class="flex items-center gap-3"
                >
                  <span class="text-[10px] font-mono font-black text-neutral-500 w-10 shrink-0 text-right">{h.hour}</span>
                  <div class="flex-1 h-10 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative">
                    <div
                      class="h-full bg-gradient-to-r from-amber-500/30 to-amber-500/10 rounded-xl"
                      style="width: {(h.total / maxHourlyTotal) * 100}%"></div>
                    <div class="absolute inset-0 flex items-center justify-between px-3">
                      <span class="text-[9px] font-black text-neutral-400">{h.count} txn</span>
                      <span class="text-[9px] font-black text-amber-400 tabular-nums">R {h.total.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'transactions'}
          <div transition:fly={{x: -10, duration: 200, opacity: 0}} class="space-y-2">
            <p class="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">
              Transaction Log ({data.transactionList.length})
            </p>
            {#if data.transactionList.length === 0}
              <div class="flex flex-col items-center justify-center py-16 opacity-30">
                <ShoppingCart class="w-10 h-10 text-neutral-600 mb-3" />
                <p class="text-[9px] font-black text-neutral-600 uppercase tracking-widest">No transactions</p>
              </div>
            {:else}
              {#each data.transactionList as tx, i}
                <div
                  in:fly={{y: 10, duration: 200, delay: i * 20, opacity: 0}}
                  class="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3"
                >
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 {tx.method === 'Card' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}">
                    {#if tx.method === 'Card'}
                      <CreditCard class="w-3.5 h-3.5 text-indigo-400" />
                    {:else}
                      <Banknote class="w-3.5 h-3.5 text-emerald-400" />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-black text-white truncate">{(tx.id || '').substring(0, 16)}</span>
                      {#if tx.promoDiscount > 0}
                        <span class="px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[6px] font-black uppercase shrink-0">Promo</span>
                      {/if}
                    </div>
                    <span class="text-[8px] text-neutral-500">
                      {tx.items?.length || 0} items &middot; {tx.method} &middot; {new Date(tx.date || tx.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span class="text-xs font-black text-white tabular-nums shrink-0">R {(tx.amount || 0).toFixed(2)}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      {/key}
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-neutral-800 shrink-0">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <Hash class="w-3 h-3 text-neutral-700" />
          <span class="text-[7px] font-mono text-neutral-700 truncate max-w-[200px]">{shiftId}</span>
        </div>
      </div>
      <button
        onclick={onClose}
        class="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
      >
        Close Report
      </button>
    </div>
  </div>
{/if}
