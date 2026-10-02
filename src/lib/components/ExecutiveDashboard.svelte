<script lang="ts">
  import {
    Globe,
    Activity as ActivityIcon,
    Package as PackageIcon,
    DollarSign,
    ChevronRight,
    X,
    ShieldCheck as ShieldCheckIcon,
    Wifi as WifiIcon,
    Database,
    Loader2,
    RefreshCw,
    Users,
    AlertTriangle,
    CreditCard,
    Banknote,
    ShoppingBag,
    Store,
    Fuel,
    Wrench,
    UtensilsCrossed,
    Zap,
    Download,
    FileSpreadsheet,
    FileText,
    Calendar,
    Filter,
    Radio,
    WifiOff,
    Monitor,
    MapPin,
    Navigation,
    ArrowUpDown,
    Search,
    Clock,
  } from 'lucide-svelte';
  import { Bar, Pie } from 'svelte-chartjs';
  import {
    Chart,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
  } from 'chart.js';
  import { toast } from 'svelte-sonner';
  import L from 'leaflet';
  import { api } from '../api';
  import jsPDF from 'jspdf';

  Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

  // â”€â”€ Tenant config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const TENANT_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string; border: string }> = {
    Retail:     { icon: Store,           label: 'Retail',     color: '#6366f1', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20'  },
    Forecourt:  { icon: Fuel,            label: 'Forecourt',  color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    Workshop:   { icon: Wrench,          label: 'Workshop',   color: '#f97316', bg: 'bg-orange-500/10',  border: 'border-orange-500/20'  },
    Restaurant: { icon: UtensilsCrossed, label: 'Restaurant', color: '#ec4899', bg: 'bg-pink-500/10',    border: 'border-pink-500/20'    },
  };

  function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `R ${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000)     return `R ${(val / 1_000).toFixed(1)}K`;
    return `R ${val.toFixed(2)}`;
  }

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let activeView   = $state<'command' | 'map'>('command');
  let loading      = $state(true);
  let refreshing   = $state(false);
  let loadError    = $state<string | null>(null);
  let dashData     = $state<any>(null);
  let selectedTenant = $state<string | null>(null);
  let selectedNode   = $state<string | null>(null);
  let productImporterEnabled = $state(false);
  let productImporterRunning = $state(false);
  let productImportPushing = $state(false);
  let productImporterOffset = $state(0);
  let productImporterMessage = $state('');
  let importBannerDismissed = $state(false);
  let mapPanelOpen = $state(true);
  const productImporterIntervalMs = 15 * 60 * 1000;

  // Export state
  let showExportModal = $state(false);
  let exportFormat    = $state<'csv' | 'pdf'>('csv');
  let exportDateFrom  = $state('');
  let exportDateTo    = $state('');
  let exportTenant    = $state('all');
  let exporting       = $state(false);

  // SSE live stream
  let sseConnected = $state(false);
  let sseFeed      = $state<any[]>([]);
  let sseEnabled   = $state(false);
  let eventSourceRef: EventSource | null = null;

  // Devices
  let showDevices    = $state(false);
  let devices        = $state<any[]>([]);
  let loadingDevices = $state(false);

  // Tenant table: search + sorting
  let tenantQuery = $state('');
  let sortKey     = $state<'todaySales' | 'totalSales' | 'todayTxCount' | 'stockValue' | 'lowStockCount' | 'activeShifts'>('todaySales');
  let sortDir     = $state<'asc' | 'desc'>('desc');

  // Audit log: severity filter + search
  let auditQuery    = $state('');
  let auditSeverity = $state<'all' | 'ERROR' | 'WARNING' | 'INFO'>('all');

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    else { sortKey = key; sortDir = 'desc'; }
  }

  // Merchant markers are derived from tenants (live dashboard data)
  // in the mapReady effect below.
  const MERCHANT_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
    'merchant:M1': { lat: -26.1076, lng: 28.0567 },
    'merchant:M2': { lat: -33.9249, lng: 18.4241 },
    'merchant:M3': { lat: -27.7667, lng: 26.7833 },
    'merchant:M4': { lat: -26.1405, lng: 28.0683 },
  };

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let global_      = $derived(dashData?.global || {});
  let tenants      = $derived(dashData?.tenants || []);
  let liveFeed     = $derived(dashData?.liveFeed || []);
  let stockAlerts  = $derived(dashData?.stockAlerts || []);
  let recentAudit  = $derived(dashData?.recentAudit || []);
  let focusTenant  = $derived(selectedTenant ? tenants.find((t: any) => t.merchantId === selectedTenant) : null);

  let tenantChartData = $derived(
    tenants.map((t: any) => ({ name: t.type, sales: t.totalSales, today: t.todaySales, color: t.color }))
  );

  let pieDataArr = $derived(
    tenants
      .map((t: any) => ({ name: t.type, value: t.totalSales || 0, color: t.color }))
      .filter((d: any) => d.value > 0)
  );

  // Needs-attention items: critical stock (≤3 units) + error audit events
  let attentionItems = $derived([
    ...stockAlerts
      .filter((a: any) => a.severity === 'critical')
      .map((a: any) => ({ kind: 'stock' as const, ...a })),
    ...recentAudit
      .filter((e: any) => e.severity === 'ERROR')
      .slice(0, 5)
      .map((e: any) => ({ kind: 'audit' as const, ...e })),
  ]);

  // Payment mix: today's card vs cash per tenant + global split
  let paymentMix = $derived(
    tenants.map((t: any) => {
      const card = Number(t.cardSales || 0);
      const cash = Number(t.cashSales || 0);
      const total = card + cash;
      return { ...t, card, cash, cardPct: total > 0 ? Math.round((card / total) * 100) : 0 };
    })
  );
  let globalCardTotal = $derived(paymentMix.reduce((s: number, t: any) => s + t.card, 0));
  let globalCashTotal = $derived(paymentMix.reduce((s: number, t: any) => s + t.cash, 0));
  let globalCardPct = $derived(
    globalCardTotal + globalCashTotal > 0
      ? Math.round((globalCardTotal / (globalCardTotal + globalCashTotal)) * 100)
      : 0
  );

  // Tenant performance table: search + sortable
  let visibleTenants = $derived(
    tenants
      .filter((t: any) => {
        const q = tenantQuery.trim().toLowerCase();
        if (!q) return true;
        return [t.name, t.type, t.merchantId].some((v: any) => String(v || '').toLowerCase().includes(q));
      })
      .slice()
      .sort((a: any, b: any) => {
        const av = Number(a[sortKey] || 0);
        const bv = Number(b[sortKey] || 0);
        return sortDir === 'desc' ? bv - av : av - bv;
      })
  );

  // Shift board: everyone currently on shift, with time on shift
  function shiftDuration(startTime: string): string {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  }
  let shiftBoard = $derived(
    tenants.flatMap((t: any) =>
      (t.activeStaff || []).map((s: any) => ({
        ...s,
        merchantId: t.merchantId,
        merchantType: t.type,
        color: t.color,
        onShiftFor: s.startTime ? shiftDuration(s.startTime) : '—',
      }))
    )
  );

  // Audit log: severity filter + text search
  let filteredAudit = $derived(
    recentAudit.filter((e: any) => {
      if (auditSeverity !== 'all' && (e.severity || 'INFO') !== auditSeverity) return false;
      const q = auditQuery.trim().toLowerCase();
      if (!q) return true;
      return [e.action, e.merchantType, e.merchantId, typeof e.details === 'string' ? e.details : JSON.stringify(e.details || '')]
        .some((v: any) => String(v || '').toLowerCase().includes(q));
    })
  );

  // svelte-chartjs data objects
  let barChartData = $derived({
    labels: tenantChartData.map((d: any) => d.name),
    datasets: [
      {
        label: 'All Time',
        data: tenantChartData.map((d: any) => d.sales),
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 36,
      },
      {
        label: 'Today',
        data: tenantChartData.map((d: any) => d.today),
        backgroundColor: '#34d399',
        borderRadius: 6,
        barThickness: 36,
      },
    ],
  });

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` R ${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10, weight: 900 }, color: '#94A3B8' } },
      y: {
        grid: { color: '#F1F5F9' },
        ticks: {
          font: { size: 10, weight: 900 },
          color: '#94A3B8',
          callback: (val: any) => val >= 1000 ? `R${(val / 1000).toFixed(0)}K` : `R${val}`,
        },
      },
    },
  };

  let pieChartData = $derived({
    labels: pieDataArr.map((d: any) => d.name),
    datasets: [{
      data: pieDataArr.map((d: any) => d.value),
      backgroundColor: pieDataArr.map((d: any) => d.color),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  });

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` R ${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
  };

  // Current live feed (SSE or polling)
  let activeFeed = $derived(sseEnabled && sseConnected ? sseFeed : liveFeed);

  // â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function loadDashboard(silent = false) {
    try {
      if (!silent) { loading = true; loadError = null; }
      else refreshing = true;

      const data = await api.getAdminDashboard();
      if (data && !data.error) {
        dashData = data;
        loadError = null;
      } else {
        const msg = data?.error || data?.details || 'Dashboard endpoint returned an error';
        loadError = String(msg);
        if (!silent) toast.error('Failed to load cross-tenant data');
      }
    } catch (e: any) {
      console.error('[ExecDash] Load error:', e);
      loadError = e?.message || 'Network error connecting to Roxton Cloud';
      if (!silent) toast.error('Network error connecting to Roxton Cloud');
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function loadDevices() {
    try {
      loadingDevices = true;
      const deviceList = await api.getDevices();
      devices = deviceList;
    } catch (e) {
      console.error('[Devices] Load error:', e);
      toast.error('Failed to load device information');
    } finally {
      loadingDevices = false;
    }
  }

  async function loadProductImporterSettings() {
    const settings = await api.getProductImportSettings();
    productImporterEnabled = Boolean(settings?.enabled);
    productImporterOffset = Number(settings?.offset || 0);
  }

  async function runProductImporterBatch() {
    if (!productImporterEnabled || productImporterRunning) return;
    productImporterRunning = true;
    try {
      const result = await api.importLoyaltyHubCatalog(productImporterOffset, 500);
      if (!result.success) throw new Error(result.error || 'Automatic product import failed');
      const nextOffset = result.hasMore ? productImporterOffset + Number(result.discovered || 0) : 0;
      productImporterOffset = nextOffset;
      await api.setProductImportSettings(true, nextOffset);
      productImporterMessage = result.hasMore
        ? `Imported ${Number(result.imported || 0).toLocaleString()} products; next batch is queued.`
        : `Import cycle complete: ${Number(result.imported || 0).toLocaleString()} products processed.`;
    } catch (e: any) {
      productImporterMessage = e?.message || 'Automatic product import failed';
    } finally {
      productImporterRunning = false;
    }
  }

  // Background import via the job queue (RabbitMQ when configured, inline
  // fallback). Falls back to direct batches when the backend predates /jobs.
  let importJobPct = $state<number | null>(null);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function pushImportBatchesDirect() {
    const status = await api.getProductCloudImportStatus();
    const cursor = status?.status === 'running' && typeof status?.nextCursor === 'string' ? status.nextCursor : null;
    let pushed = 0;
    let processed = 0;
    let cursorNow = cursor;
    // Push up to 5000 rows per click, same safeguard as the Product Cloud import
    for (let i = 0; i < 10; i += 1) {
      const result = await api.importLoyaltyHubCatalog(cursorNow, 500);
      if (!result.success) throw new Error(result.error || 'LoyaltyHub import push failed');
      pushed += Number(result.imported || 0);
      processed = Number(result.processedRows || processed);
      importJobPct = Math.min(99, Math.round(((i + 1) / 10) * 100));
      productImporterMessage = `Pushing… batch ${i + 1}: ${pushed.toLocaleString()} products so far.`;
      if (!result.hasMore || !result.nextCursor) break;
      cursorNow = String(result.nextCursor);
    }
    return { pushed, processed };
  }

  async function pushLoyaltyHubImports() {
    if (productImportPushing) return;
    productImportPushing = true;
    importJobPct = 0;
    productImporterMessage = 'Pushing processed LoyaltyHub imports to the database…';
    try {
      // Preferred path: background job with polled progress.
      let jobId: string | null = null;
      try {
        const created = await api.createJob('loyaltyhub-import', { limit: 500, maxBatches: 10 });
        if (created?.success && created?.job?.id) jobId = String(created.job.id);
        else if (created && !String(created?.error || '').match(/404|not found|failed \(HTTP 404/i) && created?.error) {
          throw new Error(created.error);
        }
      } catch (e: any) {
        // /jobs missing on old backends -> direct fallback below (jobId stays null).
        if (e?.message && !String(e.message).match(/404|Failed to fetch|Network/i)) throw e;
      }

      if (!jobId) {
        const { pushed, processed } = await pushImportBatchesDirect();
        importJobPct = 100;
        productImporterMessage = `Pushed ${pushed.toLocaleString()} products from LoyaltyHub (${processed.toLocaleString()} rows processed) into the database.`;
        toast.success(`Pushed ${pushed.toLocaleString()} LoyaltyHub products to the database`);
        return;
      }

      for (let i = 0; i < 150; i += 1) {
        await sleep(2000);
        const cur = await api.getJob(jobId);
        const job = cur?.job;
        if (!job) throw new Error('Import job disappeared from the queue');
        const p = job.progress || {};
        if (typeof p.total === 'number' && p.total > 0) {
          importJobPct = Math.min(99, Math.round((Number(p.processed || 0) / p.total) * 100));
        } else if (Number(p.processed || 0) > 0) {
          importJobPct = Math.min(95, 10 + Math.round(Number(p.processed) / 500));
        }
        productImporterMessage = `${p.message || `Import ${job.status}…`} (via ${job.backend === 'rabbitmq' ? 'RabbitMQ' : 'background worker'})`;
        if (job.status === 'complete') {
          const pushed = Number(job.result?.pushed || 0);
          const processed = Number(job.result?.processedRows || p.processed || 0);
          importJobPct = 100;
          productImporterMessage = `Pushed ${pushed.toLocaleString()} products from LoyaltyHub (${processed.toLocaleString()} rows processed) into the database.`;
          toast.success(`Pushed ${pushed.toLocaleString()} LoyaltyHub products to the database`);
          loadDashboard(true);
          return;
        }
        if (job.status === 'failed') throw new Error(job.error || 'Import job failed');
      }
      throw new Error('Import job timed out after 5 minutes — check its status and retry.');
    } catch (e: any) {
      productImporterMessage = e?.message || 'LoyaltyHub import push failed';
      toast.error(productImporterMessage);
    } finally {
      productImportPushing = false;
      setTimeout(() => { importJobPct = null; }, 4000);
    }
  }

  async function toggleProductImporter() {
    const next = !productImporterEnabled;
    importBannerDismissed = false;
    const saved = await api.setProductImportSettings(next, next ? productImporterOffset : 0);
    if (saved?.error) {
      toast.error(saved.error);
      return;
    }
    productImporterEnabled = next;
    if (!next) {
      productImporterOffset = 0;
      productImporterMessage = 'Automatic product import is off.';
      toast.success('Automatic product importer disabled');
    } else {
      productImporterMessage = 'Automatic product import is on; starting a batch…';
      toast.success('Automatic product importer enabled');
      runProductImporterBatch();
    }
  }

  // â”€â”€ Initial load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Dismiss overlays with Escape
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showExportModal) showExportModal = false;
      else if (showDevices) showDevices = false;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Derived: attention items, payment mix, sorted tenants, shifts, audit ──

  $effect(() => {
    loadDashboard();
    loadProductImporterSettings();
  });

  $effect(() => {
    if (!productImporterEnabled) return;
    const interval = setInterval(runProductImporterBatch, productImporterIntervalMs);
    return () => clearInterval(interval);
  });

  // â”€â”€ Auto-refresh (paused when SSE active) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  $effect(() => {
    if (sseEnabled && sseConnected) return;
    const interval = setInterval(() => loadDashboard(true), 15000);
    return () => clearInterval(interval);
  });

  // â”€â”€ SSE live stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  $effect(() => {
    if (!sseEnabled) {
      if (eventSourceRef) {
        eventSourceRef.close();
        eventSourceRef = null;
        sseConnected = false;
      }
      return;
    }

    let cancelled = false;

    async function connectSSE() {
      try {
        const url = await api.getLiveStreamUrl();
        if (cancelled) return;
        const es = new EventSource(url);
        eventSourceRef = es;

        es.addEventListener('open', () => {
          sseConnected = true;
          console.log('[SSE] Connected to live stream');
        });

        es.addEventListener('snapshot', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (Array.isArray(data)) sseFeed = data;
          } catch {}
        });

        es.addEventListener('transaction', (e: MessageEvent) => {
          try {
            const tx = JSON.parse(e.data);
            sseFeed = [tx, ...sseFeed].slice(0, 30);
            loadDashboard(true);
          } catch {}
        });

        es.addEventListener('heartbeat', () => {
          sseConnected = true;
        });

        es.addEventListener('error', () => {
          sseConnected = false;
          setTimeout(() => {
            if (!cancelled && eventSourceRef === es) {
              es.close();
              connectSSE();
            }
          }, 5000);
        });
      } catch (e) {
        console.error('[SSE] Connection error:', e);
        sseConnected = false;
      }
    }

    connectSSE();

    return () => {
      cancelled = true;
      if (eventSourceRef) {
        eventSourceRef.close();
        eventSourceRef = null;
        sseConnected = false;
      }
    };
  });

  // â”€â”€ Leaflet map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let mapEl: HTMLDivElement | null = $state(null);
  let leafletMapInstance: L.Map | null = null;
  let merchantLayer: L.LayerGroup | null = null;
  let mapReady = $state(false);
  let markerById = new Map<string, L.Marker>();

  $effect(() => {
    if (activeView !== 'map') return;
    if (!mapEl) return;

    // Small delay so the container is in the DOM and sized
    const timer = setTimeout(() => {
      if (!mapEl || leafletMapInstance) return;

      const map = L.map(mapEl, {
        center: [-28.4793, 24.6727],
        zoom: 6,
        scrollWheelZoom: true,
      });
      leafletMapInstance = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        // Load faster: keep more tiles around the viewport, skip intermediate
        // zoom tiles, and keep fetches flowing during pan/zoom.
        keepBuffer: 4,
        updateWhenIdle: false,
        updateWhenZooming: false,
        crossOrigin: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      merchantLayer = L.layerGroup().addTo(map);
      mapReady = true;

      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      mapReady = false;
      markerById.clear();
      if (leafletMapInstance) {
        leafletMapInstance.remove();
        leafletMapInstance = null;
        merchantLayer = null;
      }
    };
  });

  // Plot live merchants as dots on the map; each dot opens a popup with merchant info
  $effect(() => {
    if (activeView !== 'map') return;
    if (!mapReady || !merchantLayer) return;
    const liveTenants = tenants; // reactive dependency
    const layer = merchantLayer;

    markerById.clear();
    layer.clearLayers();

    liveTenants.forEach((m: any) => {
      // Prefer server-provided coords; fall back to local coords so dots show
      // even if the deployed function hasn't been updated yet.
      const fallback = MERCHANT_FALLBACK_COORDS[m.merchantId];
      const lat = typeof m.lat === 'number' ? m.lat : fallback?.lat;
      const lng = typeof m.lng === 'number' ? m.lng : fallback?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const markerIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:18px;height:18px;border-radius:50%;
          background:${m.color};
          border:3px solid white;
          box-shadow:0 0 12px ${m.color},0 0 24px ${m.color}66;
          cursor:pointer;
        "></div>`,
        iconSize:    [18, 18],
        iconAnchor:  [9, 9],
        popupAnchor: [0, -12],
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(layer);
      marker.bindPopup(`
        <div style="padding:8px;min-width:220px;font-family:'JetBrains Mono',monospace">
          <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${m.color};margin-bottom:4px">
            ${m.type}
          </p>
          <h4 style="font-size:16px;font-weight:900;color:#171717;margin-bottom:12px">
            ${m.name}
          </h4>
          <div style="font-size:11px;color:#525252;line-height:1.7">
            <div><strong>Today:</strong> R ${Number(m.todaySales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} &bull; ${m.todayTxCount ?? 0} txns</div>
            <div><strong>All time:</strong> R ${Number(m.totalSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} &bull; ${m.allTimeTxCount ?? 0} txns</div>
            <div><strong>Active shifts:</strong> ${m.activeShifts ?? 0} &bull; <strong>Avg basket:</strong> R ${Number(m.avgBasket || 0).toFixed(2)}</div>
            <div><strong>Stock value:</strong> R ${Number(m.stockValue || 0).toLocaleString()} &bull; <strong>Low stock:</strong> ${m.lowStockCount ?? 0} items</div>
          </div>
        </div>
      `);
      marker.on('click', () => {
        selectedNode = m.merchantId;
      });
      markerById.set(m.merchantId, marker);
    });
  });

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Background export via the job queue: submit, poll, then download the
  // artifact the worker stored on the job record.
  let exportJobRunning = $state(false);

  function downloadCsvArtifact(csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `roxton_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleQueuedExport() {
    if (exporting || exportJobRunning) return;
    exportJobRunning = true;
    try {
      const created = await api.createJob('report-export', {
        format: exportFormat,
        dateFrom: exportDateFrom || undefined,
        dateTo: exportDateTo || undefined,
        tenantFilter: exportTenant,
      });
      if (!created?.success || !created?.job?.id) {
        throw new Error(created?.error || 'Background export submission failed');
      }
      const jobId = String(created.job.id);
      toast.success('Export queued — preparing your file in the background');
      for (let i = 0; i < 90; i += 1) {
        await sleep(2000);
        const cur = await api.getJob(jobId);
        const job = cur?.job;
        if (!job) throw new Error('Export job disappeared from the queue');
        if (job.status === 'complete') {
          const artifact = job.result?.artifact;
          if (exportFormat === 'csv' && typeof artifact === 'string') {
            downloadCsvArtifact(artifact);
            toast.success('CSV report downloaded');
          } else if (exportFormat === 'pdf' && artifact) {
            generatePDF(artifact);
            toast.success('PDF report generated');
          } else {
            throw new Error('Export finished without a downloadable artifact');
          }
          showExportModal = false;
          return;
        }
        if (job.status === 'failed') throw new Error(job.error || 'Background export failed');
      }
      throw new Error('Background export timed out — narrow the range and retry.');
    } catch (e: any) {
      console.error('[Export] Queued export error:', e);
      toast.error(e?.message || 'Background export failed');
    } finally {
      exportJobRunning = false;
    }
  }

  async function handleExport() {
    exporting = true;
    try {
      const res = await api.exportCrossTenantReport({
        format: exportFormat,
        dateFrom: exportDateFrom || undefined,
        dateTo: exportDateTo || undefined,
        tenantFilter: exportTenant,
      });

      if (!res.success) {
        toast.error(res.error || 'Export failed');
        return;
      }

      if (exportFormat === 'csv' && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `roxton_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('CSV report downloaded');
      } else if (exportFormat === 'pdf' && res.reportData) {
        generatePDF(res.reportData);
        toast.success('PDF report generated');
      }

      showExportModal = false;
    } catch (e: any) {
      console.error('[Export] Error:', e);
      toast.error('Export failed');
    } finally {
      exporting = false;
    }
  }

  function generatePDF(data: any) {
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ROXTON POS', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Cross-Tenant Intelligence Report', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString('en-ZA')}`, pageWidth / 2, y, { align: 'center' });
    doc.text(`Date Range: ${data.dateRange.from} to ${data.dateRange.to}`, pageWidth / 2, y + 4, { align: 'center' });
    y += 14;

    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;

    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 15, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summary = data.summary;
    const summaryItems = [
      ['Total Revenue',      `R ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ['Total Transactions', summary.totalTransactions.toString()],
      ['Average Basket',     `R ${summary.avgBasket.toFixed(2)}`],
      ['Card Sales',         `R ${summary.cardTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ['Cash Sales',         `R ${summary.cashTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
    ];

    for (const [label, value] of summaryItems) {
      doc.setFont('helvetica', 'normal');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 120, y);
      y += 6;
    }
    y += 6;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Tenant Breakdown', 15, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
    const cols    = [15, 50, 90, 120, 150, 175];
    const headers = ['Tenant', 'Sales', 'Card', 'Cash', 'Txns', 'Avg Basket'];
    headers.forEach((h, i) => doc.text(h, cols[i], y));
    y += 8;

    doc.setFont('helvetica', 'normal');
    for (const t of data.tenants) {
      doc.text(t.type,                   cols[0], y);
      doc.text(`R ${t.totalSales.toFixed(2)}`, cols[1], y);
      doc.text(`R ${t.cardSales.toFixed(2)}`,  cols[2], y);
      doc.text(`R ${t.cashSales.toFixed(2)}`,  cols[3], y);
      doc.text(t.txCount.toString(),           cols[4], y);
      doc.text(`R ${t.avgBasket.toFixed(2)}`,  cols[5], y);
      y += 6;
    }
    y += 8;

    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Transactions', 15, y);
    y += 8;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
    const txCols    = [15, 55, 80, 110, 135, 165];
    const txHeaders = ['Date', 'Merchant', 'Amount', 'Method', 'Cashier', 'Receipt'];
    txHeaders.forEach((h, i) => doc.text(h, txCols[i], y));
    y += 6;

    doc.setFont('helvetica', 'normal');
    const txLimit = Math.min(data.transactions.length, 40);
    for (let i = 0; i < txLimit; i++) {
      if (y > 275) { doc.addPage(); y = 20; }
      const tx = data.transactions[i];
      doc.text(new Date(tx.date).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }), txCols[0], y);
      doc.text(tx.merchant,                               txCols[1], y);
      doc.text(`R ${tx.amount.toFixed(2)}`,               txCols[2], y);
      doc.text(tx.method,                                 txCols[3], y);
      doc.text((tx.cashier || '').substring(0, 15),       txCols[4], y);
      doc.text((tx.receiptNo || '').substring(0, 16),     txCols[5], y);
      y += 5;
    }

    y += 10;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Powered by Roxton OS v4.2.1 | Confidential', pageWidth / 2, y, { align: 'center' });

    doc.save(`roxton_report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

</script>

<!-- â”€â”€ Loading splash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{#if loading && !dashData}
  <div class="executive-dashboard dashboard-shell p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto" aria-busy="true" aria-label="Loading dashboard">
    <div class="rounded-[28px] bg-slate-950 px-6 py-6 lg:px-8 lg:py-7 shadow-xl shadow-slate-950/10 space-y-3">
      <div class="skeleton-shimmer h-3 w-48 rounded-full"></div>
      <div class="skeleton-shimmer h-8 w-72 max-w-full rounded-xl"></div>
      <div class="skeleton-shimmer h-4 w-56 max-w-full rounded-lg"></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-hidden="true">
      {#each [0, 1, 2, 3] as i (i)}
        <div class="bg-white dark:bg-neutral-900 p-6 lg:p-7 rounded-2xl border border-slate-200/80 dark:border-neutral-800 space-y-4">
          <div class="skeleton-shimmer h-12 w-12 rounded-2xl"></div>
          <div class="skeleton-shimmer h-3 w-24 rounded-full"></div>
          <div class="skeleton-shimmer h-8 w-3/4 rounded-lg"></div>
          <div class="skeleton-shimmer h-3 w-1/2 rounded-full"></div>
        </div>
      {/each}
    </div>
    <p class="text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">Aggregating Cross-Tenant Intelligence...</p>
  </div>
{:else}
<div class="executive-dashboard dashboard-shell p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-700 max-w-[1800px] mx-auto">

  <!-- â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div class="executive-hero relative overflow-hidden flex flex-col lg:flex-row lg:items-end justify-between gap-5 rounded-[28px] bg-slate-950 px-6 py-6 lg:px-8 lg:py-7 text-white shadow-xl shadow-slate-950/10">
    <div class="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none"></div>
    <div class="absolute -left-16 -bottom-24 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none"></div>
    <div class="relative z-10">
      <div class="relative flex items-center gap-2 mb-2">
        <span class="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.75)]"></span>
        <span class="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Clinton POS · Executive overview</span>
        {#if refreshing}
          <Loader2 size={12} class="animate-spin text-amber-200" />
        {/if}
      </div>
      <h2 class="relative text-3xl lg:text-4xl font-black tracking-tight text-white">Operations at a glance</h2>
      <p class="relative text-slate-300 font-medium text-sm mt-2">
        {global_?.merchantCount ?? 4} locations · {global_?.activeShifts ?? 0} active shifts
        {#if dashData?.generatedAt}
          <span class="text-slate-400 ml-2 text-xs">Updated {timeAgo(dashData.generatedAt)}</span>
        {/if}
      </p>
    </div>

    <div class="relative flex items-center gap-2 flex-wrap lg:justify-end max-w-4xl">
      <!-- View switcher -->
      <div class="flex bg-white/10 p-1 rounded-2xl border border-white/15 shadow-sm" role="tablist" aria-label="Dashboard views">
        {#each [{ key: 'command', label: 'Command' }, { key: 'map', label: 'Merchant Map' }] as v}
          <button
            onclick={() => activeView = v.key as any}
            role="tab"
            aria-selected={activeView === v.key}
            class={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
              activeView === v.key ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {v.label}
          </button>
        {/each}
      </div>

      <button
        onclick={() => loadDashboard(true)}
        class="p-2.5 rounded-xl border border-white/15 bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 transition-all focus-visible:outline-2 focus-visible:outline-amber-300"
        title="Refresh data"
        aria-label="Refresh dashboard data"
      >
        <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  </div>

  <!-- Action toolbar: data + workspace actions, separated from the hero for scanability -->
  <div class="flex items-center gap-2 flex-wrap" role="toolbar" aria-label="Dashboard actions">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mr-1 hidden sm:inline">Catalogue</span>
      <button
        onclick={toggleProductImporter}
        aria-pressed={productImporterEnabled}
        class={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 ${productImporterEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600'}`}
        title={productImporterEnabled ? 'Disable automatic Product Cloud importing' : 'Enable automatic Product Cloud importing'}
      >
        <Database size={14} class={productImporterRunning ? 'animate-pulse' : ''} />
        Auto Import {productImporterEnabled ? 'On' : 'Off'}
      </button>

      <button
        onclick={() => { importBannerDismissed = false; pushLoyaltyHubImports(); }}
        disabled={productImportPushing}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-indigo-500"
        title="Push processed LoyaltyHub imports into the product database"
      >
        <Database size={14} class={productImportPushing ? 'animate-pulse' : ''} />
        {productImportPushing ? 'Pushing…' : 'Push Imports'}
      </button>
    </div>

    <div class="flex items-center gap-2 flex-wrap sm:ml-auto">
      <span class="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 mr-1 hidden sm:inline">Workspace</span>
      <button
        onclick={() => showExportModal = true}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        <Download size={14} /> Export
      </button>

      <!-- SSE toggle -->
      <button
        onclick={() => sseEnabled = !sseEnabled}
        aria-pressed={sseEnabled}
        class={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border focus-visible:outline-2 focus-visible:outline-emerald-500 ${
          sseEnabled
            ? sseConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600'
        }`}
        title={sseEnabled ? (sseConnected ? 'SSE stream active' : 'SSE reconnecting...') : 'Enable real-time SSE stream'}
      >
        {#if sseEnabled}
          {#if sseConnected}
            <Radio size={14} class="animate-pulse" />
          {:else}
            <WifiOff size={14} />
          {/if}
        {:else}
          <Radio size={14} />
        {/if}
        {sseEnabled ? (sseConnected ? 'Live' : 'Connecting') : 'SSE'}
      </button>

      <button
        onclick={() => { loadDevices(); showDevices = true; }}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <Monitor size={14} /> Devices
      </button>
    </div>
  </div>
  {#if refreshing}
    <div class="h-1 -mt-4 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800" role="progressbar" aria-label="Refreshing dashboard">
      <div class="h-full w-1/3 rounded-full bg-indigo-500 refreshing-slide"></div>
    </div>
  {/if}

  <!-- â”€â”€ COMMAND VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if (productImporterEnabled || productImporterMessage) && !importBannerDismissed}
    <div role="status" aria-live="polite" class={`rounded-2xl border px-4 py-3 text-xs font-semibold ${productImporterEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-2 min-w-0">
          {#if productImporterRunning || productImportPushing}
            <Loader2 size={14} class="animate-spin shrink-0" aria-hidden="true" />
          {/if}
          <span class="truncate">{productImporterMessage || 'Automatic Product Cloud importing is enabled.'}</span>
        </span>
        {#if importJobPct !== null}
          <span class="flex items-center gap-2 shrink-0 w-40" role="progressbar" aria-valuenow={importJobPct} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress">
            <span class="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <span class="block h-full rounded-full bg-emerald-500 transition-all duration-500" style={`width:${importJobPct}%`}></span>
            </span>
            <span class="text-[10px] font-black tabular-nums">{importJobPct}%</span>
          </span>
        {/if}
        <span class="flex items-center gap-3 shrink-0">
          {#if productImporterEnabled}<span class="font-mono text-[10px] uppercase tracking-widest">Next offset: {productImporterOffset.toLocaleString()}</span>{/if}
          <button
            onclick={() => importBannerDismissed = true}
            class="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Dismiss"
            aria-label="Dismiss import status message"
          >
            <X size={14} />
          </button>
        </span>
      </div>
    </div>
  {/if}

  {#if !loading && loadError && !dashData}
    <div role="alert" class="rounded-[28px] border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-8 sm:p-10 text-center space-y-4">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
        <AlertTriangle size={28} />
      </div>
      <div>
        <h3 class="text-lg font-black tracking-tight dark:text-neutral-100">Dashboard data isn't loading</h3>
        <p class="text-sm text-neutral-500 font-medium mt-1 max-w-xl mx-auto break-words">{loadError}</p>
        <p class="text-[11px] text-neutral-400 font-mono mt-2">Check the browser console (F12) for the failing request URL.</p>
      </div>
      <button
        onclick={() => loadDashboard()}
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl transition-all"
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  {/if}

  {#if activeView === 'command'}

    <!-- Tenant Profile Strip -->
    <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x" role="tablist" aria-label="Filter by tenant">
      <button
        onclick={() => selectedTenant = null}
        role="tab"
        aria-selected={!selectedTenant}
        class={`shrink-0 snap-start flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border focus-visible:outline-2 focus-visible:outline-indigo-500 ${
          !selectedTenant
            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-lg'
            : 'bg-white dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
        }`}
      >
        <Globe size={14} /> All Tenants
      </button>

      {#each tenants as t (t.merchantId)}
        {@const config = TENANT_CONFIG[t.type] || TENANT_CONFIG.Retail}
        {@const Icon   = config.icon}
        {@const isSelected = selectedTenant === t.merchantId}
        <button
          onclick={() => selectedTenant = isSelected ? null : t.merchantId}
          role="tab"
          aria-selected={isSelected}
          class={`shrink-0 snap-start flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border focus-visible:outline-2 focus-visible:outline-indigo-500 ${
            isSelected
              ? 'text-white shadow-lg'
              : 'bg-white dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
          }`}
          style={isSelected ? `background-color:${t.color};border-color:${t.color}` : ''}
        >
          <Icon size={14} />
          {t.type}
          <span class={`ml-1 px-1.5 py-0.5 rounded-lg text-[8px] ${isSelected ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-700'}`}>
            {t.todayTxCount} tx
          </span>
        </button>
      {/each}
    </div>

    <!-- Needs attention: critical stock + error audit events -->
    {#if attentionItems.length > 0}
      <section aria-label="Needs attention" class="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/5 px-4 py-3">
        <div class="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} class="text-red-500 shrink-0" />
          <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
            Needs attention · {attentionItems.length}
          </h3>
        </div>
        <ul class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
          {#each attentionItems.slice(0, 10) as item (item.kind + ':' + (item.id || item.name))}
            <li class="shrink-0 snap-start flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-red-100 dark:border-red-500/20 text-xs font-semibold text-neutral-700 dark:text-neutral-200 max-w-xs">
              <span class="w-2 h-2 rounded-full shrink-0 {item.kind === 'stock' ? 'bg-red-500' : 'bg-amber-500'}"></span>
              <span class="truncate">
                {#if item.kind === 'stock'}
                  {item.name} · {item.stock} left ({item.merchantType})
                {:else}
                  {(item.action || 'EVENT').replace(/_/g, ' ')} · {item.merchantType}
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Global KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {#each [
        {
          label: selectedTenant ? `${focusTenant?.type} Sales`        : 'All-time revenue',
          value: formatCurrency(selectedTenant ? (focusTenant?.totalSales   || 0) : (global_?.totalSales   || 0)),
          sub:   `Today: ${formatCurrency(selectedTenant ? (focusTenant?.todaySales || 0) : (global_?.todaySales || 0))}`,
          icon: DollarSign,  color: '#d99c16', trend: 'Lifetime',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Transactions` : 'Transactions',
          value: selectedTenant ? (focusTenant?.allTimeTxCount || 0).toLocaleString() : (global_?.totalTransactions || 0).toLocaleString(),
          sub:   `Today: ${selectedTenant ? (focusTenant?.todayTxCount || 0) : (global_?.todayTransactions || 0)} txns`,
          icon: ShoppingBag, color: '#14966f', trend: 'All time',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Stock Value`  : 'Stock value',
          value: formatCurrency(selectedTenant ? (focusTenant?.stockValue   || 0) : (global_?.stockValue   || 0)),
          sub:   `${selectedTenant ? (focusTenant?.lowStockCount || 0) : (global_?.lowStockAlerts || 0)} low-stock alerts`,
          icon: PackageIcon, color: '#d97735', trend: 'Inventory',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Staff`        : 'Active shifts',
          value: selectedTenant ? (focusTenant?.activeShifts || 0).toString() : (global_?.activeShifts || 0).toString(),
          sub:   selectedTenant ? `Avg basket: ${formatCurrency(focusTenant?.avgBasket || 0)}` : 'Nodes active across region',
          icon: Users,       color: '#6c72bf', trend: 'Now',
        },
      ] as stat, i}
        <div
          class="executive-kpi bg-white dark:bg-neutral-900 p-6 lg:p-7 rounded-2xl border border-slate-200/80 dark:border-neutral-800 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-neutral-600 transition-all min-w-0"
        >
          <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div class="absolute left-0 top-6 bottom-6 w-1 rounded-full" style={`background-color:${stat.color}`} aria-hidden="true"></div>
          <div class="flex items-center justify-between mb-6">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all border border-neutral-100 dark:border-neutral-700/50"
              style={`background-color:${stat.color}10;color:${stat.color}`}
            >
              <stat.icon size={24} />
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 uppercase tracking-widest">
              {stat.trend}
            </div>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
          <h4 class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-neutral-900 dark:text-white font-mono tabular-nums break-words">{stat.value}</h4>
          <div class="mt-5 pt-4 border-t border-slate-100 dark:border-neutral-800">
            <p class="text-[11px] font-bold flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <ActivityIcon size={14} class="opacity-50" /> {stat.sub}
            </p>
          </div>
        </div>
      {/each}
    </div>

    <!-- Tenant Breakdown Grid (all tenants view) -->
    {#if !selectedTenant}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {#each tenants as t, i (t.merchantId)}
          {@const config = TENANT_CONFIG[t.type] || TENANT_CONFIG.Retail}
          {@const Icon   = config.icon}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            role="button"
            tabindex="0"
            onclick={() => selectedTenant = t.merchantId}
            onkeydown={(e) => e.key === 'Enter' && (selectedTenant = t.merchantId)}
            class="bg-white dark:bg-neutral-800/80 rounded-[28px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm p-6 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
          >
            <!-- Color accent -->
            <div class="absolute top-0 left-0 right-0 h-1 rounded-t-[28px]" style={`background-color:${t.color}`}></div>

            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl flex items-center justify-center" style={`background-color:${t.color}15;color:${t.color}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p class="text-xs font-black text-neutral-900 dark:text-neutral-100">{t.type}</p>
                  <p class="text-[9px] text-neutral-400 font-bold truncate max-w-[140px]">{t.name}</p>
                </div>
              </div>
              <ChevronRight size={16} class="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Sales</p>
                <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{formatCurrency(t.totalSales)}</p>
              </div>
              <div>
                <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Today</p>
                <p class="text-sm font-black tabular-nums" style={`color:${t.color}`}>{formatCurrency(t.todaySales)}</p>
              </div>
              <div>
                <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Stock Val</p>
                <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{formatCurrency(t.stockValue)}</p>
              </div>
              <div>
                <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">On Shift</p>
                <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {t.activeShifts}
                  {#if t.lowStockCount > 0}
                    <span class="ml-2 text-[8px] text-amber-500 font-black">{t.lowStockCount} alerts</span>
                  {/if}
                </p>
              </div>
            </div>

            {#if t.activeStaff.length > 0}
              <div class="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
                <div class="flex items-center gap-1 flex-wrap">
                  {#each t.activeStaff.slice(0, 3) as s, idx}
                    <span class="px-2 py-0.5 rounded-lg text-[8px] font-bold" style={`background-color:${t.color}10;color:${t.color}`}>
                      {s.name}
                    </span>
                  {/each}
                  {#if t.activeStaff.length > 3}
                    <span class="text-[8px] text-neutral-400 font-bold">+{t.activeStaff.length - 3} more</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Charts + Live Feed Row -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Revenue Comparison Chart -->
      <div class="xl:col-span-2 bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Revenue by Tenant</h3>
            <p class="text-neutral-400 text-sm font-medium">All-time sales vs today's contribution</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-sm bg-indigo-500"></div>
              <span class="text-[9px] font-black text-neutral-400 uppercase">All Time</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-sm bg-emerald-400"></div>
              <span class="text-[9px] font-black text-neutral-400 uppercase">Today</span>
            </div>
          </div>
        </div>
        <div class="h-[300px] w-full relative">
          {#if tenantChartData.length > 0}
            <Bar data={barChartData} options={barChartOptions} />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <Loader2 size={24} class="animate-spin text-neutral-200" />
            </div>
          {/if}
        </div>
      </div>

      <!-- Live Cross-Merchant Feed -->
      <div class="bg-neutral-900 dark:bg-neutral-950 rounded-[36px] p-6 text-white relative overflow-hidden shadow-2xl flex flex-col">
        <div class="relative z-10 flex flex-col h-full">
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></div>
              <h3 class="text-base font-black uppercase tracking-tight">Live Transaction Feed</h3>
              {#if sseEnabled && sseConnected}
                <span class="text-[7px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/20">SSE</span>
              {/if}
            </div>
            <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">{activeFeed.length} recent</span>
          </div>

          <div class="space-y-2 overflow-y-auto flex-1 max-h-[360px] custom-scrollbar pr-1">
            {#if activeFeed.length > 0}
              {#each activeFeed.slice(0, 12) as tx, i (tx.id ?? i)}
                <div class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group cursor-default">
                  <div class="w-1.5 h-8 rounded-full shrink-0" style={`background-color:${tx.color}`}></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md" style={`background-color:${tx.color}20;color:${tx.color}`}>
                        {tx.merchantType}
                      </span>
                      <span class="text-[9px] font-bold text-neutral-500">{tx.cashier}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-black text-white tabular-nums">R {tx.amount.toFixed(2)}</p>
                      <div class="flex items-center gap-1.5">
                        {#if tx.method === 'Card'}
                          <CreditCard size={12} class="text-blue-400" />
                        {:else}
                          <Banknote size={12} class="text-emerald-400" />
                        {/if}
                        <span class="text-[9px] text-neutral-500 font-bold">{timeAgo(tx.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="py-12 text-center opacity-40">
                <Zap size={32} class="mx-auto mb-3 text-neutral-500" />
                <p class="text-[10px] font-black uppercase tracking-widest text-neutral-500">No transactions yet â€” process a sale in any tenant</p>
              </div>
            {/if}
          </div>

          <!-- Stock alerts summary -->
          <div class="mt-4 pt-4 border-t border-white/10">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                <AlertTriangle size={12} class="inline-block mr-1 text-amber-500" />
                Stock Alerts
              </span>
              <span class="text-[10px] font-black text-amber-400">{stockAlerts.length} items</span>
            </div>
            {#each stockAlerts.slice(0, 3) as alert, i (alert.id ?? i)}
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" style={`background-color:${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}`}></span>
                  <span class="text-[10px] text-neutral-300 font-bold truncate max-w-[140px]">{alert.name}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded" style={`background-color:${alert.color}20;color:${alert.color}`}>
                    {alert.merchantType}
                  </span>
                  <span class={`text-[10px] font-black tabular-nums ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                    {alert.stock} left
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
        <div class="absolute top-0 right-0 -mr-20 -mt-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>
    </div>

    <!-- Sales Mix Pie + Audit Log Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Revenue split pie -->
      <div class="bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm">
        <h3 class="text-lg font-black tracking-tight dark:text-neutral-100 mb-1">Revenue Split</h3>
        <p class="text-neutral-400 text-xs font-medium mb-6">All-time contribution by tenant</p>
        <div class="h-[220px]">
          {#if pieDataArr.length > 0}
            <Pie data={pieChartData} options={pieChartOptions} />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <p class="text-[10px] font-black text-neutral-300 uppercase tracking-widest">No sales data</p>
            </div>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-2 mt-4">
          {#each pieDataArr as d (d.name)}
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-sm shrink-0" style={`background-color:${d.color}`}></div>
              <span class="text-[9px] font-black text-neutral-500 uppercase tracking-widest">{d.name}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Audit trail -->
      <div class="lg:col-span-2 bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-6">
          <div>
            <h3 class="text-lg font-black tracking-tight dark:text-neutral-100">Cross-Tenant Audit Trail</h3>
            <p class="text-neutral-400 text-xs font-medium">Real-time forensic events from all merchants</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex bg-neutral-100 dark:bg-neutral-700/50 p-1 rounded-xl" role="group" aria-label="Filter by severity">
              {#each ['all', 'ERROR', 'WARNING', 'INFO'] as sev}
                <button
                  onclick={() => auditSeverity = sev as typeof auditSeverity}
                  aria-pressed={auditSeverity === sev}
                  class={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    auditSeverity === sev
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                  }`}
                >
                  {sev === 'all' ? 'All' : sev}
                </button>
              {/each}
            </div>
            <label class="relative block">
              <Search size={12} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="search"
                bind:value={auditQuery}
                placeholder="Search events…"
                aria-label="Search audit events"
                class="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-8 pr-2 py-1.5 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 w-40 dark:text-neutral-100"
              />
            </label>
            <div class="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
              <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live Sync</span>
            </div>
          </div>
        </div>
        <div class="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
          {#if filteredAudit.length > 0}
            {#each filteredAudit as evt, i (evt.id ?? i)}
              <div class="flex items-center gap-3 p-3 rounded-xl border border-neutral-50 dark:border-neutral-700/30 hover:bg-neutral-50 dark:hover:bg-neutral-700/20 transition-all">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black" style={`background-color:${evt.color}15;color:${evt.color}`}>
                  {evt.merchantType?.[0] || '?'}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                      {(evt.action || 'EVENT').replace(/_/g, ' ')}
                    </span>
                    <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded" style={`background-color:${evt.color}15;color:${evt.color}`}>
                      {evt.merchantType}
                    </span>
                  </div>
                  {#if evt.details}
                    <p class="text-[9px] text-neutral-400 font-medium truncate mt-0.5">
                      {typeof evt.details === 'string' ? evt.details : JSON.stringify(evt.details).substring(0, 80)}
                    </p>
                  {/if}
                </div>
                <div class="text-right shrink-0">
                  <p class="text-[9px] font-bold text-neutral-400 tabular-nums">{timeAgo(evt.timestamp)}</p>
                  <p class={`text-[8px] font-black uppercase tracking-widest ${
                    evt.severity === 'ERROR'   ? 'text-red-500'   :
                    evt.severity === 'WARNING' ? 'text-amber-500' : 'text-neutral-300'
                  }`}>{evt.severity || 'INFO'}</p>
                </div>
              </div>
            {/each}
          {:else}
            <div class="py-12 text-center opacity-30">
              <ShieldCheckIcon size={32} class="mx-auto mb-3 text-neutral-400" />
              <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                {auditQuery || auditSeverity !== 'all' ? 'No events match the current filters' : 'No audit events — system clean'}
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Tenant performance table: searchable + sortable -->
    <div class="bg-white dark:bg-neutral-800/50 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 justify-between p-8 pb-4">
        <div>
          <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Tenant Performance</h3>
          <p class="text-neutral-400 text-sm font-medium">Search and sort every location by the metric that matters</p>
        </div>
        <label class="relative block sm:w-64">
          <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="search"
            bind:value={tenantQuery}
            placeholder="Search tenants…"
            aria-label="Search tenants"
            class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-9 pr-3 py-2.5 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-400 dark:text-neutral-100"
          />
        </label>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm min-w-[720px]">
          <thead>
            <tr class="text-[9px] font-black uppercase tracking-widest text-neutral-400 border-y border-neutral-100 dark:border-neutral-700/50">
              <th class="px-8 py-3 font-black">Tenant</th>
              {#each [
                { key: 'todaySales', label: 'Today' },
                { key: 'totalSales', label: 'All-time' },
                { key: 'todayTxCount', label: 'Txns today' },
                { key: 'stockValue', label: 'Stock value' },
                { key: 'lowStockCount', label: 'Low stock' },
                { key: 'activeShifts', label: 'Shifts' },
              ] as col (col.key)}
                <th class="px-4 py-3 font-black">
                  <button
                    onclick={() => toggleSort(col.key as typeof sortKey)}
                    aria-label={`Sort by ${col.label}`}
                    class="inline-flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors uppercase tracking-widest text-[9px] font-black"
                  >
                    {col.label}
                    <ArrowUpDown size={12} class={sortKey === col.key ? 'text-indigo-500' : 'opacity-40'} />
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each visibleTenants as t (t.merchantId)}
              <tr
                class="border-b border-neutral-50 dark:border-neutral-700/30 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-700/20 transition-colors cursor-pointer"
              >
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <td class="px-8 py-3" onclick={() => selectedTenant = selectedTenant === t.merchantId ? null : t.merchantId}>
                  <div class="flex items-center gap-3">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style={`background-color:${t.color}`}></span>
                    <div class="min-w-0">
                      <p class="font-black text-neutral-900 dark:text-neutral-100 text-xs">{t.type}</p>
                      <p class="text-[10px] text-neutral-400 font-medium truncate max-w-[180px]">{t.name}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 font-black tabular-nums text-neutral-900 dark:text-neutral-100">{formatCurrency(t.todaySales || 0)}</td>
                <td class="px-4 py-3 font-bold tabular-nums text-neutral-500">{formatCurrency(t.totalSales || 0)}</td>
                <td class="px-4 py-3 font-bold tabular-nums text-neutral-500">{Number(t.todayTxCount || 0).toLocaleString()}</td>
                <td class="px-4 py-3 font-bold tabular-nums text-neutral-500">{formatCurrency(t.stockValue || 0)}</td>
                <td class="px-4 py-3">
                  {#if t.lowStockCount > 0}
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/10 text-amber-600">{t.lowStockCount}</span>
                  {:else}
                    <span class="text-neutral-300 font-bold">—</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if t.activeShifts > 0}
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-600">{t.activeShifts} open</span>
                  {:else}
                    <span class="text-neutral-300 font-bold">—</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="7" class="px-8 py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  No tenants match “{tenantQuery}”
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Operations: payment mix + shift board (live data) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Payment mix -->
      <div class="bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm">
        <div class="flex items-center gap-4 mb-2">
          <div class="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-[20px] flex items-center justify-center">
            <CreditCard size={24} />
          </div>
          <div>
            <h3 class="text-xl font-black dark:text-neutral-100">Payment Mix</h3>
            <p class="text-neutral-400 text-sm font-medium">Today's card vs cash takings</p>
          </div>
        </div>
        <div class="flex items-center gap-3 mb-6">
          <div class="flex-1 h-3 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-700 flex" role="img" aria-label={`Card ${globalCardPct} percent, cash ${100 - globalCardPct} percent`}>
            <div class="h-full bg-blue-500 transition-all duration-700" style={`width:${globalCardPct}%`}></div>
            <div class="h-full bg-emerald-500 transition-all duration-700" style={`width:${100 - globalCardPct}%`}></div>
          </div>
        </div>
        <div class="flex items-center gap-4 mb-6 text-xs font-bold">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>Card {globalCardPct}% · {formatCurrency(globalCardTotal)}</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>Cash {100 - globalCardPct}% · {formatCurrency(globalCashTotal)}</span>
        </div>
        <div class="space-y-3">
          {#each paymentMix as t (t.merchantId)}
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{t.type}</span>
                <span class="text-[10px] font-bold text-neutral-400 tabular-nums">Card {t.cardPct}%</span>
              </div>
              <div class="h-2 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-700 flex">
                <div class="h-full rounded-full transition-all duration-700" style={`width:${t.cardPct}%;background-color:${t.color}`}></div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Shift board -->
      <div class="lg:col-span-2 bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-100 dark:border-neutral-700/50 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-[20px] flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Who's On Shift</h3>
              <p class="text-neutral-400 text-sm font-medium">{shiftBoard.length} staff clocked in across {global_?.merchantCount ?? 0} locations</p>
            </div>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
            <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span class="text-[9px] font-black uppercase tracking-widest text-emerald-600">{global_?.activeShifts ?? 0} open shifts</span>
          </div>
        </div>
        {#if shiftBoard.length > 0}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {#each shiftBoard as s (s.shiftId || s.name + s.merchantId)}
              <div class="flex items-center gap-3 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-700/20 transition-all">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0" style={`background-color:${s.color}15;color:${s.color}`}>
                  {s.name?.[0] || '?'}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{s.name}</p>
                  <p class="text-[9px] font-bold text-neutral-400">{s.merchantType}</p>
                </div>
                <span class="text-[10px] font-black tabular-nums px-2 py-1 rounded-lg shrink-0" style={`background-color:${s.color}10;color:${s.color}`}>
                  {s.onShiftFor}
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="py-10 text-center opacity-40">
            <Users size={32} class="mx-auto mb-3 text-neutral-400" />
            <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">No open shifts right now</p>
          </div>
        {/if}
      </div>
    </div>

  {/if}
  <!-- end command view -->

  <!-- â”€â”€ MAP VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if activeView === 'map'}
    <div class="bg-white dark:bg-neutral-800/50 rounded-[36px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm h-[560px] sm:h-[640px] lg:h-[700px] relative">
      <div bind:this={mapEl} class="w-full h-full" style="height:100%;width:100%;border-radius:inherit" role="application" aria-label="Merchant location map"></div>

      <!-- Overlay info panel (collapsible so the map stays usable on small screens) -->
      <div class="absolute top-4 left-4 right-4 sm:right-auto sm:top-8 sm:left-8 sm:p-8 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-[32px] border border-white dark:border-neutral-700 shadow-2xl sm:max-w-sm flex flex-col max-h-[62%] sm:max-h-[calc(100%-4rem)]" style="z-index:1000">
        <div class="flex items-start justify-between gap-3 p-5 sm:p-0">
          <div class="min-w-0">
            <h3 class="text-xl font-black mb-1 tracking-tight dark:text-neutral-100">National Merchant Map</h3>
            <p class="text-neutral-500 text-sm font-medium leading-relaxed">Live merchant locations. Click a dot for merchant info.</p>
          </div>
          <button
            onclick={() => mapPanelOpen = !mapPanelOpen}
            class="shrink-0 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all"
            aria-expanded={mapPanelOpen}
            aria-label={mapPanelOpen ? 'Collapse merchant list' : 'Expand merchant list'}
            title={mapPanelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <ChevronRight size={16} class={`transition-transform ${mapPanelOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>
        {#if mapPanelOpen}
          {#if tenants.length === 0}
            <div class="px-5 pb-5 sm:p-0 sm:pt-6 overflow-y-auto custom-scrollbar space-y-3">
              <div role="status" class="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300 space-y-3">
                <p>No merchant data to plot. The map needs the dashboard feed — check your connection, then reload it.</p>
                <button
                  onclick={() => loadDashboard()}
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <RefreshCw size={12} /> Reload data
                </button>
              </div>
            </div>
          {/if}
          {#if tenants.length > 0}
            <div class="px-5 pb-5 sm:p-0 sm:pt-6 overflow-y-auto custom-scrollbar space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                  <WifiIcon size={16} />
                </div>
                <div>
                  <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">Merchant Sites</p>
                  <p class="text-[9px] font-black text-neutral-400 uppercase">{tenants.length} Merchants Active</p>
                </div>
              </div>
              <div class="pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-2">
                {#each tenants as t (t.merchantId)}
                  <button
                    onclick={() => { selectedNode = t.merchantId; markerById.get(t.merchantId)?.openPopup(); }}
                    aria-pressed={selectedNode === t.merchantId}
                    class={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                      selectedNode === t.merchantId
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'
                    }`}
                  >
                    <div
                      class="w-2.5 h-2.5 rounded-full shrink-0"
                      style={`background-color:${t.color};box-shadow:0 0 8px ${t.color}80`}></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[10px] font-black text-neutral-900 dark:text-neutral-100 truncate">{t.name}</p>
                      <p class="text-[8px] font-bold text-neutral-400">{t.type} &bull; R {Number(t.todaySales || 0).toLocaleString()} today</p>
                    </div>
                    <div class="w-12 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden shrink-0" role="img" aria-label={t.activeShifts > 0 ? 'Open now' : 'No active shift'}>
                      <div
                        class="h-full rounded-full"
                        style={`width:${Math.min(100, (t.activeShifts ?? 0) > 0 ? 100 : 0)}%;background-color:${t.color}`}
                      ></div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Bottom-right legend -->
      {#if tenants.length > 0}
      <div class="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 px-4 py-2.5 sm:px-5 sm:py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg max-w-[calc(100%-2rem)]" style="z-index:1000">
        <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
          {#each tenants as t (t.merchantId)}
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-full" style={`background-color:${t.color};box-shadow:0 0 8px ${t.color}80`}></div>
              <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{t.type}</span>
            </div>
          {/each}
        </div>
      </div>
      {/if}
    </div>
  {/if}

  <!-- â”€â”€ EXPORT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if showExportModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onclick={(e) => { if (e.target === e.currentTarget) showExportModal = false; }}>
      <div role="dialog" aria-modal="true" aria-label="Export report" class="bg-white dark:bg-neutral-900 rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Download size={20} />
            </div>
            <div>
              <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Export Report</h3>
              <p class="text-[10px] font-bold text-neutral-400">Cross-Tenant Intelligence Export</p>
            </div>
          </div>
          <button onclick={() => showExportModal = false} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <!-- Format selection -->
        <div class="space-y-2">
          <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Format</span>
          <div class="grid grid-cols-2 gap-3">
            <button
              onclick={() => exportFormat = 'csv'}
              class={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                exportFormat === 'csv'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
            >
              <FileSpreadsheet size={20} class={exportFormat === 'csv' ? 'text-emerald-600' : 'text-neutral-400'} />
              <div class="text-left">
                <p class={`text-sm font-black ${exportFormat === 'csv' ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-300'}`}>CSV</p>
                <p class="text-[9px] text-neutral-400">Spreadsheet format</p>
              </div>
            </button>
            <button
              onclick={() => exportFormat = 'pdf'}
              class={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                exportFormat === 'pdf'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
            >
              <FileText size={20} class={exportFormat === 'pdf' ? 'text-emerald-600' : 'text-neutral-400'} />
              <div class="text-left">
                <p class={`text-sm font-black ${exportFormat === 'pdf' ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-300'}`}>PDF</p>
                <p class="text-[9px] text-neutral-400">Executive report</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Date range -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
              <Calendar size={12} /> From
            </label>
            <input
              type="date"
              bind:value={exportDateFrom}
              class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl font-bold outline-none text-sm"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
              <Calendar size={12} /> To
            </label>
            <input
              type="date"
              bind:value={exportDateTo}
              class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl font-bold outline-none text-sm"
            />
          </div>
        </div>

        <!-- Tenant filter -->
        <div class="space-y-1">
          <label class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
            <Filter size={12} /> Tenant Filter
          </label>
          <select
            bind:value={exportTenant}
            class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl font-bold outline-none text-sm"
          >
            <option value="all">All Tenants</option>
            {#each tenants as t (t.merchantId)}
              <option value={t.merchantId}>{t.type} â€” {t.name}</option>
            {/each}
          </select>
        </div>

        <button
          onclick={handleExport}
          disabled={exporting || exportJobRunning}
          class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-[20px] font-black uppercase tracking-widest shadow-xl transition-all text-sm flex items-center justify-center gap-2"
        >
          {#if exporting}
            <Loader2 size={16} class="animate-spin" /> Generating...
          {:else}
            <Download size={16} /> Export {exportFormat.toUpperCase()}
          {/if}
        </button>
        <button
          onclick={handleQueuedExport}
          disabled={exporting || exportJobRunning}
          title="Large ranges run in the background via the job queue (RabbitMQ when configured) and download when ready"
          class="w-full py-3 border border-neutral-200 dark:border-neutral-700 rounded-[20px] font-black uppercase tracking-widest text-[11px] text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {#if exportJobRunning}
            <Loader2 size={14} class="animate-spin" /> Queued — preparing file…
          {:else}
            <Clock size={14} /> Queue in background
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- â”€â”€ DEVICE REGISTRY MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if showDevices}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={(e) => { if (e.target === e.currentTarget) showDevices = false; }}>
      <div role="dialog" aria-modal="true" aria-label="Device registry" class="bg-white dark:bg-neutral-900 rounded-[40px] p-8 shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100">Device Registry</h3>
            <p class="text-sm text-neutral-400 font-medium mt-1">Active devices & location tracking</p>
          </div>
          <button onclick={() => showDevices = false} class="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">
            <X size={20} class="text-neutral-400" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {#if loadingDevices}
            <div class="flex items-center justify-center py-12">
              <Loader2 size={32} class="animate-spin text-indigo-500" />
            </div>
          {:else if devices.length > 0}
            {#each devices as device, idx}
              <div class="bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-[24px] border border-neutral-200 dark:border-neutral-700">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Device Info -->
                  <div class="space-y-3">
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Device ID</p>
                      <p class="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">{device.deviceId}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">IP Address</p>
                      <p class="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">{device.ipAddress || 'Unknown'}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Browser</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{device.browser} {device.browserVersion}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Operating System</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{device.os} ({device.platform})</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Screen Resolution</p>
                      <p class="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">{device.screenResolution}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Timezone</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{device.timezone}</p>
                    </div>
                  </div>

                  <!-- Location & Additional Info -->
                  <div class="space-y-3">
                    {#if device.gpsCoordinates}
                      <div class="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
                        <div class="flex items-center gap-2 mb-3">
                          <MapPin size={16} class="text-emerald-600" />
                          <p class="text-[9px] font-black text-emerald-600 uppercase tracking-widest">GPS Location</p>
                        </div>
                        <div class="space-y-2">
                          <div>
                            <p class="text-[8px] font-bold text-emerald-600/70 uppercase tracking-widest">Latitude</p>
                            <p class="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">{device.gpsCoordinates.latitude?.toFixed(6)}</p>
                          </div>
                          <div>
                            <p class="text-[8px] font-bold text-emerald-600/70 uppercase tracking-widest">Longitude</p>
                            <p class="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">{device.gpsCoordinates.longitude?.toFixed(6)}</p>
                          </div>
                          {#if device.gpsCoordinates.accuracy}
                            <div>
                              <p class="text-[8px] font-bold text-emerald-600/70 uppercase tracking-widest">Accuracy</p>
                              <p class="text-sm font-bold text-emerald-700 dark:text-emerald-400">{device.gpsCoordinates.accuracy.toFixed(0)}m</p>
                            </div>
                          {/if}
                          {#if device.gpsCoordinates.altitude}
                            <div>
                              <p class="text-[8px] font-bold text-emerald-600/70 uppercase tracking-widest">Altitude</p>
                              <p class="text-sm font-bold text-emerald-700 dark:text-emerald-400">{device.gpsCoordinates.altitude.toFixed(0)}m</p>
                            </div>
                          {/if}
                          {#if device.gpsCoordinates.latitude && device.gpsCoordinates.longitude}
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${device.gpsCoordinates.latitude}&mlon=${device.gpsCoordinates.longitude}&zoom=15`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              <Navigation size={12} /> View on Map
                            </a>
                          {/if}
                        </div>
                      </div>
                    {:else if device.gpsError}
                      <div class="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                        <div class="flex items-center gap-2 mb-2">
                          <MapPin size={16} class="text-amber-600" />
                          <p class="text-[9px] font-black text-amber-600 uppercase tracking-widest">GPS Unavailable</p>
                        </div>
                        <p class="text-xs text-amber-700 dark:text-amber-400">{device.gpsError}</p>
                      </div>
                    {:else}
                      <div class="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                        <div class="flex items-center gap-2 mb-2">
                          <MapPin size={16} class="text-neutral-400" />
                          <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">No Location Data</p>
                        </div>
                        <p class="text-xs text-neutral-500">Location not captured</p>
                      </div>
                    {/if}

                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Connection</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{device.connectionType} â€¢ {device.online ? 'Online' : 'Offline'}</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Hardware</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{device.cores} cores â€¢ {device.memory || 'N/A'} GB RAM</p>
                    </div>
                    <div>
                      <p class="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Last Seen</p>
                      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{new Date(device.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="py-12 text-center opacity-30">
              <Monitor size={48} class="mx-auto mb-4 text-neutral-400" />
              <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">No devices registered</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

</div>
{/if}

<style>
  .dashboard-shell {
    min-height: 100%;
    background: radial-gradient(circle at 0% 0%, rgba(99, 102, 241, .08), transparent 32rem), radial-gradient(circle at 100% 12%, rgba(16, 185, 129, .05), transparent 28rem);
  }

  .dashboard-shell :global(.rounded-\[40px\]) { border-radius: 1.75rem; }
  .dashboard-shell :global(.rounded-\[28px\]) { border-radius: 1.4rem; }
  .dashboard-shell :global(.shadow-\[0_8px_30px_rgba\(0\,0\,0\,0\.02\)\]) { box-shadow: 0 14px 36px rgba(15, 23, 42, .06); }
  .dashboard-shell :global(button) { min-height: 2.75rem; }
  .dashboard-shell :global(button:focus-visible),
  .dashboard-shell :global(a:focus-visible),
  .dashboard-shell :global(input:focus-visible),
  .dashboard-shell :global(select:focus-visible) {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }
  .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, .5) transparent; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, .5); border-radius: 999px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .skeleton-shimmer {
    background: linear-gradient(90deg, rgba(148, 163, 184, .18) 25%, rgba(148, 163, 184, .32) 50%, rgba(148, 163, 184, .18) 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .refreshing-slide { animation: refreshing-slide 1.1s ease-in-out infinite; }
  @keyframes refreshing-slide {
    0% { margin-left: -33%; }
    100% { margin-left: 100%; }
  }
  @media (max-width: 640px) {
    .dashboard-shell :global(.p-8) { padding: 1.25rem; }
    .dashboard-shell :global(.text-3xl), .dashboard-shell :global(.text-4xl) { font-size: 1.65rem; line-height: 1.1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton-shimmer { animation: none; }
    .dashboard-shell :global(.animate-pulse),
    .dashboard-shell :global(.animate-spin) { animation-duration: 2s; }
  }
</style>
