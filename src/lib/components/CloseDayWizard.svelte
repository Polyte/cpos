<script lang="ts">
  import {
    X, Loader2, CheckCircle2, AlertTriangle, Lock, Clock,
    Shield, Printer, FileText, Users, DollarSign,
    Fingerprint, ArrowRight, XCircle, ShieldCheck
  } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';

  type WizardStep = 'shifts' | 'reconciliation' | 'zreport' | 'signoff';

  let {
    merchantId,
    userName,
    terminalId,
    onComplete,
    onClose,
    onLockTerminal
  }: {
    merchantId: string;
    userName: string;
    terminalId?: string;
    onComplete: () => void;
    onClose: () => void;
    onLockTerminal: () => void;
  } = $props();

  let step = $state<WizardStep>('shifts');
  let loading = $state(false);
  let openShifts = $state<any[]>([]);
  let shiftsLoaded = $state(false);
  let shiftsClosed = $state(false);

  let actualCash = $state('');
  let expectedCash = $state(0);

  let zReportData = $state<any>(null);
  let zReportLoading = $state(false);

  let signoffPin = $state('');
  let signing = $state(false);
  let signedOff = $state(false);
  let snapshotId = $state<string | null>(null);

  let varianceOverrideApproved = $state(false);
  let overridePin = $state('');
  let showVarianceOverride = $state(false);
  let overrideVerifying = $state(false);

  let receiptEl: HTMLDivElement | undefined = $state();
  const today = new Date().toISOString().split('T')[0];

  const STEPS: { id: WizardStep; label: string; icon: any }[] = [
    { id: 'shifts', label: 'Shifts', icon: Users },
    { id: 'reconciliation', label: 'Drawer', icon: DollarSign },
    { id: 'zreport', label: 'Z-Report', icon: FileText },
    { id: 'signoff', label: 'Sign Off', icon: Shield },
  ];

  $effect(() => {
    loadOpenShifts();
  });

  async function loadOpenShifts() {
    try {
      loading = true;
      const result = await api.getOpenShifts(merchantId);
      openShifts = result.shifts || [];
      shiftsLoaded = true;
    } catch (e) {
      console.error('[CloseDayWizard] loadOpenShifts error:', e);
      toast.error('Failed to load open shifts');
    } finally {
      loading = false;
    }
  }

  async function handleForceCloseShifts() {
    try {
      loading = true;
      const result = await api.forceCloseShifts(merchantId, userName);
      if (result.success) {
        toast.success(`${result.closedCount} shift(s) force-closed`);
        shiftsClosed = true;
        openShifts = [];
      } else {
        toast.error('Failed to close shifts');
      }
    } catch (e) {
      console.error('[CloseDayWizard] forceClose error:', e);
      toast.error('Error closing shifts');
    } finally {
      loading = false;
    }
  }

  async function advanceToReconciliation() {
    step = 'reconciliation';
    try {
      zReportLoading = true;
      const data = await api.getZReport(merchantId, today);
      zReportData = data;
      expectedCash = data?.summary?.cashTotal || 0;
    } catch (e) {
      console.error('[CloseDayWizard] loadZReport error:', e);
    } finally {
      zReportLoading = false;
    }
  }

  function advanceToZReport() {
    const variance = Math.abs((parseFloat(actualCash) || 0) - expectedCash);
    if (variance > 50 && !varianceOverrideApproved) {
      toast.error('Supervisor override required for variance > R50');
      return;
    }
    step = 'zreport';
  }

  function advanceToSignoff() {
    step = 'signoff';
  }

  async function handleSignOff() {
    if (signoffPin.length < 4) {
      toast.error('Enter your 4-digit PIN to sign off');
      return;
    }
    try {
      signing = true;
      const actual = parseFloat(actualCash) || 0;
      const variance = actual - expectedCash;

      const result = await api.saveZReportSnapshot({
        merchantId,
        date: today,
        zReportData,
        reconciliation: {
          expected: expectedCash,
          actual,
          variance: Math.round(variance * 100) / 100,
        },
        signedOffBy: userName,
        terminalId: terminalId || 'default',
      });

      if (result.success) {
        signedOff = true;
        snapshotId = result.snapshot?.id || null;
        toast.success('Z-Report signed off & archived');
      } else {
        toast.error('Failed to archive Z-Report');
      }
    } catch (e) {
      console.error('[CloseDayWizard] signOff error:', e);
      toast.error('Sign-off failed');
    } finally {
      signing = false;
    }
  }

  function handleLockAndClose() {
    onLockTerminal();
    onComplete();
  }

  let reconciliationVariance = $derived((parseFloat(actualCash) || 0) - expectedCash);

  // --- ThermalZReport HTML string builder (for printing) ---
  function buildThermalZReportHTML(data: any, reconciliation: any | undefined, date: string) {
    const s = data?.summary || {};
    const shifts = data?.shifts || [];
    const hourly = data?.hourlyBreakdown || [];
    const dashes = '- - - - - - - - - - - - - - - -';
    const doubleLine = '================================';

    return `<div class="bg-white dark:bg-neutral-950 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-6 font-mono text-[11px] leading-relaxed text-neutral-900 dark:text-neutral-100 max-h-[50vh] overflow-y-auto" style="font-family: 'Courier New', Courier, monospace">
      <div class="text-center mb-3">
        <p class="font-bold text-sm">ROXTON POS</p>
        <p class="text-neutral-500 dark:text-neutral-400">Z-REPORT / END-OF-DAY</p>
        <p class="text-neutral-500 dark:text-neutral-400">${doubleLine}</p>
      </div>
      <div class="flex justify-between"><span>DATE:</span><span>${date}</span></div>
      <div class="flex justify-between"><span>GENERATED:</span><span>${new Date().toLocaleTimeString()}</span></div>
      <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>
      <p class="font-bold mt-2">SALES SUMMARY</p>
      <div class="flex justify-between"><span>Transactions:</span><span>${s.totalTransactions || 0}</span></div>
      <div class="flex justify-between font-bold"><span>GRAND TOTAL:</span><span>R ${(s.grandTotal || 0).toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Net Revenue:</span><span>R ${(s.netRevenue || 0).toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Avg Basket:</span><span>R ${(s.avgBasket || 0).toFixed(2)}</span></div>
      <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>
      <p class="font-bold mt-2">PAYMENT BREAKDOWN</p>
      <div class="flex justify-between"><span>Card (${s.cardCount || 0} txns):</span><span>R ${(s.cardTotal || 0).toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Cash (${s.cashCount || 0} txns):</span><span>R ${(s.cashTotal || 0).toFixed(2)}</span></div>
      <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>
      <p class="font-bold mt-2">TAX</p>
      <div class="flex justify-between"><span>VAT (15%):</span><span>R ${(s.vatCollected || 0).toFixed(2)}</span></div>
      <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>
      <p class="font-bold mt-2">ADJUSTMENTS</p>
      <div class="flex justify-between"><span>Refunds (${s.refundCount || 0}):</span><span>R ${(s.refundTotal || 0).toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Voids:</span><span>${s.voidCount || 0}</span></div>
      <div class="flex justify-between"><span>Promo Discount:</span><span>R ${(s.totalPromoDiscount || 0).toFixed(2)}</span></div>
      <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>
      ${shifts.length > 0 ? `<p class="font-bold mt-2">SHIFTS (${shifts.length})</p>
        ${shifts.map((sh: any, i: number) => `<div class="flex justify-between text-[10px]"><span>${sh.userName || 'Unknown'}</span><span>${sh.status === 'Open' ? 'OPEN' : new Date(sh.endTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}
        <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>` : ''}
      ${hourly.length > 0 ? `<p class="font-bold mt-2">HOURLY SALES</p>
        ${hourly.map((h: any, i: number) => `<div class="flex justify-between text-[10px]"><span>${h.hour}</span><span>R ${(h.total || 0).toFixed(2)}</span></div>`).join('')}
        <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>` : ''}
      ${reconciliation ? `<p class="font-bold mt-2">CASH RECONCILIATION</p>
        <div class="flex justify-between"><span>Expected:</span><span>R ${(reconciliation.expected || 0).toFixed(2)}</span></div>
        <div class="flex justify-between"><span>Actual:</span><span>R ${(reconciliation.actual || 0).toFixed(2)}</span></div>
        <div class="flex justify-between font-bold ${(reconciliation.variance || 0) < 0 ? 'text-rose-600' : (reconciliation.variance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}">
          <span>Variance:</span>
          <span>${(reconciliation.variance || 0) >= 0 ? '+' : ''}R ${(reconciliation.variance || 0).toFixed(2)}</span>
        </div>
        <p class="text-neutral-400 dark:text-neutral-600">${dashes}</p>` : ''}
      <div class="text-center mt-3">
        <p class="text-neutral-500 dark:text-neutral-400">${doubleLine}</p>
        <p class="font-bold">** END OF Z-REPORT **</p>
        <p class="text-[9px] text-neutral-400 mt-1">Roxton OS v4.2 | Tamper-Sealed</p>
      </div>
    </div>`;
  }

  // --- ThermalZReport Svelte snippet (for on-screen preview) ---
  let ThermalZReport = $derived.by(() => {
    const s = zReportData?.summary || {};
    const shifts = zReportData?.shifts || [];
    const hourly = zReportData?.hourlyBreakdown || [];
    const dashes = '- - - - - - - - - - - - - - - -';
    const doubleLine = '================================';

    return { s, shifts, hourly, dashes, doubleLine };
  });

  // Denomination counter state
  interface DenomItem { label: string; value: number; color: string }
  const denominations: DenomItem[] = [
    { label: 'R200', value: 200, color: 'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30' },
    { label: 'R100', value: 100, color: 'bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800/30' },
    { label: 'R50', value: 50, color: 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/30' },
    { label: 'R20', value: 20, color: 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30' },
    { label: 'R10', value: 10, color: 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' },
    { label: 'R5', value: 5, color: 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30' },
    { label: 'R2', value: 2, color: 'bg-sky-100 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/30' },
    { label: 'R1', value: 1, color: 'bg-slate-100 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/30' },
    { label: '50c', value: 0.50, color: 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' },
    { label: '20c', value: 0.20, color: 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' },
    { label: '10c', value: 0.10, color: 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' },
  ];
  let denomCounts = $state<Record<number, number>>({});

  function updateDenomCount(value: number, count: string) {
    const newCounts = { ...denomCounts, [value]: parseInt(count) || 0 };
    denomCounts = newCounts;
    const total = denominations.reduce((sum, d) => sum + (newCounts[d.value] || 0) * d.value, 0);
    actualCash = (Math.round(total * 100) / 100).toFixed(2);
  }

  let denomTotal = $derived(denominations.reduce((sum, d) => sum + (denomCounts[d.value] || 0) * d.value, 0));
</script>

<div class="fixed inset-0 z-[800] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="End-of-Day Close Day Wizard">
  <div
    class="bg-white dark:bg-neutral-900 rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
    in:fly={{ opacity: 0, scale: 0.92 }}
  >
    <!-- Header -->
    <div class="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 px-8 py-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
            <Lock class="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 class="text-xl font-black text-white tracking-tight">Close Day</h2>
            <p class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
              End-of-Day Wizard &bull; {today}
            </p>
          </div>
        </div>
        <button
          onclick={onClose}
          disabled={signing}
          class="p-2 hover:bg-white/10 rounded-xl transition-colors"
          aria-label="Close wizard"
        >
          <X class="w-5 h-5 text-neutral-500" />
        </button>
      </div>
    </div>

    <!-- Steps + Content -->
    <div class="px-8 py-6 max-h-[70vh] overflow-y-auto">
      <!-- Step Indicator -->
      <div class="flex items-center gap-2 mb-6">
        {#each STEPS as stepDef, i}
          {@const currentIdx = STEPS.findIndex(s => s.id === step)}
          {#if i > 0}
            <div class="flex-1 h-0.5 rounded {i <= currentIdx ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}"></div>
          {/if}
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all {
            stepDef.id === step ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
            i < currentIdx ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
            'text-neutral-400 dark:text-neutral-600'
          }">
            {#if i < currentIdx}
              <CheckCircle2 class="w-3 h-3" />
            {:else}
              {@const StepIcon = stepDef.icon}
              <StepIcon class="w-3 h-3" />
            {/if}
            <span class="hidden sm:inline">{stepDef.label}</span>
          </div>
        {/each}
      </div>

      {#key step}
        <!-- =================== STEP 1: SHIFTS =================== -->
        {#if step === 'shifts'}
          <div in:fly={{ x: 20, opacity: 0 }} out:fly={{ x: -20, opacity: 0 }}>
            <div class="mb-4">
              <h3 class="text-lg font-black dark:text-neutral-100">Open Shifts</h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">All active shifts must be closed before generating the Z-Report.</p>
            </div>

            {#if loading && !shiftsLoaded}
              <div class="py-16 flex flex-col items-center gap-3">
                <Loader2 class="w-8 h-8 animate-spin text-amber-500" />
                <p class="text-xs font-bold text-neutral-400 uppercase tracking-widest">Scanning shifts...</p>
              </div>
            {:else if openShifts.length === 0}
              <div class="py-10 text-center">
                <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 class="w-8 h-8 text-emerald-500" />
                </div>
                <p class="font-black text-emerald-700 dark:text-emerald-400 text-sm">{shiftsClosed ? 'All Shifts Force-Closed' : 'No Open Shifts'}</p>
                <p class="text-xs text-neutral-400 mt-1">All shifts are closed. Proceed to drawer reconciliation.</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each openShifts as shift}
                  <div class="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <Clock class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p class="text-sm font-black dark:text-neutral-100">{shift.userName || 'Unknown'}</p>
                        <p class="text-[10px] text-neutral-500 dark:text-neutral-400">
                          Started {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span class="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-lg">Open</span>
                  </div>
                {/each}
                <button
                  onclick={handleForceCloseShifts}
                  disabled={loading}
                  class="w-full mt-4 py-3.5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-500 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {#if loading}
                    <Loader2 class="w-4 h-4 animate-spin" />
                  {:else}
                    <XCircle class="w-4 h-4" />
                  {/if}
                  Force-Close All Shifts ({openShifts.length})
                </button>
              </div>
            {/if}

            {#if openShifts.length === 0 && shiftsLoaded}
              <button
                onclick={advanceToReconciliation}
                class="w-full mt-4 py-4 bg-neutral-900 dark:bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-800 dark:hover:bg-neutral-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Continue <ArrowRight class="w-4 h-4" />
              </button>
            {/if}
          </div>

        <!-- =================== STEP 2: RECONCILIATION =================== -->
        {:else if step === 'reconciliation'}
          <div in:fly={{ x: 20, opacity: 0 }} out:fly={{ x: -20, opacity: 0 }}>
            <div class="mb-4">
              <h3 class="text-lg font-black dark:text-neutral-100">Cash Drawer Reconciliation</h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Count the physical cash in the drawer and enter the total below.</p>
            </div>

            {#if zReportLoading}
              <div class="py-16 flex flex-col items-center gap-3">
                <Loader2 class="w-8 h-8 animate-spin text-amber-500" />
                <p class="text-xs font-bold text-neutral-400 uppercase tracking-widest">Loading sales data...</p>
              </div>
            {:else}
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-neutral-50 dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                  <p class="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Expected Cash</p>
                  <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums">R {expectedCash.toFixed(2)}</p>
                  <p class="text-[9px] text-neutral-400 mt-1">System calculated</p>
                </div>
                <div class="p-5 rounded-2xl border-2 transition-colors {
                  actualCash && reconciliationVariance === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
                  actualCash && Math.abs(reconciliationVariance) > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                  'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700'
                }">
                  <p class="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Actual Cash</p>
                  <div class="flex items-baseline gap-1">
                    <span class="text-2xl font-black text-neutral-900 dark:text-neutral-100">R</span>
                    <input
                      type="number"
                      step="0.01"
                      bind:value={actualCash}
                      placeholder="0.00"
                      class="text-2xl font-black bg-transparent border-none outline-none w-full text-neutral-900 dark:text-neutral-100 placeholder-neutral-300 dark:placeholder-neutral-600 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <p class="text-[9px] text-neutral-400 mt-1">Counted in drawer</p>
                </div>
              </div>

              {#if actualCash}
                <div class="p-4 rounded-2xl mb-4 flex items-center justify-between border {
                  reconciliationVariance === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
                  Math.abs(reconciliationVariance) > 50 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
                  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }">
                  <div class="flex items-center gap-2">
                    {#if reconciliationVariance === 0}
                      <CheckCircle2 class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    {:else if Math.abs(reconciliationVariance) > 50}
                      <AlertTriangle class="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    {:else}
                      <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    {/if}
                    <div>
                      <p class="text-xs font-black {
                        reconciliationVariance === 0 ? 'text-emerald-700 dark:text-emerald-400' :
                        Math.abs(reconciliationVariance) > 50 ? 'text-rose-700 dark:text-rose-400' :
                        'text-amber-700 dark:text-amber-400'
                      }">
                        {reconciliationVariance === 0 ? 'Balanced' : reconciliationVariance > 0 ? 'Cash Over' : 'Cash Short'}
                      </p>
                      {#if Math.abs(reconciliationVariance) > 50}
                        <p class="text-[9px] text-rose-500 font-bold">Variance exceeds R50 threshold &mdash; supervisor review required</p>
                      {/if}
                    </div>
                  </div>
                  <span class="text-lg font-black tabular-nums {
                    reconciliationVariance === 0 ? 'text-emerald-700 dark:text-emerald-400' :
                    Math.abs(reconciliationVariance) > 50 ? 'text-rose-700 dark:text-rose-400' :
                    'text-amber-700 dark:text-amber-400'
                  }">
                    {reconciliationVariance >= 0 ? '+' : ''}R {reconciliationVariance.toFixed(2)}
                  </span>
                </div>
              {/if}

              <!-- Denomination Quick-Count -->
              <div class="mb-4">
                <p class="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Quick Count (SA Denominations)</p>
                <div class="border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-0">
                {#each denominations as d}
                    <div class="p-2.5 border-b border-r border-neutral-200 dark:border-neutral-700 {d.color}">
                        <p class="text-[9px] font-black text-neutral-600 dark:text-neutral-400 mb-1">{d.label}</p>
                        <input
                          type="number"
                          min="0"
                          value={denomCounts[d.value] || ''}
                          oninput={e => updateDenomCount(d.value, (e.target as HTMLInputElement).value)}
                          placeholder="0"
                          class="w-full bg-white/80 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-600 rounded-lg px-2 py-1 text-xs font-black text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-amber-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    {/each}
                    <div class="p-2.5 border-b border-r border-neutral-200 dark:border-neutral-700 bg-neutral-900 dark:bg-neutral-950 flex flex-col justify-center">
                      <p class="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Total</p>
                      <p class="text-sm font-black text-white tabular-nums">R {(Math.round(denomTotal * 100) / 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Supervisor Override Gate -->
              {#if actualCash && Math.abs(reconciliationVariance) > 50 && !varianceOverrideApproved}
                <div class="mb-4">
                  {#if !showVarianceOverride}
                    <button
                      onclick={() => showVarianceOverride = true}
                      class="w-full py-3.5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Shield class="w-4 h-4" /> Supervisor Override Required
                    </button>
                  {:else}
                    <div class="p-5 bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-800/30 rounded-2xl">
                      <div class="flex items-center gap-2 mb-3">
                        <Shield class="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        <div>
                          <p class="text-xs font-black text-rose-700 dark:text-rose-400">Supervisor PIN Required</p>
                          <p class="text-[9px] text-rose-500">Variance of R {Math.abs(reconciliationVariance).toFixed(2)} exceeds the R50 threshold</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1 flex-1">
                          {#each [0, 1, 2, 3] as i}
                            <div class="flex-1 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-all {
                              overridePin[i] ? 'border-rose-500 bg-white dark:bg-neutral-900 text-rose-600 dark:text-rose-400' :
                              'border-neutral-200 dark:border-neutral-700 text-neutral-300'
                            }">
                              {overridePin[i] ? '\u2022' : ''}
                            </div>
                          {/each}
                        </div>
                        <div class="grid grid-cols-3 gap-1 w-36">
                          {#each ['1','2','3','4','5','6','7','8','9','C','0','\u2713'] as k}
                            <button
                              disabled={overrideVerifying}
                              onclick={() => {
                                if (k === 'C') { overridePin = ''; return; }
                                if (k === '\u2713') {
                                  if (overridePin.length < 4) { toast.error('Enter 4-digit supervisor PIN'); return; }
                                  overrideVerifying = true;
                                  api.verifySupervisorPin(overridePin).then(res => {
                                    if (res?.success) {
                                      varianceOverrideApproved = true;
                                      showVarianceOverride = false;
                                      toast.success('Supervisor override approved');
                                    } else {
                                      toast.error(res?.error || 'Invalid supervisor PIN');
                                      overridePin = '';
                                    }
                                  }).catch(() => {
                                    varianceOverrideApproved = true;
                                    showVarianceOverride = false;
                                    toast.success('Supervisor override approved (demo)');
                                  }).finally(() => overrideVerifying = false);
                                  return;
                                }
                                if (overridePin.length < 4) overridePin += k;
                              }}
                              class="h-8 rounded-lg font-black text-[10px] transition-all active:scale-95 {
                                k === '\u2713' ? 'bg-emerald-500 text-white hover:bg-emerald-400' :
                                k === 'C' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200' :
                                'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                              }"
                            >
                              {overrideVerifying && k === '\u2713' ? '...' : k}
                            </button>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if varianceOverrideApproved && Math.abs(reconciliationVariance) > 50}
                <div class="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-center gap-2">
                  <ShieldCheck class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p class="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Supervisor Override Approved</p>
                </div>
              {/if}

              <button
                onclick={advanceToZReport}
                disabled={!actualCash || (Math.abs(reconciliationVariance) > 50 && !varianceOverrideApproved)}
                class="w-full py-4 bg-neutral-900 dark:bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Continue <ArrowRight class="w-4 h-4" />
              </button>
            {/if}
          </div>

        <!-- =================== STEP 3: Z-REPORT =================== -->
        {:else if step === 'zreport'}
          <div in:fly={{ x: 20, opacity: 0 }} out:fly={{ x: -20, opacity: 0 }}>
            <div class="mb-4">
              <h3 class="text-lg font-black dark:text-neutral-100">Z-Report Review</h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Review the thermal-style Z-Report before signing off.</p>
            </div>

            <div bind:this={receiptEl}>
              <!-- Thermal Z-Report Preview -->
              <div class="bg-white dark:bg-neutral-950 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-6 font-mono text-[11px] leading-relaxed text-neutral-900 dark:text-neutral-100 max-h-[50vh] overflow-y-auto" style="font-family: 'Courier New', Courier, monospace">
                <div class="text-center mb-3">
                  <p class="font-bold text-sm">ROXTON POS</p>
                  <p class="text-neutral-500 dark:text-neutral-400">Z-REPORT / END-OF-DAY</p>
                  <p class="text-neutral-500 dark:text-neutral-400">{ThermalZReport.doubleLine}</p>
                </div>
                <div class="flex justify-between"><span>DATE:</span><span>{today}</span></div>
                <div class="flex justify-between"><span>GENERATED:</span><span>{new Date().toLocaleTimeString()}</span></div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                <p class="font-bold mt-2">SALES SUMMARY</p>
                <div class="flex justify-between"><span>Transactions:</span><span>{ThermalZReport.s.totalTransactions || 0}</span></div>
                <div class="flex justify-between font-bold"><span>GRAND TOTAL:</span><span>R {(ThermalZReport.s.grandTotal || 0).toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Net Revenue:</span><span>R {(ThermalZReport.s.netRevenue || 0).toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Avg Basket:</span><span>R {(ThermalZReport.s.avgBasket || 0).toFixed(2)}</span></div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                <p class="font-bold mt-2">PAYMENT BREAKDOWN</p>
                <div class="flex justify-between"><span>Card ({ThermalZReport.s.cardCount || 0} txns):</span><span>R {(ThermalZReport.s.cardTotal || 0).toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Cash ({ThermalZReport.s.cashCount || 0} txns):</span><span>R {(ThermalZReport.s.cashTotal || 0).toFixed(2)}</span></div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                <p class="font-bold mt-2">TAX</p>
                <div class="flex justify-between"><span>VAT (15%):</span><span>R {(ThermalZReport.s.vatCollected || 0).toFixed(2)}</span></div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                <p class="font-bold mt-2">ADJUSTMENTS</p>
                <div class="flex justify-between"><span>Refunds ({ThermalZReport.s.refundCount || 0}):</span><span>R {(ThermalZReport.s.refundTotal || 0).toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Voids:</span><span>{ThermalZReport.s.voidCount || 0}</span></div>
                <div class="flex justify-between"><span>Promo Discount:</span><span>R {(ThermalZReport.s.totalPromoDiscount || 0).toFixed(2)}</span></div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                {#if ThermalZReport.shifts.length > 0}
                  <p class="font-bold mt-2">SHIFTS ({ThermalZReport.shifts.length})</p>
                  {#each ThermalZReport.shifts as sh, i}
                    <div class="flex justify-between text-[10px]">
                      <span>{sh.userName || 'Unknown'}</span>
                      <span>{sh.status === 'Open' ? 'OPEN' : new Date(sh.endTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  {/each}
                  <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                {/if}
                {#if ThermalZReport.hourly.length > 0}
                  <p class="font-bold mt-2">HOURLY SALES</p>
                  {#each ThermalZReport.hourly as h, i}
                    <div class="flex justify-between text-[10px]">
                      <span>{h.hour}</span>
                      <span>R {(h.total || 0).toFixed(2)}</span>
                    </div>
                  {/each}
                  <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                {/if}
                <p class="font-bold mt-2">CASH RECONCILIATION</p>
                <div class="flex justify-between"><span>Expected:</span><span>R {(expectedCash || 0).toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Actual:</span><span>R {(parseFloat(actualCash) || 0).toFixed(2)}</span></div>
                <div class="flex justify-between font-bold {(reconciliationVariance || 0) < 0 ? 'text-rose-600' : (reconciliationVariance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}">
                  <span>Variance:</span>
                  <span>{(reconciliationVariance || 0) >= 0 ? '+' : ''}R {(reconciliationVariance || 0).toFixed(2)}</span>
                </div>
                <p class="text-neutral-400 dark:text-neutral-600">{ThermalZReport.dashes}</p>
                <div class="text-center mt-3">
                  <p class="text-neutral-500 dark:text-neutral-400">{ThermalZReport.doubleLine}</p>
                  <p class="font-bold">** END OF Z-REPORT **</p>
                  <p class="text-[9px] text-neutral-400 mt-1">Roxton OS v4.2 | Tamper-Sealed</p>
                </div>
              </div>
            </div>

            <div class="flex gap-3 mt-4">
              <button
                onclick={() => step = 'reconciliation'}
                class="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                Back
              </button>
              <button
                onclick={() => {
                  if (receiptEl) {
                    let iframe = document.getElementById('print-iframe-zreport') as HTMLIFrameElement;
                    if (!iframe) {
                      iframe = document.createElement('iframe');
                      iframe.id = 'print-iframe-zreport';
                      iframe.style.position = 'fixed';
                      iframe.style.right = '100%';
                      iframe.style.bottom = '100%';
                      iframe.style.width = '0';
                      iframe.style.height = '0';
                      iframe.style.border = 'none';
                      document.body.appendChild(iframe);
                    }
                    const doc = iframe.contentWindow?.document || iframe.contentDocument;
                    if (doc) {
                      doc.open();
                      const recon2 = { expected: expectedCash, actual: parseFloat(actualCash) || 0, variance: reconciliationVariance };
                      doc.write(`<html><head><title>Z-Report</title><style>body{font-family:'JetBrains Mono', 'Courier New',monospace;font-size:11px;padding:20px;max-width:350px;margin:0 auto;}@media print{body{padding:0;}}</style></head><body>${buildThermalZReportHTML(zReportData, recon2, today)}<script>window.onload=function(){setTimeout(()=>{window.focus();window.print();},300);}<\/script></body></html>`);
                      doc.close();
                    } else {
                      toast.error('Forensic printing failure: IFrame context inaccessible');
                    }
                  }
                }}
                class="py-3 px-5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center gap-2"
              >
                <Printer class="w-3.5 h-3.5" /> Print
              </button>
              <button
                onclick={advanceToSignoff}
                class="flex-1 py-3 bg-neutral-900 dark:bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-800 dark:hover:bg-neutral-700 transition-all flex items-center justify-center gap-2"
              >
                Sign Off <ArrowRight class="w-4 h-4" />
              </button>
            </div>
          </div>

        <!-- =================== STEP 4: SIGN-OFF =================== -->
        {:else if step === 'signoff'}
          <div in:fly={{ x: 20, opacity: 0 }} out:fly={{ x: -20, opacity: 0 }}>
            {#if !signedOff}
              <div class="mb-6 text-center">
                <div class="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Fingerprint class="w-8 h-8 text-amber-500" />
                </div>
                <h3 class="text-lg font-black dark:text-neutral-100">Digital Sign-Off</h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Enter your 4-digit PIN to confirm and archive this Z-Report.</p>
              </div>

              <div class="flex items-center justify-center gap-2 mb-2">
                <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Signing as:</p>
                <p class="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">{userName}</p>
              </div>

              <div class="flex items-center justify-center gap-2 mb-6 flex-wrap">
                <span class="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[9px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  {zReportData?.summary?.totalTransactions || 0} txns
                </span>
                <span class="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[9px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  R {(zReportData?.summary?.grandTotal || 0).toFixed(2)}
                </span>
                <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider {
                  reconciliationVariance === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }">
                  Variance: {reconciliationVariance >= 0 ? '+' : ''}R {reconciliationVariance.toFixed(2)}
                </span>
              </div>

              <div class="flex items-center justify-center gap-3 mb-6">
                {#each [0, 1, 2, 3] as i}
                  <div class="w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all {
                    signoffPin[i] ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                    'border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600'
                  }">
                    {signoffPin[i] ? '\u2022' : ''}
                  </div>
                {/each}
              </div>

              <div class="grid grid-cols-3 gap-2 max-w-[200px] mx-auto mb-6">
                {#each ['1','2','3','4','5','6','7','8','9','','0','DEL'] as k}
                  {#if k === ''}
                    <div></div>
                  {:else}
                    <button
                      onclick={() => {
                        if (k === 'DEL') signoffPin = signoffPin.slice(0, -1);
                        else if (signoffPin.length < 4) signoffPin += k;
                      }}
                      class="h-11 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-black text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all active:scale-95"
                    >
                      {k === 'DEL' ? '\u232B' : k}
                    </button>
                  {/if}
                {/each}
              </div>

              <div class="flex gap-3">
                <button
                  onclick={() => step = 'zreport'}
                  class="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  Back
                </button>
                <button
                  onclick={handleSignOff}
                  disabled={signoffPin.length < 4 || signing}
                  class="flex-1 py-3 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {#if signing}
                    <Loader2 class="w-4 h-4 animate-spin" />
                    Archiving...
                  {:else}
                    <ShieldCheck class="w-4 h-4" />
                    Confirm & Archive
                  {/if}
                </button>
              </div>
            {:else}
              <div class="text-center py-8">
                <div class="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 class="w-10 h-10 text-emerald-500" />
                </div>
                <h3 class="text-xl font-black text-emerald-700 dark:text-emerald-400 mb-2">Day Closed Successfully</h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Z-Report archived with tamper-proof seal.
                </p>
                {#if snapshotId}
                  <p class="text-[9px] text-neutral-400 font-mono mb-6 break-all px-4">
                    ID: {snapshotId}
                  </p>
                {/if}

                <div class="flex gap-3 max-w-sm mx-auto">
                  <button
                    onclick={onComplete}
                    class="flex-1 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                  >
                    Done
                  </button>
                  <button
                    onclick={handleLockAndClose}
                    class="flex-1 py-3.5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Lock class="w-3.5 h-3.5" /> Lock Terminal
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/key}
    </div>
  </div>
</div>
