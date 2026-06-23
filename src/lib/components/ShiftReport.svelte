<script lang="ts">
  import {
    X, Clock, CreditCard, Banknote, ShoppingCart, TrendingUp, BarChart3,
    AlertTriangle, Tag, Zap, Hash, ArrowUpRight,
    ArrowDownLeft, Loader2, Printer, Download, FileText
  } from 'lucide-svelte';
  import { fade, fly, scale } from 'svelte/transition';
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
  let activeSection = $state<'summary' | 'transactions' | 'hourly'>('summary');
  let pdfGenerating = $state(false);

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

  $effect(() => {
    loadReport();
  });

  async function loadReport() {
    try {
      loading = true;
      const cleanId = shiftId.startsWith('shift:') ? shiftId.replace('shift:', '') : shiftId;
      const result = await api.getShiftReport(cleanId);
      if (result && !result.error) {
        data = result;
      }
    } catch (e) {
      console.error('Failed to load shift report:', e);
    } finally {
      loading = false;
    }
  }

  function handlePrint() {
    if (!data) return;
    const w = window.open('', '_blank', 'width=320,height=800');
    if (!w) {
      toast.error('Popup blocked. Please allow popups for this site to print.');
      return;
    }
    const dur = formatDuration(data.shift.startTime, data.shift.endTime);
    const txnRows = data.transactionList.map((tx: any) =>
      `<tr><td style="font-size:9px;padding:2px 0">${(tx.id || '').substring(0, 16)}</td><td style="font-size:9px;text-align:right;padding:2px 0">R ${(tx.amount || 0).toFixed(2)}</td></tr>`
    ).join('');
    const hourlyRows = hourlyData.map(h =>
      `<tr><td style="font-size:9px;padding:1px 0">${h.hour}</td><td style="font-size:9px;text-align:center">${h.count}</td><td style="font-size:9px;text-align:right">R ${h.total.toFixed(0)}</td></tr>`
    ).join('');

    w.document.write(`<!DOCTYPE html><html><head><title>Shift Report</title>
      <style>
        @media print { body { margin: 0; } }
        body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 16px; color: #111; font-size: 10px; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #999; margin: 8px 0; }
        .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .big { font-size: 18px; font-weight: 900; }
        .torn-top, .torn-bottom { height: 8px; background: repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 8px 8px; }
      </style>
    </head><body>
      <div class="torn-top"></div>
      <div class="center bold" style="font-size:14px;letter-spacing:3px;margin:8px 0">ROXTON POS</div>
      <div class="center" style="font-size:9px;letter-spacing:2px;color:#666">END-OF-SHIFT REPORT</div>
      <div class="divider"></div>
      <div class="row"><span>Operator:</span><span class="bold">${data.shift.userName || 'Unknown'}</span></div>
      <div class="row"><span>Date:</span><span>${new Date(data.shift.startTime).toLocaleDateString()}</span></div>
      <div class="row"><span>Clock In:</span><span>${new Date(data.shift.startTime).toLocaleTimeString()}</span></div>
      <div class="row"><span>Clock Out:</span><span>${data.shift.endTime ? new Date(data.shift.endTime).toLocaleTimeString() : 'ACTIVE'}</span></div>
      <div class="row"><span>Duration:</span><span class="bold">${dur}</span></div>
      <div class="divider"></div>
      <div class="center bold" style="letter-spacing:2px;margin-bottom:4px">SUMMARY</div>
      <div class="row"><span>Total Sales:</span><span class="big">R ${data.totalSales.toFixed(2)}</span></div>
      <div class="row"><span>Transactions:</span><span class="bold">${data.transactions}</span></div>
      <div class="row"><span>Items Sold:</span><span class="bold">${data.totalItems}</span></div>
      <div class="row"><span>Avg Basket:</span><span>R ${data.transactions > 0 ? (data.totalSales / data.transactions).toFixed(2) : '0.00'}</span></div>
      <div class="divider"></div>
      <div class="center bold" style="letter-spacing:2px;margin-bottom:4px">PAYMENTS</div>
      <div class="row"><span>Card:</span><span>R ${data.cardSales.toFixed(2)}</span></div>
      <div class="row"><span>Cash:</span><span>R ${data.cashSales.toFixed(2)}</span></div>
      ${data.totalChange > 0 ? `<div class="row"><span>Change Given:</span><span>R ${data.totalChange.toFixed(2)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="center bold" style="letter-spacing:2px;margin-bottom:4px">DISCOUNTS</div>
      <div class="row"><span>Promo Savings:</span><span>R ${data.promoSavings.toFixed(2)}</span></div>
      <div class="row"><span>Loyalty Redeemed:</span><span>R ${data.loyaltyRedeemed.toFixed(2)}</span></div>
      ${hourlyRows ? `
        <div class="divider"></div>
        <div class="center bold" style="letter-spacing:2px;margin-bottom:4px">HOURLY BREAKDOWN</div>
        <table><tr><th style="text-align:left;font-size:8px">HOUR</th><th style="text-align:center;font-size:8px">TXN</th><th style="text-align:right;font-size:8px">TOTAL</th></tr>${hourlyRows}</table>
      ` : ''}
      ${txnRows ? `
        <div class="divider"></div>
        <div class="center bold" style="letter-spacing:2px;margin-bottom:4px">TRANSACTIONS</div>
        <table><tr><th style="text-align:left;font-size:8px">ID</th><th style="text-align:right;font-size:8px">AMOUNT</th></tr>${txnRows}</table>
      ` : ''}
      <div class="divider"></div>
      <div class="center" style="font-size:8px;color:#999;letter-spacing:1px">${shiftId}</div>
      <div class="center" style="font-size:8px;color:#999;margin-top:4px">Printed: ${new Date().toLocaleString()}</div>
      <div class="torn-bottom" style="margin-top:8px"></div>
      ${'<script>'}window.onload=function(){window.print()}${'</' + 'script>'}
    </body></html>`);
    w.document.close();
  }

  function handleExportCSV() {
    if (!data) return;
    const lines: string[] = [];
    lines.push('ROXTON POS - SHIFT REPORT');
    lines.push(`Operator,${data.shift.userName || 'Unknown'}`);
    lines.push(`Date,${new Date(data.shift.startTime).toLocaleDateString()}`);
    lines.push(`Clock In,${new Date(data.shift.startTime).toLocaleTimeString()}`);
    lines.push(`Clock Out,${data.shift.endTime ? new Date(data.shift.endTime).toLocaleTimeString() : 'Active'}`);
    lines.push(`Duration,${formatDuration(data.shift.startTime, data.shift.endTime)}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Total Sales,R ${data.totalSales.toFixed(2)}`);
    lines.push(`Transactions,${data.transactions}`);
    lines.push(`Items Sold,${data.totalItems}`);
    lines.push(`Avg Basket,R ${data.transactions > 0 ? (data.totalSales / data.transactions).toFixed(2) : '0.00'}`);
    lines.push(`Card Sales,R ${data.cardSales.toFixed(2)}`);
    lines.push(`Cash Sales,R ${data.cashSales.toFixed(2)}`);
    lines.push(`Change Dispensed,R ${data.totalChange.toFixed(2)}`);
    lines.push(`Promo Savings,R ${data.promoSavings.toFixed(2)}`);
    lines.push(`Loyalty Redeemed,R ${data.loyaltyRedeemed.toFixed(2)}`);
    lines.push('');
    if (hourlyData.length > 0) {
      lines.push('HOURLY BREAKDOWN');
      lines.push('Hour,Transactions,Total');
      hourlyData.forEach(h => lines.push(`${h.hour},${h.count},R ${h.total.toFixed(2)}`));
      lines.push('');
    }
    if (data.transactionList.length > 0) {
      lines.push('TRANSACTION LOG');
      lines.push('ID,Method,Items,Amount,Time');
      data.transactionList.forEach((tx: any) => {
        lines.push(`${tx.id || ''},${tx.method || ''},${tx.items?.length || 0},R ${(tx.amount || 0).toFixed(2)},${new Date(tx.date || tx.time).toLocaleTimeString()}`);
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-report-${new Date(data.shift.startTime).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF() {
    if (!data || pdfGenerating) return;
    pdfGenerating = true;

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:595px;padding:40px;background:#fff;font-family:Courier New,monospace;color:#111;font-size:11px;line-height:1.4;';

    const dur = formatDuration(data.shift.startTime, data.shift.endTime);
    const cardPct = data.totalSales > 0 ? Math.round((data.cardSales / data.totalSales) * 100) : 0;
    const cashPct = data.totalSales > 0 ? Math.round((data.cashSales / data.totalSales) * 100) : 0;

    const txnRows = data.transactionList.slice(0, 30).map((tx: any) =>
      `<tr>
        <td style="padding:3px 0;font-size:9px;border-bottom:1px solid #eee">${(tx.id || '').substring(0, 20)}</td>
        <td style="padding:3px 0;font-size:9px;text-align:center;border-bottom:1px solid #eee">${tx.method || '-'}</td>
        <td style="padding:3px 0;font-size:9px;text-align:center;border-bottom:1px solid #eee">${tx.items?.length || 0}</td>
        <td style="padding:3px 0;font-size:9px;text-align:right;border-bottom:1px solid #eee">R ${(tx.amount || 0).toFixed(2)}</td>
      </tr>`
    ).join('');

    const hourlyRows = hourlyData.map(h =>
      `<tr>
        <td style="padding:2px 0;font-size:9px">${h.hour}</td>
        <td style="padding:2px 0;font-size:9px;text-align:center">${h.count}</td>
        <td style="padding:2px 0;font-size:9px;text-align:right">R ${h.total.toFixed(2)}</td>
      </tr>`
    ).join('');

    const kpiBox = (label: string, value: string) =>
      `<div style="flex:1;border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:8px;color:#999;text-transform:uppercase;letter-spacing:1px">${label}</div>
        <div style="font-size:22px;font-weight:900;margin-top:4px">${value}</div>
      </div>`;

    const infoRow = (label: string, value: string) =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#666">${label}</span><span style="font-weight:bold">${value}</span></div>`;

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:20px;font-weight:900;letter-spacing:4px;margin-bottom:4px">ROXTON POS</div>
        <div style="font-size:10px;letter-spacing:2px;color:#666">END-OF-SHIFT REPORT</div>
        <div style="font-size:9px;color:#999;margin-top:2px">Generated ${new Date().toLocaleString()}</div>
      </div>
      <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;background:#fafafa">
        ${infoRow('Operator', data.shift.userName || 'Unknown')}
        ${infoRow('Date', new Date(data.shift.startTime).toLocaleDateString())}
        ${infoRow('Clock In', new Date(data.shift.startTime).toLocaleTimeString())}
        ${infoRow('Clock Out', data.shift.endTime ? new Date(data.shift.endTime).toLocaleTimeString() : 'ACTIVE')}
        ${infoRow('Duration', dur)}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        ${kpiBox('Total Sales', `R ${data.totalSales.toFixed(2)}`)}
        ${kpiBox('Transactions', `${data.transactions}`)}
        ${kpiBox('Items Sold', `${data.totalItems}`)}
      </div>
      <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;font-weight:bold">Payment Breakdown</div>
        ${infoRow(`Card Payments (${cardPct}%)`, `R ${data.cardSales.toFixed(2)}`)}
        ${infoRow(`Cash Payments (${cashPct}%)`, `R ${data.cashSales.toFixed(2)}`)}
        ${data.totalChange > 0 ? infoRow('Change Dispensed', `R ${data.totalChange.toFixed(2)}`) : ''}
        <div style="background:#eee;height:8px;border-radius:4px;overflow:hidden;display:flex;margin-top:8px">
          <div style="background:#6366f1;height:100%;width:${cardPct}%"></div>
          <div style="background:#10b981;height:100%;width:${cashPct}%"></div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:8px;color:#999;text-transform:uppercase;letter-spacing:1px">Avg Basket</div>
          <div style="font-size:16px;font-weight:900;margin-top:4px">R ${data.transactions > 0 ? (data.totalSales / data.transactions).toFixed(2) : '0.00'}</div>
        </div>
        <div style="flex:1;border:1px solid #d97706;border-radius:8px;padding:12px;text-align:center;background:#fffbeb">
          <div style="font-size:8px;color:#92400e;text-transform:uppercase;letter-spacing:1px">Promo Savings</div>
          <div style="font-size:16px;font-weight:900;color:#d97706;margin-top:4px">R ${data.promoSavings.toFixed(2)}</div>
        </div>
        <div style="flex:1;border:1px solid #e11d48;border-radius:8px;padding:12px;text-align:center;background:#fff1f2">
          <div style="font-size:8px;color:#9f1239;text-transform:uppercase;letter-spacing:1px">Loyalty Redeemed</div>
          <div style="font-size:16px;font-weight:900;color:#e11d48;margin-top:4px">R ${data.loyaltyRedeemed.toFixed(2)}</div>
        </div>
      </div>
      ${hourlyRows ? `
        <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px">
          <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:bold">Hourly Breakdown</div>
          <table style="width:100%;border-collapse:collapse">
            <tr><th style="text-align:left;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">HOUR</th><th style="text-align:center;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">TXN</th><th style="text-align:right;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">TOTAL</th></tr>
            ${hourlyRows}
          </table>
        </div>
      ` : ''}
      ${txnRows ? `
        <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px">
          <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:bold">Transaction Log (${data.transactionList.length})</div>
          <table style="width:100%;border-collapse:collapse">
            <tr><th style="text-align:left;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">ID</th><th style="text-align:center;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">METHOD</th><th style="text-align:center;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">ITEMS</th><th style="text-align:right;font-size:8px;padding-bottom:4px;border-bottom:1px solid #ddd">AMOUNT</th></tr>
            ${txnRows}
          </table>
        </div>
      ` : ''}
      <div style="text-align:center;color:#bbb;font-size:8px;margin-top:16px">
        <div style="letter-spacing:1px">${shiftId}</div>
        <div style="margin-top:4px">ROXTON POS Archival Compliance Document</div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scaledHeight = (imgHeight * pdfWidth) / imgWidth;

      if (scaledHeight <= pdfPageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, scaledHeight);
      } else {
        const pageCanvasHeight = Math.floor((pdfPageHeight / pdfWidth) * imgWidth);
        let srcY = 0;
        let page = 0;
        while (srcY < imgHeight) {
          const sliceHeight = Math.min(pageCanvasHeight, imgHeight - srcY);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sliceHeight;
          const pCtx = pageCanvas.getContext('2d');
          if (pCtx) {
            pCtx.drawImage(canvas, 0, srcY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
            const pageImg = pageCanvas.toDataURL('image/png');
            if (page > 0) pdf.addPage();
            const sliceScaledHeight = (sliceHeight * pdfWidth) / imgWidth;
            pdf.addImage(pageImg, 'PNG', 0, 0, pdfWidth, sliceScaledHeight);
          }
          srcY += pageCanvasHeight;
          page++;
        }
      }

      pdf.save(`shift-report-${new Date(data.shift.startTime).toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      toast.error('PDF generation failed. Try printing instead.');
    } finally {
      document.body.removeChild(container);
      pdfGenerating = false;
    }
  }
</script>

{#if loading}
  <div class="fixed inset-0 z-[600] bg-black/90 backdrop-blur-xl flex items-center justify-center">
    <div class="text-center text-white">
      <Loader2 class="w-10 h-10 animate-spin mx-auto mb-4 text-amber-400" />
      <p class="text-[10px] font-black uppercase tracking-widest text-white/40">Compiling Shift Report...</p>
    </div>
  </div>
{:else if !data}
  <div class="fixed inset-0 z-[600] bg-black/90 backdrop-blur-xl flex items-center justify-center">
    <div transition:scale={{start: 0.9, duration: 200}} class="bg-neutral-900 p-10 rounded-3xl text-center text-white max-w-sm w-full border border-white/10">
      <AlertTriangle class="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h3 class="text-sm font-black uppercase tracking-widest mb-2">No Report Data</h3>
      <p class="text-xs text-white/40 mb-6">No transactions found for this shift period.</p>
      <button onclick={onClose} class="px-6 py-3 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest">Close</button>
    </div>
  </div>
{:else}
  <div class="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
    <div
      transition:fly={{y: 40, duration: 300, opacity: 0}}
      class="bg-neutral-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
            <BarChart3 class="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 class="text-sm font-black text-white uppercase tracking-widest">Shift Report</h2>
            <p class="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
              {data.shift.userName || 'Operator'} - {new Date(data.shift.startTime).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button onclick={onClose} class="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Shift Info Bar -->
      <div class="px-6 py-3 border-b border-white/5 flex items-center gap-6 bg-white/[0.02] shrink-0">
        <div class="flex items-center gap-2">
          <ArrowUpRight class="w-3.5 h-3.5 text-emerald-400" />
          <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Clock In:</span>
          <span class="text-[10px] font-black text-white">{new Date(data.shift.startTime).toLocaleTimeString()}</span>
        </div>
        <div class="flex items-center gap-2">
          <ArrowDownLeft class="w-3.5 h-3.5 text-rose-400" />
          <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Clock Out:</span>
          <span class="text-[10px] font-black text-white">
            {data.shift.endTime ? new Date(data.shift.endTime).toLocaleTimeString() : 'Active'}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Clock class="w-3.5 h-3.5 text-amber-400" />
          <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Duration:</span>
          <span class="text-[10px] font-black text-amber-400">{formatDuration(data.shift.startTime, data.shift.endTime)}</span>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="px-6 py-2 border-b border-white/5 flex gap-2 shrink-0">
        {#each [
          { id: 'summary' as const, label: 'Summary', icon: TrendingUp },
          { id: 'hourly' as const, label: 'Hourly', icon: BarChart3 },
          { id: 'transactions' as const, label: 'Transactions', icon: ShoppingCart }
        ] as tab}
          {@const TabIcon = tab.icon}
          <button
            onclick={() => activeSection = tab.id}
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all {activeSection === tab.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}"
          >
            <TabIcon class="w-3 h-3" />
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if activeSection === 'summary'}
          <div class="space-y-6">
            <!-- Primary KPIs -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <TrendingUp class="w-4 h-4 text-emerald-400" />
                  <span class="text-[8px] font-black text-white/30 uppercase tracking-widest">Total Sales</span>
                </div>
                <p class="text-2xl font-black text-white tabular-nums">R {data.totalSales.toFixed(2)}</p>
              </div>
              <div class="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <ShoppingCart class="w-4 h-4 text-indigo-400" />
                  <span class="text-[8px] font-black text-white/30 uppercase tracking-widest">Transactions</span>
                </div>
                <p class="text-2xl font-black text-white tabular-nums">{data.transactions}</p>
              </div>
              <div class="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Tag class="w-4 h-4 text-amber-400" />
                  <span class="text-[8px] font-black text-white/30 uppercase tracking-widest">Items Sold</span>
                </div>
                <p class="text-2xl font-black text-white tabular-nums">{data.totalItems}</p>
              </div>
            </div>

            <!-- Payment Breakdown -->
            <div class="bg-white/[0.03] border border-white/5 rounded-xl p-5">
              <p class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-4">Payment Breakdown</p>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                      <CreditCard class="w-4 h-4 text-indigo-400" />
                    </div>
                    <span class="text-xs font-black text-white">Card Payments</span>
                  </div>
                  <span class="text-sm font-black text-white tabular-nums">R {data.cardSales.toFixed(2)}</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <Banknote class="w-4 h-4 text-emerald-400" />
                    </div>
                    <span class="text-xs font-black text-white">Cash Payments</span>
                  </div>
                  <span class="text-sm font-black text-white tabular-nums">R {data.cashSales.toFixed(2)}</span>
                </div>
                {#if data.totalChange > 0}
                  <div class="flex items-center justify-between pl-11">
                    <span class="text-[10px] text-white/40">Change Dispensed</span>
                    <span class="text-xs font-bold text-white/40 tabular-nums">R {data.totalChange.toFixed(2)}</span>
                  </div>
                {/if}
                <!-- Ratio bar -->
                <div class="mt-2">
                  <div class="h-2 bg-white/5 rounded-full overflow-hidden flex">
                    {#if data.totalSales > 0}
                      <div class="h-full bg-indigo-500 rounded-l-full" style="width: {(data.cardSales / data.totalSales) * 100}%"></div>
                      <div class="h-full bg-emerald-500 rounded-r-full" style="width: {(data.cashSales / data.totalSales) * 100}%"></div>
                    {/if}
                  </div>
                  <div class="flex justify-between mt-1">
                    <span class="text-[8px] font-bold text-indigo-400">Card {data.totalSales > 0 ? Math.round((data.cardSales / data.totalSales) * 100) : 0}%</span>
                    <span class="text-[8px] font-bold text-emerald-400">Cash {data.totalSales > 0 ? Math.round((data.cashSales / data.totalSales) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Discounts & Loyalty -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Zap class="w-4 h-4 text-amber-400" />
                  <span class="text-[8px] font-black text-amber-400/60 uppercase tracking-widest">Promo Savings</span>
                </div>
                <p class="text-xl font-black text-amber-400 tabular-nums">R {data.promoSavings.toFixed(2)}</p>
              </div>
              <div class="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <Tag class="w-4 h-4 text-rose-400" />
                  <span class="text-[8px] font-black text-rose-400/60 uppercase tracking-widest">Loyalty Redeemed</span>
                </div>
                <p class="text-xl font-black text-rose-400 tabular-nums">R {data.loyaltyRedeemed.toFixed(2)}</p>
              </div>
            </div>

            <!-- Average Basket -->
            <div class="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
              <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">Avg. Basket Value</span>
              <span class="text-lg font-black text-white tabular-nums">
                R {data.transactions > 0 ? (data.totalSales / data.transactions).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>

        {:else if activeSection === 'hourly'}
          <div class="space-y-4">
            <p class="text-[9px] font-black text-white/40 uppercase tracking-widest">Hourly Sales Distribution</p>
            {#if hourlyData.length === 0}
              <div class="text-center py-12">
                <BarChart3 class="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p class="text-[10px] font-black text-white/20 uppercase tracking-widest">No hourly data</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each hourlyData as h}
                  <div class="flex items-center gap-4">
                    <span class="text-[10px] font-mono font-bold text-white/40 w-10 shrink-0">{h.hour}</span>
                    <div class="flex-1 h-8 bg-white/[0.02] rounded-lg overflow-hidden relative">
                      <div
                        class="h-full bg-gradient-to-r from-amber-500/30 to-amber-500/10 rounded-lg"
                        style="width: {(h.total / maxHourlyTotal) * 100}%"></div>
                      <div class="absolute inset-0 flex items-center px-3 justify-between">
                        <span class="text-[9px] font-black text-white/60">{h.count} txn</span>
                        <span class="text-[9px] font-black text-amber-400 tabular-nums">R {h.total.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeSection === 'transactions'}
          <div class="space-y-2">
            <p class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-3">
              Transaction Log ({data.transactionList.length})
            </p>
            {#each data.transactionList as tx, i}
              <div class="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex items-center gap-3">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center {tx.method === 'Card' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}">
                  {#if tx.method === 'Card'}
                    <CreditCard class="w-3.5 h-3.5 text-indigo-400" />
                  {:else}
                    <Banknote class="w-3.5 h-3.5 text-emerald-400" />
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-white">{(tx.id || '').substring(0, 20)}</span>
                    {#if tx.promoDiscount > 0}
                      <span class="px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[7px] font-black">PROMO</span>
                    {/if}
                  </div>
                  <span class="text-[9px] text-white/30">
                    {tx.items?.length || 0} items - {tx.method} - {new Date(tx.date || tx.time).toLocaleTimeString()}
                  </span>
                </div>
                <span class="text-xs font-black text-white tabular-nums">R {(tx.amount || 0).toFixed(2)}</span>
              </div>
            {/each}
            {#if data.transactionList.length === 0}
              <div class="text-center py-12">
                <ShoppingCart class="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p class="text-[10px] font-black text-white/20 uppercase tracking-widest">No transactions</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-white/5 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <Hash class="w-3 h-3 text-white/20" />
          <span class="text-[8px] font-mono text-white/20">{shiftId}</span>
        </div>
        <div class="flex gap-2">
          <button
            onclick={handlePrint}
            class="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors"
          >
            <Printer class="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onclick={handleExportCSV}
            class="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors"
          >
            <Download class="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onclick={handleExportPDF}
            disabled={pdfGenerating}
            class="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {#if pdfGenerating}
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
              Generating...
            {:else}
              <FileText class="w-3.5 h-3.5" />
              Export PDF
            {/if}
          </button>
          <button
            onclick={onClose}
            class="px-6 py-2.5 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
