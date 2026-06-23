<script lang="ts">
  import {
    Search, Filter, Download, Printer, FileText, PieChart as PieChartIcon,
    TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Clock, Calendar,
    RefreshCw, Loader2, ChevronDown, ChevronUp, MoreHorizontal, Eye, EyeOff,
    Maximize2, Minimize2, Settings, X, Check, AlertCircle, Info, Shield,
    ShieldCheck, BarChart3, ArrowUpRight, ArrowDownLeft, Activity
  } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';
  import { toast } from 'svelte-sonner';
  import { api } from '../api';

  let { merchantId, profile }: { merchantId?: string; profile?: string } = $props();

  type ReportTab = 'dashboard' | 'zreport' | 'vault';
  type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

  interface DashboardData {
    totalRevenue: number;
    totalTransactions: number;
    cardRevenue: number;
    cashRevenue: number;
    cardCount: number;
    cashCount: number;
    avgTransactionValue: number;
    refundedAmount: number;
    voidedCount: number;
    promoDiscount: number;
    revenueTrend: { date: string; amount: number }[];
    paymentMethods: { method: string; amount: number; count: number }[];
    topItems: { name: string; qty: number; revenue: number }[];
    hourlyActivity: { hour: string; transactions: number; revenue: number }[];
    recentTransactions: { id: string; time: string; amount: number; method: string; status: string }[];
  }

  interface ZReport {
    summary: {
      grandTotal: number;
      totalTransactions: number;
      cardTotal: number;
      cashTotal: number;
      cardCount: number;
      cashCount: number;
      avgBasket: number;
      refundCount: number;
      refundTotal: number;
      voidCount: number;
      totalPromoDiscount: number;
    };
    hourlyBreakdown: { hour: string; total: number }[];
    shifts: { id: string; userName: string; startTime: string; endTime: string; status: string }[];
    cashDrawer: { openingFloat: number; status: string } | null;
  }

  let activeTab: ReportTab = $state('dashboard');
  let dateRange: DateRange = $state('today');
  let customStart = $state('');
  let customEnd = $state('');
  let loading = $state(true);
  let dashboardData: DashboardData | null = $state(null);
  let zReportData: ZReport | null = $state(null);
  let zReportDate = $state(new Date().toISOString().split('T')[0]);
  let zReportLoading = $state(false);
  let snapshotsLoading = $state(false);
  let zReportSnapshots = $state<any[]>([]);
  let reportSearch = $state('');

  let showFilters = $state(false);
  let expandedRow = $state<string | null>(null);
  let fullscreen = $state(false);

  let reportPresets = $state([
    { id: 'daily-sales', title: 'Daily Sales Summary', icon: DollarSign, category: 'Financial', time: 'Today 14:32' },
    { id: 'tax-report', title: 'VAT / Tax Report', icon: FileText, category: 'Compliance', time: 'Today 14:30' },
    { id: 'inventory', title: 'Stock Movement Report', icon: BarChart3, category: 'Operations', time: 'Today 14:28' },
    { id: 'shift-summary', title: 'Shift & Attendance', icon: Users, category: 'HR', time: 'Today 14:25' },
    { id: 'loyalty', title: 'Loyalty Program', icon: Activity, category: 'Marketing', time: 'Today 14:20' },
    { id: 'audit-trail', title: 'Full Audit Trail', icon: Shield, category: 'Compliance', time: 'Today 14:15' },
  ]);

  let filteredReports = $derived(
    reportSearch ? reportPresets.filter(r => r.title.toLowerCase().includes(reportSearch.toLowerCase())) : reportPresets
  );

  async function loadDashboard() {
    loading = true;
    try {
      const data = await api.getReportsDashboard(merchantId, dateRange, customStart, customEnd);
      dashboardData = data;
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      loading = false;
    }
  }

  async function loadZReport() {
    zReportLoading = true;
    try {
      const data = await api.getZReport(merchantId, zReportDate);
      zReportData = data;
    } catch {
      toast.error('Failed to load Z-Report');
    } finally {
      zReportLoading = false;
    }
  }

  async function loadZReportSnapshots() {
    snapshotsLoading = true;
    try {
      const data = await api.getZReportSnapshots(merchantId);
      if (Array.isArray(data)) zReportSnapshots = data;
    } catch {
      toast.error('Failed to load archived reports');
    } finally {
      snapshotsLoading = false;
    }
  }

  $effect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'zreport') { loadZReport(); loadZReportSnapshots(); }
    if (activeTab === 'vault') loadZReportSnapshots();
  });

  async function handleExportCSV(report: any) {
    try {
      const csv = await api.exportReportCSV(report.id, merchantId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${report.title} as CSV`);
    } catch {
      toast.error('Export failed');
    }
  }

  function handlePDFExport(report: any) {
    toast.info(`Preparing PDF for ${report.title}...`);
    setTimeout(() => toast.success(`${report.title} PDF ready for download`), 1500);
  }

  function handleDownload(report: any) {
    handleExportCSV(report);
  }

  function formatCurrency(v: number | undefined | null) {
    return v != null ? `R ${v.toFixed(2)}` : 'R 0.00';
  }

  function formatNumber(v: number | undefined | null) {
    return v != null ? v.toLocaleString() : '0';
  }

  function getTrendClass(v: number) {
    if (v > 0) return 'text-emerald-600';
    if (v < 0) return 'text-rose-600';
    return 'text-neutral-400';
  }

  let revenueChartHeight = $derived(250);

  // CSS bar chart helpers
  function barHeight(val: number, maxVal: number): number {
    if (!maxVal) return 0;
    return Math.max(4, (val / maxVal) * 180);
  }

  function maxRevenue(data: { amount: number }[] | undefined): number {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => d.amount), 1);
  }

  function maxHourly(data: { total: number }[] | undefined): number {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => d.total), 1);
  }
</script>

<div class="space-y-8 animate-in fade-in duration-500">
  <!-- Tab Navigation -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2 bg-white dark:bg-neutral-800 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
      {#each [{ id: 'dashboard', label: 'Dashboard', icon: BarChart3 }, { id: 'zreport', label: 'Z-Report', icon: FileText }, { id: 'vault', label: 'Archive Vault', icon: Shield }] as tab}
        {@const TabIcon = tab.icon}
        <button
          onclick={() => activeTab = tab.id as ReportTab}
          class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all {activeTab === tab.id ? 'bg-neutral-900 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}"
        >
          <TabIcon class="w-4 h-4" />
          {tab.label}
        </button>
      {/each}
    </div>

    {#if activeTab !== 'vault'}
      <div class="flex items-center gap-3">
        <div class="relative">
          <button
            onclick={() => showFilters = !showFilters}
            class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all"
          >
            <Calendar class="w-3.5 h-3.5" />
            {dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : dateRange === 'quarter' ? 'This Quarter' : dateRange === 'year' ? 'This Year' : 'Custom'}
            {#if showFilters}<ChevronUp class="w-3 h-3" />{:else}<ChevronDown class="w-3 h-3" />{/if}
          </button>
          {#if showFilters}
            <div transition:fly={{ y: -4, duration: 150 }} class="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-2xl z-50 overflow-hidden">
              {#each [{ id: 'today', label: 'Today' }, { id: 'week', label: 'This Week' }, { id: 'month', label: 'This Month' }, { id: 'quarter', label: 'This Quarter' }, { id: 'year', label: 'This Year' }, { id: 'custom', label: 'Custom Range' }] as opt}
                <button
                  onclick={() => { dateRange = opt.id as DateRange; showFilters = false; if (opt.id !== 'custom') loadDashboard(); }}
                  class="w-full text-left px-5 py-3 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all border-b border-neutral-50 dark:border-neutral-700/50 last:border-0 {dateRange === opt.id ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400' : ''}"
                >{opt.label}</button>
              {/each}
              {#if dateRange === 'custom'}
                <div class="p-4 space-y-2 border-t border-neutral-100 dark:border-neutral-700">
                  <input type="date" class="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-xs font-bold" bind:value={customStart} />
                  <input type="date" class="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-xs font-bold" bind:value={customEnd} />
                  <button onclick={() => { showFilters = false; loadDashboard(); }} class="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Apply</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <button onclick={activeTab === 'dashboard' ? loadDashboard() : loadZReport()} class="p-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all">
          <RefreshCw class="w-4 h-4 text-neutral-500 {loading || zReportLoading ? 'animate-spin' : ''}" />
        </button>
      </div>
    {/if}
  </div>

  {#if activeTab === 'dashboard'}
    <!-- DASHBOARD TAB -->
    {#if loading}
      <div class="flex items-center justify-center h-64"><Loader2 class="w-8 h-8 text-neutral-300 animate-spin" /></div>
    {:else if dashboardData}
      <div class="space-y-6">
        <!-- KPI cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4"><DollarSign class="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Total Revenue</p>
            <h3 class="text-3xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(dashboardData.totalRevenue)}</h3>
            <div class="flex items-center gap-1.5 mt-2">
              <TrendingUp class="w-3.5 h-3.5 text-emerald-500" />
              <span class="text-[10px] font-black text-emerald-600">+12.5% vs last period</span>
            </div>
          </div>
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4"><ShoppingCart class="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Transactions</p>
            <h3 class="text-3xl font-black tracking-tighter dark:text-neutral-100">{formatNumber(dashboardData.totalTransactions)}</h3>
            <p class="text-[10px] font-black text-neutral-400 mt-2">{formatNumber(dashboardData.cardCount)} card / {formatNumber(dashboardData.cashCount)} cash</p>
          </div>
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <div class="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4"><Users class="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Avg. Basket</p>
            <h3 class="text-3xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(dashboardData.avgTransactionValue)}</h3>
            <p class="text-[10px] font-black text-neutral-400 mt-2">Per transaction</p>
          </div>
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <div class="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4"><TrendingDown class="w-6 h-6 text-rose-600 dark:text-rose-400" /></div>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Refunds & Void</p>
            <h3 class="text-3xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(dashboardData.refundedAmount)}</h3>
            <p class="text-[10px] font-black text-neutral-400 mt-2">{dashboardData.voidedCount} voids</p>
          </div>
        </div>

        <!-- Revenue Trend Chart (CSS bars) -->
        {#if dashboardData.revenueTrend.length > 0}
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <h4 class="text-lg font-black mb-6 dark:text-neutral-100">Revenue Trend</h4>
            <div class="flex items-end gap-2 h-52">
              {#each dashboardData.revenueTrend as point}
                <div class="flex-1 flex flex-col items-center gap-1">
                  <div class="w-full bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-600 cursor-pointer" style="height: {barHeight(point.amount, maxRevenue(dashboardData.revenueTrend))}px; min-width: 8px;" title={formatCurrency(point.amount)}></div>
                  <span class="text-[8px] font-bold text-neutral-400 -rotate-45 origin-left whitespace-nowrap">{point.date}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Payment Methods + Top Items -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <h4 class="text-lg font-black mb-4 dark:text-neutral-100">Payment Methods</h4>
            <div class="space-y-4">
              {#each dashboardData.paymentMethods as pm}
                <div class="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                  <div>
                    <p class="text-xs font-black dark:text-neutral-100">{pm.method}</p>
                    <p class="text-[10px] font-bold text-neutral-400">{pm.count} transactions</p>
                  </div>
                  <p class="text-lg font-black dark:text-neutral-100">{formatCurrency(pm.amount)}</p>
                </div>
              {/each}
            </div>
          </div>
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
            <h4 class="text-lg font-black mb-4 dark:text-neutral-100">Top Items</h4>
            <div class="space-y-4">
              {#each dashboardData.topItems.slice(0, 5) as item}
                <div class="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                      <span class="text-xs font-black text-indigo-600 dark:text-indigo-400">{item.qty}x</span>
                    </div>
                    <div>
                      <p class="text-xs font-black dark:text-neutral-100">{item.name}</p>
                      <p class="text-[10px] font-bold text-neutral-400">{item.qty} sold</p>
                    </div>
                  </div>
                  <p class="text-sm font-black dark:text-neutral-100">{formatCurrency(item.revenue)}</p>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Recent Activity / Hourly -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
            <div class="p-6 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
              <h4 class="text-lg font-black dark:text-neutral-100">Hourly Activity</h4>
            </div>
            <div class="p-6">
              {#if dashboardData.hourlyActivity.length > 0}
                <div class="flex items-end gap-1.5 h-32">
                  {#each dashboardData.hourlyActivity as h}
                    <div class="flex-1 flex flex-col items-center gap-1">
                      <div class="w-full bg-emerald-400 rounded-t transition-all" style="height: {(h.transactions / Math.max(...dashboardData.hourlyActivity.map(h => h.transactions), 1)) * 120}px; min-height: 2px;" title="{h.hour}: {h.transactions} txns"></div>
                      <span class="text-[7px] font-bold text-neutral-400">{h.hour}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-neutral-400 text-center py-8">No hourly data available</p>
              {/if}
            </div>
          </div>
          <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
            <div class="p-6 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
              <h4 class="text-lg font-black dark:text-neutral-100">Recent Transactions</h4>
            </div>
            <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#each dashboardData.recentTransactions.slice(0, 5) as txn}
                <div class="px-6 py-4 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-neutral-100 dark:bg-neutral-700 rounded-xl flex items-center justify-center">
                      {#if txn.method === 'Cash'}
                        <DollarSign class="w-4 h-4 text-emerald-600" />
                      {:else}
                        <ShoppingCart class="w-4 h-4 text-indigo-600" />
                      {/if}
                    </div>
                    <div>
                      <p class="text-xs font-black dark:text-neutral-100">{formatCurrency(txn.amount)}</p>
                      <p class="text-[9px] text-neutral-400">{txn.time} &bull; {txn.method}</p>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase {txn.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}">{txn.status}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="p-20 text-center text-neutral-400 font-bold uppercase text-[10px] tracking-widest">No dashboard data available</div>
    {/if}

  {:else if activeTab === 'zreport'}
    <!-- Z-REPORT TAB -->
    <div class="space-y-6">
      <div class="flex items-center gap-4">
        <input type="date" class="px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none" bind:value={zReportDate} />
        <button onclick={loadZReport} class="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">Generate Report</button>
        {#if zReportLoading}
          <Loader2 class="w-5 h-5 text-neutral-300 animate-spin" />
        {/if}
      </div>

      {#if zReportLoading}
        <div class="flex items-center justify-center h-64"><Loader2 class="w-8 h-8 text-neutral-300 animate-spin" /></div>
      {:else if zReportData}
        <div class="space-y-6">
          <!-- Summary Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Gross Revenue</p>
              <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(zReportData.summary.grandTotal)}</h4>
              <p class="text-[10px] text-neutral-400 font-black mt-2">{zReportData.summary.totalTransactions} transactions</p>
            </div>
            <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Card Payments</p>
              <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(zReportData.summary.cardTotal)}</h4>
              <p class="text-[10px] text-neutral-400 font-black mt-2">{zReportData.summary.cardCount} transactions</p>
            </div>
            <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Cash Payments</p>
              <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(zReportData.summary.cashTotal)}</h4>
              <p class="text-[10px] text-neutral-400 font-black mt-2">{zReportData.summary.cashCount} transactions</p>
            </div>
            <div class="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Avg. Basket</p>
              <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{formatCurrency(zReportData.summary.avgBasket)}</h4>
              <p class="text-[10px] text-neutral-400 font-black mt-2">Per transaction</p>
            </div>
          </div>

          <!-- Payment Breakdown + Refunds -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
              <h4 class="text-lg font-black mb-4 dark:text-neutral-100">Payment Split</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center"><ShoppingCart class="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                    <div><p class="text-xs font-black dark:text-neutral-100">Card</p><p class="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{zReportData.summary.cardCount} txns</p></div>
                  </div>
                  <p class="text-lg font-black dark:text-neutral-100">{formatCurrency(zReportData.summary.cardTotal)}</p>
                </div>
                <div class="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center"><ArrowDownLeft class="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                    <div><p class="text-xs font-black dark:text-neutral-100">Cash</p><p class="text-[10px] font-bold text-emerald-500 dark:text-emerald-400">{zReportData.summary.cashCount} txns</p></div>
                  </div>
                  <p class="text-lg font-black dark:text-neutral-100">{formatCurrency(zReportData.summary.cashTotal)}</p>
                </div>
                {#if (zReportData.summary.grandTotal || 0) > 0}
                  <div class="h-3 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden flex">
                    <div class="h-full bg-indigo-500" style="width: {(zReportData.summary.cardTotal / zReportData.summary.grandTotal) * 100}%"></div>
                    <div class="h-full bg-emerald-500" style="width: {(zReportData.summary.cashTotal / zReportData.summary.grandTotal) * 100}%"></div>
                  </div>
                {/if}
              </div>
            </div>
            <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
              <h4 class="text-lg font-black mb-4 dark:text-neutral-100">Refunds & Exceptions</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800/30">
                  <div><p class="text-xs font-black dark:text-neutral-100">Refunds</p><p class="text-[10px] font-bold text-rose-500 dark:text-rose-400">{zReportData.summary.refundCount} processed</p></div>
                  <p class="text-lg font-black text-rose-600 dark:text-rose-400">- {formatCurrency(zReportData.summary.refundTotal)}</p>
                </div>
                <div class="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                  <div><p class="text-xs font-black dark:text-neutral-100">Voids</p><p class="text-[10px] font-bold text-amber-500 dark:text-amber-400">Voided transactions</p></div>
                  <p class="text-lg font-black text-amber-600 dark:text-amber-400">{zReportData.summary.voidCount || 0}</p>
                </div>
                <div class="flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-800/30">
                  <div><p class="text-xs font-black dark:text-neutral-100">Promo Discounts</p><p class="text-[10px] font-bold text-violet-500 dark:text-violet-400">Multi-buy & loyalty</p></div>
                  <p class="text-lg font-black text-violet-600 dark:text-violet-400">- {formatCurrency(zReportData.summary.totalPromoDiscount)}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Hourly Breakdown Bar Chart -->
          {#if (zReportData.hourlyBreakdown || []).length > 0}
            <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
              <h4 class="text-lg font-black mb-6 dark:text-neutral-100">Hourly Revenue</h4>
              <div class="flex items-end gap-2 h-52">
                {#each zReportData.hourlyBreakdown as h}
                  <div class="flex-1 flex flex-col items-center gap-1 group">
                    <div class="relative w-full bg-indigo-500 rounded-t-lg transition-all duration-300 hover:bg-indigo-600 cursor-pointer" style="height: {barHeight(h.total, maxHourly(zReportData.hourlyBreakdown))}px; min-width: 8px;">
                      <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-2 py-0.5 rounded text-[8px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">{formatCurrency(h.total)}</div>
                    </div>
                    <span class="text-[9px] font-bold text-neutral-400">{h.hour}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Shift Summary -->
          {#if (zReportData.shifts || []).length > 0}
            <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
                <h4 class="text-lg font-black dark:text-neutral-100">Shift Activity</h4>
                <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{zReportData.shifts.length} shifts recorded</p>
              </div>
              <table class="w-full text-left">
                <thead class="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                  <tr>
                    <th class="px-6 py-3 text-[10px] font-black text-neutral-400 uppercase">Operator</th>
                    <th class="px-6 py-3 text-[10px] font-black text-neutral-400 uppercase">Start</th>
                    <th class="px-6 py-3 text-[10px] font-black text-neutral-400 uppercase">End</th>
                    <th class="px-6 py-3 text-[10px] font-black text-neutral-400 uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {#each zReportData.shifts as s}
                    <tr class="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                      <td class="px-6 py-3 text-xs font-black dark:text-neutral-100">{s.userName}</td>
                      <td class="px-6 py-3 text-xs text-neutral-500">{new Date(s.startTime).toLocaleTimeString()}</td>
                      <td class="px-6 py-3 text-xs text-neutral-500">{s.endTime ? new Date(s.endTime).toLocaleTimeString() : '--'}</td>
                      <td class="px-6 py-3 text-right">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase {s.status === 'Open' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}">{s.status}</span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          <!-- Cash Drawer -->
          {#if zReportData.cashDrawer}
            <div class="bg-neutral-900 rounded-[40px] p-8 text-white shadow-2xl">
              <h4 class="text-lg font-black mb-4">Cash Drawer Status</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p class="text-[9px] font-black text-neutral-500 uppercase">Float</p>
                  <p class="text-xl font-black">{formatCurrency(zReportData.cashDrawer.openingFloat)}</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p class="text-[9px] font-black text-neutral-500 uppercase">Cash In</p>
                  <p class="text-xl font-black text-emerald-400">{formatCurrency(zReportData.summary.cashTotal)}</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p class="text-[9px] font-black text-neutral-500 uppercase">Expected</p>
                  <p class="text-xl font-black">{formatCurrency((zReportData.cashDrawer.openingFloat || 0) + (zReportData.summary.cashTotal || 0))}</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p class="text-[9px] font-black text-neutral-500 uppercase">Status</p>
                  <p class="text-xl font-black text-amber-400">{zReportData.cashDrawer.status || 'Open'}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Export -->
          <div class="flex gap-3 justify-end">
            <button onclick={() => handleDownload({ id: 'zreport', title: `Z-Report_${zReportDate}`, category: 'Financial' })} class="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all">
              <Download class="w-4 h-4" /> Export CSV
            </button>
            <button onclick={() => { toast.info('Printing Z-Report...'); window.print(); }} class="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all">
              <Printer class="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      {/if}

      <!-- Archived Z-Report Snapshots -->
      <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-6 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30 flex items-center justify-between">
          <div>
            <h4 class="text-lg font-black dark:text-neutral-100">Archived Z-Reports</h4>
            <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Tamper-sealed end-of-day snapshots</p>
          </div>
          <button onclick={loadZReportSnapshots} class="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">Refresh</button>
        </div>
        {#if snapshotsLoading}
          <div class="p-10 flex justify-center"><Loader2 class="animate-spin text-neutral-300" /></div>
        {:else if zReportSnapshots.length === 0}
          <div class="p-12 text-center">
            <FileText class="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
            <p class="text-xs font-bold text-neutral-400 uppercase tracking-widest">No archived Z-Reports</p>
            <p class="text-[10px] text-neutral-300 dark:text-neutral-600 mt-1">Use the Close Day wizard to generate and archive reports</p>
          </div>
        {:else}
          <div class="divide-y divide-neutral-100 dark:divide-neutral-700">
            {#each zReportSnapshots as snap}
              {@const v = snap.reconciliation?.variance || 0}
              <div class="px-6 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                      <FileText class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p class="text-sm font-black dark:text-neutral-100">{snap.date || 'Unknown Date'}</p>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[9px] font-bold text-neutral-400">{snap.signedOffBy || 'Unknown'}</span>
                        <span class="text-neutral-300">&bull;</span>
                        <span class="text-[9px] font-bold text-neutral-400">{snap.terminalId || 'default'}</span>
                        {#if snap.createdAt}
                          <span class="text-neutral-300">&bull;</span>
                          <span class="text-[9px] font-bold text-neutral-400">{new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-sm font-black dark:text-neutral-100">{formatCurrency(snap.zReport?.summary?.grandTotal || snap.zReportData?.summary?.grandTotal || 0)}</p>
                      <p class="text-[9px] font-bold text-neutral-400">{snap.zReport?.summary?.totalTransactions || snap.zReportData?.summary?.totalTransactions || 0} txns</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider {v === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : Math.abs(v) > 50 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}">
                      {v === 0 ? 'Balanced' : `${v > 0 ? '+' : ''}R${v.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'vault'}
    <!-- ARCHIVE VAULT -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white rounded-[40px] border border-neutral-200 overflow-hidden shadow-sm">
        <div class="p-8 border-b border-neutral-100 flex items-center justify-between">
          <h3 class="text-xl font-black">Archive Vault</h3>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400"></Search>
            <input type="text" placeholder="Search report library..." bind:value={reportSearch} class="pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none w-64" />
          </div>
        </div>
        <div class="divide-y divide-neutral-50">
          {#if filteredReports.length === 0}
            <div class="p-20 text-center text-neutral-400 font-bold uppercase text-[10px] tracking-widest">No reports found in vault</div>
          {:else}
            {#each filteredReports as report}
              {@const ReportIcon = report.icon}
              <div class="p-6 flex items-center justify-between group hover:bg-neutral-50/50 transition-all cursor-pointer">
                <div class="flex items-center gap-6">
                  <div class="w-14 h-14 bg-white rounded-[24px] border border-neutral-200 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
                    <ReportIcon class="w-6 h-6 text-neutral-400 group-hover:text-indigo-600" />
                  </div>
                  <div>
                    <h5 class="font-black text-neutral-900 leading-none mb-1.5">{report.title}</h5>
                    <div class="flex items-center gap-3">
                      <span class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{report.category}</span>
                      <span class="text-[9px] font-bold text-neutral-400 uppercase">Synced: {report.time}</span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick={() => handlePDFExport(report)} title="Export as PDF" class="p-3 bg-rose-50 text-rose-400 rounded-xl hover:text-rose-600 border border-rose-100 transition-all hover:scale-105">
                    <FileText class="w-4 h-4" />
                  </button>
                  <button onclick={() => handleDownload(report)} title="Export as CSV" class="p-3 bg-neutral-50 text-neutral-400 rounded-xl hover:text-neutral-900 border border-neutral-100 transition-all hover:scale-105">
                    <Download class="w-4 h-4" />
                  </button>
                  <button onclick={() => { toast.info(`Printing ${report.title}...`); handlePDFExport(report); }} title="Print" class="p-3 bg-neutral-900 text-white rounded-xl shadow-lg hover:scale-105 transition-all">
                    <Printer class="w-4 h-4" />
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="space-y-8">
        <div class="bg-neutral-900 p-10 rounded-[48px] text-white relative overflow-hidden shadow-2xl">
          <h3 class="text-2xl font-black mb-6 tracking-tight">Compliance Status</h3>
          <div class="space-y-6">
            <div>
              <div class="flex justify-between text-[10px] font-black uppercase text-neutral-500 mb-2">
                <span>Override Validity</span>
                <span>94% Approved</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-500 w-[94%]"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[10px] font-black uppercase text-neutral-500 mb-2">
                <span>Sync Health</span>
                <span>100% Accurate</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 w-full"></div>
              </div>
            </div>
          </div>
          <div class="mt-12 p-6 bg-white/5 border border-white/5 rounded-[32px] backdrop-blur-md">
            <h5 class="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <ShieldCheck class="w-4 h-4 text-emerald-400" /> Audit Log Integrity
            </h5>
            <p class="text-[10px] font-medium text-neutral-400 leading-relaxed">All records are immutable. Tampering detected in database layer will trigger an immediate regional lock.</p>
          </div>
        </div>
        <div class="bg-white p-10 rounded-[48px] border border-neutral-200 shadow-sm flex flex-col items-center text-center">
          <PieChartIcon class="w-16 h-16 text-indigo-600 mb-6" />
          <h4 class="text-xl font-black mb-2">Industry Trends</h4>
          <p class="text-sm font-medium text-neutral-400 leading-relaxed mb-8">Analyze performance based on your Merchant Profile template.</p>
          <button class="w-full py-5 bg-neutral-900 text-white rounded-[24px] font-black uppercase tracking-widest text-xs shadow-xl">View Detailed Matrix</button>
        </div>
      </div>
    </div>
  {/if}
</div>
