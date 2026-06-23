<script lang="ts">
  import {
    TrendingUp, TrendingDown, Users, Package, ShieldAlert, Clock, DollarSign,
    ArrowUpRight, ArrowDownRight, Activity, Loader2, RefreshCw, BarChart3, AlertTriangle,
    LayoutGrid, CreditCard, Zap
  } from 'lucide-svelte';
  import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
  } from 'recharts';
  import { toast } from 'svelte-sonner';
  import { fly } from 'svelte/transition';
  import { api } from '../api';

  const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  let { merchantId, role }: { merchantId: string; role: string } = $props();

  let loading = $state(true);
  let transactions = $state<any[]>([]);
  let shifts = $state<any[]>([]);
  let stockAlerts = $state<any[]>([]);
  let auditEvents = $state<any[]>([]);

  let salesTarget = $state(() => {
    const stored = localStorage.getItem(`mgr_target_${merchantId}`);
    return stored ? parseFloat(stored) : 15000;
  });

  let enabledWidgets = $state<string[]>(() => {
    const stored = localStorage.getItem(`mgr_widgets_${merchantId}`);
    return stored ? JSON.parse(stored) : ['revenue', 'staff', 'stock', 'audit', 'trend', 'payment', 'products', 'shifts'];
  });

  let showConfig = $state(false);

  const loadAll = async () => {
    loading = true;
    try {
      const [txns, shiftData, alerts, audits] = await Promise.all([
        api.getTransactions(merchantId),
        api.getShifts(merchantId),
        api.getStockAlerts(merchantId, 15),
        api.getAuditEvents(merchantId),
      ]);
      transactions = Array.isArray(txns) ? txns : [];
      shifts = Array.isArray(shiftData) ? shiftData : [];
      stockAlerts = alerts?.alerts || [];
      auditEvents = Array.isArray(audits) ? audits : [];
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      loading = false;
    }
  };

  $effect(() => {
    loadAll();
  });

  const today = $derived(new Date().toDateString());
  const todayTxns = $derived(transactions.filter((t: any) => new Date(t.date).toDateString() === today));
  const todayRevenue = $derived(todayTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0));

  const yesterday = $derived(new Date(Date.now() - 86400000).toDateString());
  const yesterdayTxns = $derived(transactions.filter((t: any) => new Date(t.date).toDateString() === yesterday));
  const yesterdayRevenue = $derived(yesterdayTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0));
  const revenueChange = $derived(yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0);

  const activeShifts = $derived(shifts.filter((s: any) => s.status === 'Open'));
  const overrides = $derived(auditEvents.filter((e: any) => (e.category || '').includes('OVERRIDE')));
  const recentOverrides = $derived(overrides.filter((e: any) => Date.now() - new Date(e.timestamp || e.date).getTime() < 86400000));

  const dailyData = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const ds = d.toDateString();
      const dayTxns = transactions.filter((t: any) => new Date(t.date).toDateString() === ds);
      return {
        day: d.toLocaleDateString([], { weekday: 'short' }),
        revenue: dayTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0),
        count: dayTxns.length,
      };
    })
  );

  const cardTxns = $derived(todayTxns.filter((t: any) => t.method === 'Card'));
  const cashTxns = $derived(todayTxns.filter((t: any) => t.method === 'Cash'));
  const paymentPie = $derived(
    [
      { name: 'Card', value: cardTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0) },
      { name: 'Cash', value: cashTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0) },
    ].filter(p => p.value > 0)
  );

  const productMap = $derived.by(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    todayTxns.forEach((t: any) => {
      (t.items || []).forEach((item: any) => {
        if (!map[item.id]) map[item.id] = { name: item.name, qty: 0, revenue: 0 };
        map[item.id].qty += item.quantity || 1;
        map[item.id].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
  });

  const topProducts = $derived(productMap);

  const toggleWidget = (id: string) => {
    const next = enabledWidgets.includes(id)
      ? enabledWidgets.filter(w => w !== id)
      : [...enabledWidgets, id];
    enabledWidgets = next;
    localStorage.setItem(`mgr_widgets_${merchantId}`, JSON.stringify(next));
  };

  const widgets = [
    { id: 'revenue', name: 'Revenue', icon: DollarSign },
    { id: 'staff', name: 'Staff Count', icon: Users },
    { id: 'stock', name: 'Stock Alerts', icon: Package },
    { id: 'audit', name: 'Audits', icon: ShieldAlert },
    { id: 'trend', name: 'Sales Trend', icon: TrendingUp },
    { id: 'payment', name: 'Payment Split', icon: CreditCard },
    { id: 'products', name: 'Top Products', icon: Zap },
    { id: 'shifts', name: 'Active Shifts', icon: Clock },
  ];
</script>

{#if loading}
  <div class="flex items-center justify-center h-full">
    <Loader2 class="w-8 h-8 animate-spin text-neutral-300" />
  </div>
{:else}
  <div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Operations Dashboard</h2>
        <p class="text-neutral-500 font-medium">At-a-Glance Branch Performance â€¢ Real-time Metrics</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          onclick={() => showConfig = !showConfig}
          class="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl active:scale-95 transition-all border {showConfig ? 'bg-amber-500 text-black border-amber-600' : 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700'}"
        >
          <LayoutGrid class="w-4 h-4" /> {showConfig ? 'Close Config' : 'Configure Widgets'}
        </button>
        <button
          onclick={loadAll}
          class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-sm font-bold shadow-xl active:scale-95 transition-all"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw class="w-4 h-4" /> Refresh
        </button>
      </div>
    </div>

    {#key showConfig}
      {#if showConfig}
        <div transition:fly={{ y: -10, duration: 200 }} class="overflow-hidden">
          <div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-[40px] p-8">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h4 class="text-lg font-black dark:text-amber-400">Dashboard Layout Configuration</h4>
                <p class="text-xs text-amber-700 dark:text-amber-500/60 font-medium">Toggle widgets to customize your operational view</p>
              </div>
              <div class="px-3 py-1 bg-amber-500 text-black rounded-lg text-[10px] font-black uppercase tracking-widest">
                Changes Auto-saved
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {#each widgets as w}
                {@const WidgetIcon = w.icon}
                <button
                  onclick={() => toggleWidget(w.id)}
                  class="flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all active:scale-95 {enabledWidgets.includes(w.id) ? 'bg-white dark:bg-neutral-900 border-amber-500 shadow-lg' : 'bg-transparent border-neutral-200 dark:border-neutral-800 opacity-40 grayscale'}"
                >
                  <WidgetIcon class="w-5 h-5 mb-2 {enabledWidgets.includes(w.id) ? 'text-amber-500' : 'text-neutral-400'}" />
                  <span class="text-[10px] font-black uppercase tracking-widest text-center leading-tight">{w.name}</span>
                </button>
              {/each}
            </div>

            <div class="mt-8 pt-8 border-t border-amber-200/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="flex-1">
                <h5 class="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/60 dark:text-amber-500/40 mb-3">Branch Performance Target (ZAR)</h5>
                <div class="flex items-center gap-4">
                  <input
                    type="number"
                    bind:value={salesTarget}
                    onchange={() => localStorage.setItem(`mgr_target_${merchantId}`, salesTarget.toString())}
                    class="bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3 text-lg font-black font-mono w-48 outline-none focus:ring-4 focus:ring-amber-500/20 text-amber-600"
                  />
                  <div class="flex-1 max-w-xs">
                    <div class="flex justify-between text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                      <span>Current Progress</span>
                      <span>{((todayRevenue / Math.max(1, salesTarget)) * 100).toFixed(0)}%</span>
                    </div>
                    <div class="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-emerald-500 transition-all duration-1000"
                        style="width: {Math.min(100, (todayRevenue / Math.max(1, salesTarget)) * 100)}%"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="text-right">
                <p class="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 max-w-xs ml-auto">Setting branch targets affects the "Daily Revenue" KPI card and performance indicators across the dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/key}

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#if enabledWidgets.includes('revenue')}
        <div class="bg-white dark:bg-neutral-900 p-8 rounded-[40px] border border-neutral-100 dark:border-neutral-800 shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div class="flex items-center justify-between mb-6">
            <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <DollarSign class="w-6 h-6 text-emerald-500" />
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest {revenueChange >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}">
              {#if revenueChange >= 0}
                <ArrowUpRight class="w-3 h-3" />
              {:else}
                <ArrowDownRight class="w-3 h-3" />
              {/if}
              {Math.abs(revenueChange).toFixed(1)}%
            </div>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Daily Revenue</p>
          <h4 class="text-3xl font-black tracking-tighter dark:text-white font-mono">R {todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
          <div class="mt-6 pt-5 border-t border-neutral-50 dark:border-neutral-800">
            <p class="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center justify-between gap-2">
              <span class="flex items-center gap-2"><TrendingUp class="w-3 h-3 text-emerald-500" /> Target: R {salesTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span class="font-black text-emerald-500">{((todayRevenue / Math.max(1, salesTarget)) * 100).toFixed(0)}%</span>
            </p>
            <div class="mt-2 h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-emerald-500 transition-all duration-1000"
                style="width: {Math.min(100, (todayRevenue / Math.max(1, salesTarget)) * 100)}%"></div>
            </div>
          </div>
        </div>
      {/if}

      {#if enabledWidgets.includes('staff')}
        <div class="bg-white dark:bg-neutral-900 p-8 rounded-[40px] border border-neutral-100 dark:border-neutral-800 shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div class="flex items-center justify-between mb-6">
            <div class="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <Users class="w-6 h-6 text-indigo-500" />
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Activity class="w-3 h-3" /> STAFFED
            </div>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Active Staff</p>
          <h4 class="text-3xl font-black tracking-tighter dark:text-white font-mono">{activeShifts.length}</h4>
          <div class="mt-6 pt-5 border-t border-neutral-50 dark:border-neutral-800">
            <p class="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <Clock class="w-3 h-3 text-indigo-400" /> Avg Shift: 6.4 hrs
            </p>
          </div>
        </div>
      {/if}

      {#if enabledWidgets.includes('stock')}
        <div class="bg-white dark:bg-neutral-900 p-8 rounded-[40px] border border-neutral-100 dark:border-neutral-800 shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-amber-500/10 transition-colors"></div>
          <div class="flex items-center justify-between mb-6">
            <div class="p-3.5 rounded-2xl border {stockAlerts.length > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'}">
              {#if stockAlerts.length > 0}
                <AlertTriangle class="w-6 h-6 text-amber-500" />
              {:else}
                <Package class="w-6 h-6 text-emerald-500" />
              {/if}
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest {stockAlerts.length > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}">
              <BarChart3 class="w-3 h-3" /> STOCK
            </div>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Stock Health</p>
          <h4 class="text-3xl font-black tracking-tighter dark:text-white font-mono">{stockAlerts.length}</h4>
          <div class="mt-6 pt-5 border-t border-neutral-50 dark:border-neutral-800">
            <p class="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <AlertTriangle class="w-3 h-3 text-amber-400" /> Action required
            </p>
          </div>
        </div>
      {/if}

      {#if enabledWidgets.includes('audit')}
        <div class="bg-neutral-950 dark:bg-black p-8 rounded-[40px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group border border-white/5">
          <div class="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
          <div class="flex items-center justify-between mb-6">
            <div class="p-3.5 rounded-2xl bg-white/10 border border-white/5">
              <ShieldAlert class="w-6 h-6 text-amber-400" />
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-400 border border-amber-400/30">
              <Activity class="w-3 h-3" /> AUDIT
            </div>
          </div>
          <p class="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Overrides (24h)</p>
          <h4 class="text-3xl font-black tracking-tighter text-amber-400 font-mono">{recentOverrides.length}</h4>
          <div class="mt-6 pt-5 border-t border-white/5">
            <p class="text-[10px] font-bold text-white/40 flex items-center gap-2">
              <ShieldAlert class="w-3 h-3 text-amber-500" /> Logged to Forensic Ledger
            </p>
          </div>
        </div>
      {/if}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {#if enabledWidgets.includes('trend')}
        <div class="lg:col-span-2 bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
          <h3 class="text-xl font-black mb-6 dark:text-neutral-100">7-Day Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="mgr-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 700, fill: '#aaa' }} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#aaa' }} tickFormatter={(v: number) => `R${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 16, border: '1px solid #eee', fontSize: 11, fontWeight: 700 }}
                formatter={(v: number) => [`R ${v.toFixed(2)}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#mgr-rev-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      {/if}

      {#if enabledWidgets.includes('payment')}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm flex flex-col items-center {!enabledWidgets.includes('trend') ? 'lg:col-span-3' : ''}">
          <h3 class="text-xl font-black mb-6 self-start dark:text-neutral-100">Today's Payment Split</h3>
          {#if paymentPie.length > 0}
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={paymentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} strokeWidth={0}>
                  {#each paymentPie as _, i}
                    <Cell fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  {/each}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, fontWeight: 700 }} formatter={(v: number) => `R ${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div class="flex gap-4 mt-2">
              {#each paymentPie as p, i}
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded" style="background-color: {PIE_COLORS[i]}"></div>
                  <span class="text-[10px] font-black text-neutral-500 uppercase">{p.name}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex-1 flex items-center justify-center text-neutral-300 text-xs font-bold uppercase">No sales today</div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {#if enabledWidgets.includes('products')}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
          <h3 class="text-xl font-black mb-6 dark:text-neutral-100">Top Selling Products (Today)</h3>
          {#if topProducts.length === 0}
            <p class="text-neutral-400 text-xs font-bold uppercase text-center py-10">No product data</p>
          {:else}
            <div class="space-y-3">
              {#each topProducts as p, i}
                <div class="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <div class="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-black">
                    #{i + 1}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{p.name}</p>
                    <p class="text-[9px] font-bold text-neutral-400">{p.qty} units sold</p>
                  </div>
                  <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">R {p.revenue.toFixed(2)}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if enabledWidgets.includes('shifts')}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm">
          <h3 class="text-xl font-black mb-6 dark:text-neutral-100">Staff Currently on Shift</h3>
          {#if activeShifts.length === 0}
            <p class="text-neutral-400 text-xs font-bold uppercase text-center py-10">No active shifts</p>
          {:else}
            <div class="space-y-3">
              {#each activeShifts as s, i}
                {@const dur = ((Date.now() - new Date(s.startTime).getTime()) / 3600000).toFixed(1)}
                <div class="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <div class="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <Activity class="w-4 h-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{s.userName || s.userId?.substring(0, 12)}</p>
                    <p class="text-[9px] font-bold text-neutral-400">Started: {new Date(s.startTime).toLocaleTimeString()}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-black text-neutral-700">{dur} hrs</p>
                    <div class="flex items-center gap-1 justify-end">
                      <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span class="text-[8px] font-black text-emerald-500 uppercase">Active</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if enabledWidgets.includes('stock') && stockAlerts.length > 0}
      <div class="bg-amber-50 rounded-[40px] border border-amber-200 p-8 shadow-sm">
        <h3 class="text-xl font-black mb-4 flex items-center gap-3">
          <AlertTriangle class="w-6 h-6 text-amber-500" /> Low Stock Alerts
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {#each stockAlerts.slice(0, 8) as item, i}
            <div class="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-amber-200 dark:border-amber-700">
              <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{item.name}</p>
              <p class="text-[9px] font-bold text-neutral-400">{item.category}</p>
              <p class="text-lg font-black text-amber-600 mt-1">{item.stock} units</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
