<script lang="ts">
  import {
    Globe,
    Map as MapIcon,
    Activity as ActivityIcon,
    Package as PackageIcon,
    DollarSign,
    ChevronRight,
    Target,
    X,
    CheckCircle2,
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
    Signal,
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
  let activeView   = $state<'command' | 'map' | 'roadmap'>('command');
  let loading      = $state(true);
  let refreshing   = $state(false);
  let dashData     = $state<any>(null);
  let selectedTenant = $state<string | null>(null);
  let selectedNode   = $state<number | null>(null);
  let showTargetModal = $state(false);

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

  // Target modal data
  let targetData = $state({ store: '', monthlyTarget: '', category: 'General' });

  // Roadmap (static)
  const roadmap = [
    { phase: 'Phase 1: Foundation', time: 'Now - 6 months',   goals: ['Core POS', '5 Pilot Stores', 'Basic Reporting', '20 Clients'],                              status: 'Current'  },
    { phase: 'Phase 2: Scale',      time: '7 - 12 months',    goals: ['Mobile POS App', 'Supplier Portal', 'Advanced Analytics', '100 Stores'],                   status: 'Upcoming' },
    { phase: 'Phase 3: Expand',     time: '13 - 18 months',   goals: ['Loyalty Program', 'E-commerce Sync', 'International Expansion', '250 Stores'],              status: 'Future'   },
    { phase: 'Phase 4: Dominate',   time: '19 - 24 months',   goals: ['AI Inventory Prediction', 'Marketplace Integrations', 'Franchise Platform', '500+ Stores'], status: 'Vision'   },
  ];

  const nodes = [
    { id: 1, name: 'Sandton Hub',      status: 'Online',  load: 82, lat: -26.1076, lng: 28.0567 },
    { id: 2, name: 'Cape Town Port',   status: 'Online',  load: 45, lat: -33.9249, lng: 18.4241 },
    { id: 3, name: 'Durban Terminal',  status: 'Warning', load: 94, lat: -29.8587, lng: 31.0218 },
    { id: 4, name: 'Pretoria HQ',      status: 'Online',  load: 12, lat: -25.7479, lng: 28.2293 },
  ];

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
      if (!silent) loading = true;
      else refreshing = true;

      const data = await api.getAdminDashboard();
      if (data && !data.error) {
        dashData = data;
      } else {
        if (!silent) toast.error('Failed to load cross-tenant data');
      }
    } catch (e) {
      console.error('[ExecDash] Load error:', e);
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

  // â”€â”€ Initial load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  $effect(() => {
    loadDashboard();
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      nodes.forEach(node => {
        const isOnline = node.status === 'Online';
        const markerIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${isOnline ? '#4f46e5' : '#f59e0b'};
            border:4px solid white;
            box-shadow:0 0 20px ${isOnline ? 'rgba(99,102,241,0.6)' : 'rgba(245,158,11,0.6)'},0 0 40px ${isOnline ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'};
            cursor:pointer;transition:transform 0.2s;
          "></div>`,
          iconSize:    [32, 32],
          iconAnchor:  [16, 16],
          popupAnchor: [0, -20],
        });

        const marker = L.marker([node.lat, node.lng], { icon: markerIcon }).addTo(map);
        marker.bindPopup(`
          <div style="padding:8px;min-width:200px;font-family:'JetBrains Mono',monospace">
            <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${isOnline ? '#4f46e5' : '#f59e0b'};margin-bottom:4px">
              ${node.status}
            </p>
            <h4 style="font-size:16px;font-weight:900;color:#171717;margin-bottom:12px">
              ${node.name}
            </h4>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:900;text-transform:uppercase;color:#737373;margin-bottom:6px">
                <span>Current Load</span><span>${node.load}%</span>
              </div>
              <div style="height:6px;background:#f5f5f5;border-radius:999px;overflow:hidden">
                <div style="height:100%;background:${node.load > 90 ? '#ef4444' : node.load > 70 ? '#f59e0b' : '#4f46e5'};width:${node.load}%;border-radius:999px;transition:width 0.5s"></div>
              </div>
              <p style="font-size:9px;color:#a3a3a3;margin-top:6px">
                Latency: ${node.load < 50 ? '12ms' : node.load < 80 ? '28ms' : '45ms'} &bull; Uptime: 99.${node.load < 90 ? '99' : '87'}%
              </p>
            </div>
          </div>
        `);
        marker.on('click', () => {
          selectedNode = selectedNode === node.id ? null : node.id;
        });
      });

      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (leafletMapInstance) {
        leafletMapInstance.remove();
        leafletMapInstance = null;
      }
    };
  });

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  function handleSetTarget() {
    toast.success(`Sales target of R ${parseFloat(targetData.monthlyTarget).toLocaleString()} set for ${targetData.store}.`);
    showTargetModal = false;
  }
</script>

<!-- â”€â”€ Loading splash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{#if loading && !dashData}
  <div class="flex h-full items-center justify-center p-20">
    <div class="text-center space-y-4">
      <Loader2 size={32} class="animate-spin text-indigo-500 mx-auto" />
      <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Aggregating Cross-Tenant Intelligence...</p>
    </div>
  </div>
{:else}
<div class="dashboard-shell p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-700 max-w-[1800px] mx-auto">

  <!-- â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <Globe size={16} class="text-indigo-500" />
        <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500">Clinton's Command Centre</span>
        {#if refreshing}
          <Loader2 size={12} class="animate-spin text-indigo-400" />
        {/if}
      </div>
      <h2 class="text-3xl lg:text-4xl font-black tracking-tighter dark:text-neutral-100">Cross-Tenant Intelligence</h2>
      <p class="text-neutral-500 font-medium text-sm mt-0.5">
        Real-time aggregation across {global_?.merchantCount ?? 4} tenants &bull; {global_?.activeShifts ?? 0} staff on shift
        {#if dashData?.generatedAt}
          <span class="text-neutral-400 ml-2 text-xs">Updated {timeAgo(dashData.generatedAt)}</span>
        {/if}
      </p>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <!-- View switcher -->
      <div class="flex bg-white dark:bg-neutral-800 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        {#each [{ key: 'command', label: 'Command' }, { key: 'map', label: 'Node Map' }, { key: 'roadmap', label: 'Roadmap' }] as v}
          <button
            onclick={() => activeView = v.key as any}
            class={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeView === v.key ? 'bg-neutral-900 dark:bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {v.label}
          </button>
        {/each}
      </div>

      <button
        onclick={() => loadDashboard(true)}
        class="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-500 hover:text-indigo-600 transition-all"
        title="Refresh data"
      >
        <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
      </button>

      <button
        onclick={async () => {
          const res = await api.seed();
          if (res.success) { toast.success('System re-seeded'); loadDashboard(); }
        }}
        class="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
      >
        Sync Cloud
      </button>

      <button
        onclick={() => showExportModal = true}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
      >
        <Download size={14} /> Export
      </button>

      <!-- SSE toggle -->
      <button
        onclick={() => sseEnabled = !sseEnabled}
        class={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
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
        onclick={() => showTargetModal = true}
        class="flex items-center gap-2 px-5 py-2.5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all bg-indigo-600 hover:bg-indigo-700"
      >
        <Target size={14} /> Set Targets
      </button>

      <button
        onclick={() => { loadDevices(); showDevices = true; }}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
      >
        <Monitor size={14} /> Devices
      </button>
    </div>
  </div>

  <!-- â”€â”€ COMMAND VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if activeView === 'command'}

    <!-- Tenant Profile Strip -->
    <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onclick={() => selectedTenant = null}
        class={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
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
          class={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
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

    <!-- Global KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {#each [
        {
          label: selectedTenant ? `${focusTenant?.type} Sales`        : 'Global Revenue',
          value: formatCurrency(selectedTenant ? (focusTenant?.totalSales   || 0) : (global_?.totalSales   || 0)),
          sub:   `Today: ${formatCurrency(selectedTenant ? (focusTenant?.todaySales || 0) : (global_?.todaySales || 0))}`,
          icon: DollarSign,  color: '#6366f1', trend: '+12.4%',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Transactions` : 'Total Volume',
          value: selectedTenant ? (focusTenant?.allTimeTxCount || 0).toLocaleString() : (global_?.totalTransactions || 0).toLocaleString(),
          sub:   `Today: ${selectedTenant ? (focusTenant?.todayTxCount || 0) : (global_?.todayTransactions || 0)} txns`,
          icon: ShoppingBag, color: '#10b981', trend: '+5.2%',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Stock Value`  : 'Portfolio Asset Value',
          value: formatCurrency(selectedTenant ? (focusTenant?.stockValue   || 0) : (global_?.stockValue   || 0)),
          sub:   `${selectedTenant ? (focusTenant?.lowStockCount || 0) : (global_?.lowStockAlerts || 0)} low-stock alerts`,
          icon: PackageIcon, color: '#f97316', trend: 'Healthy',
        },
        {
          label: selectedTenant ? `${focusTenant?.type} Staff`        : 'Operational Capacity',
          value: selectedTenant ? (focusTenant?.activeShifts || 0).toString() : (global_?.activeShifts || 0).toString(),
          sub:   selectedTenant ? `Avg basket: ${formatCurrency(focusTenant?.avgBasket || 0)}` : 'Nodes active across region',
          icon: Users,       color: '#8b5cf6', trend: 'Active',
        },
      ] as stat, i}
        <div
          class="bg-white dark:bg-neutral-900 p-8 rounded-[40px] border border-neutral-200 dark:border-neutral-800 shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div class="flex items-center justify-between mb-6">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all border border-neutral-100 dark:border-neutral-700/50"
              style={`background-color:${stat.color}10;color:${stat.color}`}
            >
              <stat.icon size={24} />
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 uppercase tracking-widest">
              {stat.trend}
            </div>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
          <h4 class="text-3xl lg:text-4xl font-black tracking-tighter text-neutral-900 dark:text-white font-mono tabular-nums">{stat.value}</h4>
          <div class="mt-6 pt-5 border-t border-neutral-50 dark:border-neutral-800">
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
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-black tracking-tight dark:text-neutral-100">Cross-Tenant Audit Trail</h3>
            <p class="text-neutral-400 text-xs font-medium">Real-time forensic events from all merchants</p>
          </div>
          <div class="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
            <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live Sync</span>
          </div>
        </div>
        <div class="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
          {#if recentAudit.length > 0}
            {#each recentAudit as evt, i (evt.id ?? i)}
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
              <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">No audit events â€” system clean</p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Infrastructure Health -->
    <div class="bg-white dark:bg-neutral-800/50 p-8 rounded-[36px] border border-neutral-200 dark:border-neutral-700/50 shadow-sm">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-[20px] flex items-center justify-center">
            <ActivityIcon size={24} />
          </div>
          <div>
            <h3 class="text-xl font-black dark:text-neutral-100">National Infrastructure Health</h3>
            <p class="text-neutral-400 text-sm font-medium">Real-time latency & sync integrity across all clusters</p>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-700/50 rounded-xl border border-neutral-100 dark:border-neutral-600">
            <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span class="text-[9px] font-black uppercase tracking-widest text-neutral-500">Global Sync: 100%</span>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        {#each [
          { label: 'SLA Compliance',    value: '99.98%',                              pct: 99,  colorHex: '#10b981', desc: 'System uptime within Tier 1 SLA parameters.' },
          { label: 'Failover Activity', value: `${global_?.merchantCount ?? 4} Active Nodes`, pct: 15,  colorHex: '#f59e0b', desc: 'Teltonika 5G failovers operational. Sync integrity maintained.' },
          { label: 'Security Audit',    value: 'Secure',                              pct: 100, colorHex: '#6366f1', desc: 'End-to-end encryption layers fully operational.' },
          { label: 'Data Pipeline',     value: `${global_?.totalTransactions ?? 0} Events`,   pct: 78,  colorHex: '#f43f5e', desc: 'Cross-tenant event bus processing at nominal throughput.' },
        ] as metric, i}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{metric.label}</span>
              <span class="text-xs font-black" style={`color:${metric.colorHex}`}>{metric.value}</span>
            </div>
            <div class="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-1000" style={`width:${metric.pct}%;background-color:${metric.colorHex}`}></div>
            </div>
            <p class="text-[9px] text-neutral-400 leading-relaxed">{metric.desc}</p>
          </div>
        {/each}
      </div>
    </div>

  {/if}
  <!-- end command view -->

  <!-- â”€â”€ MAP VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if activeView === 'map'}
    <div class="bg-white dark:bg-neutral-800/50 rounded-[36px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm h-[700px] relative">
      <div bind:this={mapEl} class="w-full h-full" style="height:100%;width:100%;border-radius:inherit"></div>

      <!-- Overlay info panel -->
      <div class="absolute top-8 left-8 p-8 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-[32px] border border-white dark:border-neutral-700 shadow-2xl max-w-sm" style="z-index:1000">
        <h3 class="text-xl font-black mb-1 tracking-tight dark:text-neutral-100">National Node Matrix</h3>
        <p class="text-neutral-500 text-sm font-medium leading-relaxed mb-6">Live traffic routing through regional Teltonika-X gateways via OpenStreetMap.</p>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
              <WifiIcon size={16} />
            </div>
            <div>
              <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">Primary Uplinks</p>
              <p class="text-[9px] font-black text-neutral-400 uppercase">{global_?.merchantCount ?? 4} Nodes Active</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
              <Database size={16} />
            </div>
            <div>
              <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">GPRS Failover</p>
              <p class="text-[9px] font-black text-neutral-400 uppercase">0 Nodes Switched</p>
            </div>
          </div>

          <!-- Node status list -->
          <div class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-2">
            {#each nodes as node (node.id)}
              <button
                onclick={() => selectedNode = selectedNode === node.id ? null : node.id}
                class={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                  selectedNode === node.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'
                }`}
              >
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style={`background-color:${node.status === 'Online' ? '#10b981' : '#f59e0b'};box-shadow:0 0 8px ${node.status === 'Online' ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)'}`}></div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-black text-neutral-900 dark:text-neutral-100 truncate">{node.name}</p>
                  <p class="text-[8px] font-bold text-neutral-400">{node.status} &bull; {node.load}% load</p>
                </div>
                <div class="w-12 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden shrink-0">
                  <div
                    class="h-full rounded-full"
                    style={`width:${node.load}%;background-color:${node.load > 90 ? '#ef4444' : node.load > 70 ? '#f59e0b' : '#10b981'}`}
                  ></div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Bottom-right legend -->
      <div class="absolute bottom-8 right-8 px-5 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg" style="z-index:1000">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <div class="w-3 h-3 rounded-full bg-indigo-600" style="box-shadow:0 0 8px rgba(99,102,241,0.5)"></div>
            <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Online</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-3 h-3 rounded-full bg-amber-500" style="box-shadow:0 0 8px rgba(245,158,11,0.5)"></div>
            <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Warning</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-500" style="box-shadow:0 0 8px rgba(239,68,68,0.5)"></div>
            <span class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Offline</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- â”€â”€ ROADMAP VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if activeView === 'roadmap'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {#each roadmap as item, i}
        <div class="bg-white dark:bg-neutral-800 p-10 rounded-[36px] border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden group hover:border-indigo-600 transition-all">
          <div class="relative z-10">
            <div class="flex justify-between items-start mb-8">
              <div>
                <h4 class="text-xl font-black tracking-tight mb-1 dark:text-neutral-100">{item.phase}</h4>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">{item.time}</p>
              </div>
              <span class={`px-3 py-1.5 rounded-2xl text-[8px] font-black uppercase tracking-widest ${item.status === 'Current' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400'}`}>
                {item.status}
              </span>
            </div>
            <div class="space-y-3">
              {#each item.goals as goal}
                <div class="flex items-center gap-3">
                  <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span class="text-sm font-bold text-neutral-700 dark:text-neutral-300">{goal}</span>
                </div>
              {/each}
            </div>
          </div>
          <div class="absolute -bottom-8 -right-8 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/10 transition-colors"></div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- â”€â”€ TARGET MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if showTargetModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[32px] p-8 max-w-xl w-full shadow-2xl space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black tracking-tight dark:text-neutral-100">Set Sales Targets</h3>
          <button onclick={() => showTargetModal = false} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label for="target-store" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Tenant / Store</label>
            <select
              id="target-store"
              bind:value={targetData.store}
              class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl font-bold outline-none text-sm"
            >
              <option value="">Select Tenant</option>
              {#each tenants as t (t.merchantId)}
                <option value={t.name}>{t.type} â€” {t.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label for="target-category" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Category</label>
            <select
              id="target-category"
              bind:value={targetData.category}
              class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl font-bold outline-none text-sm"
            >
              <option value="General">General Sales</option>
              <option value="Fuel">Fuel (Litres)</option>
              <option value="Workshop">Service Hours</option>
              <option value="Food">Food Revenue</option>
            </select>
          </div>
          <div class="col-span-2 space-y-1">
            <label for="target-monthly" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Monthly Target (ZAR)</label>
            <input
              id="target-monthly"
              type="number"
              placeholder="R 0.00"
              bind:value={targetData.monthlyTarget}
              class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-black text-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all"
            />
          </div>
        </div>
        <div class="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center gap-3">
          <CheckCircle2 size={24} class="text-indigo-600 shrink-0" />
          <p class="text-[10px] font-medium text-indigo-900 dark:text-indigo-300 leading-relaxed">
            Targets are pushed in real-time to the branch manager's dashboard.
          </p>
        </div>
        <button
          onclick={handleSetTarget}
          class="w-full py-4 bg-neutral-900 dark:bg-indigo-600 text-white rounded-[20px] font-black uppercase tracking-widest shadow-xl hover:bg-neutral-800 dark:hover:bg-indigo-700 transition-all text-sm"
        >
          Push Targets to Hub
        </button>
      </div>
    </div>
  {/if}

  <!-- â”€â”€ EXPORT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if showExportModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div class="bg-white dark:bg-neutral-900 rounded-[32px] p-8 max-w-lg w-full shadow-2xl space-y-6">
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
          disabled={exporting}
          class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-[20px] font-black uppercase tracking-widest shadow-xl transition-all text-sm flex items-center justify-center gap-2"
        >
          {#if exporting}
            <Loader2 size={16} class="animate-spin" /> Generating...
          {:else}
            <Download size={16} /> Export {exportFormat.toUpperCase()}
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- â”€â”€ DEVICE REGISTRY MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  {#if showDevices}
    <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-neutral-900 rounded-[40px] p-8 shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
  @media (max-width: 640px) {
    .dashboard-shell :global(.p-8) { padding: 1.25rem; }
    .dashboard-shell :global(.text-3xl), .dashboard-shell :global(.text-4xl) { font-size: 1.65rem; line-height: 1.1; }
  }
</style>
