<script lang="ts">
  import {
    History as HistoryIcon, Printer, UploadCloud, Hash, Table as TableIcon, Fuel, Users, FileText,
    ArrowRight, CheckCircle2, AlertCircle, TrendingUp, Settings, Database, Search, ChevronRight,
    LayoutDashboard, Plus, Sliders, X, ShieldCheck, CreditCard, FileDown, UserPlus, UserCog, Trash2,
    Palette, Image as ImageIcon, Store, Loader2, Mail, UserCheck, Building2, MapPin, Monitor, Download,
    RefreshCw, XCircle, CheckCircle, Save, Percent, Heart, Fingerprint, Activity, Zap, Clock, Phone,
    Eye, ArrowLeft, Copy, Key, Ban, ArrowDown, AlertTriangle, Gift, MessageSquare,
    ExternalLink, Send, Layers, DollarSign, Banknote, BarChart3, Lock, Unlock, Receipt, Tag,
    ChevronDown, Filter, Crown, Shield, Sparkles, CalendarDays,
  } from 'lucide-svelte';
  import type { UserRole } from '../types';
  import { toast } from 'svelte-sonner';
  import { api } from '../api';
  import { fade, fly, scale } from 'svelte/transition';

  let { role }: { role: UserRole } = $props();

  let isAdmin = $derived(role === 'Admin');

  let activeTab = $derived<'merchants' | 'applications' | 'notifications' | 'receipts' | 'batches' | 'loyalty' | 'billing'>(isAdmin ? 'merchants' : 'receipts');
  let loading = $state(false);
  let merchants: any[] = $state([]);
  let selectedMerchant: any = $state(null);
  let merchantSearch = $state('');
  let merchantStatusFilter = $state<'all' | 'Active' | 'Pending' | 'Suspended'>('all');
  let merchantTypeFilter = $state('all');
  let merchantView = $state<'cards' | 'table'>('cards');
  let merchantLogoUploading = $state(false);
  let auditLogs: any[] = $state([]);
  let terminals: any[] = $state([]);
  let loyaltyLogs: any[] = $state([]);
  let activeLoyaltyMerchant: any = $state(null);

  let applications: any[] = $state([]);
  let appsLoading = $state(false);
  let selectedApp: any = $state(null);
  let appTerminalCount = $state(1);

  const planInfo = $derived.by(() => {
    const selPlan = selectedApp?.plan?.selected || selectedApp?.plan || 'kiosk';
    const termCountSel = selectedApp?.hardware?.terminalCount || 1;
    const PLAN_COST_MAP: Record<string, { name: string; monthlyRange: string; hardwareRange: string; hardwareMin: number; hardwareMax: number; color: string }> = {
      kiosk: { name: 'Kiosk / Start-up', monthlyRange: 'R165 \u2013 R499/mo', hardwareRange: 'R1 500 \u2013 R5 000', hardwareMin: 1500, hardwareMax: 5000, color: 'amber' },
      starter: { name: 'Kiosk / Start-up', monthlyRange: 'R165 \u2013 R499/mo', hardwareRange: 'R1 500 \u2013 R5 000', hardwareMin: 1500, hardwareMax: 5000, color: 'amber' },
      standard: { name: 'Standard Retail', monthlyRange: 'R500 \u2013 R1 500/mo', hardwareRange: 'R12 000 \u2013 R17 000', hardwareMin: 12000, hardwareMax: 17000, color: 'indigo' },
      professional: { name: 'Standard Retail', monthlyRange: 'R500 \u2013 R1 500/mo', hardwareRange: 'R12 000 \u2013 R17 000', hardwareMin: 12000, hardwareMax: 17000, color: 'indigo' },
      multi: { name: 'Multi-Branch', monthlyRange: 'R1 500 \u2013 R3 000+/mo', hardwareRange: 'R20 000+', hardwareMin: 20000, hardwareMax: 35000, color: 'neutral' },
      enterprise: { name: 'Multi-Branch', monthlyRange: 'R1 500 \u2013 R3 000+/mo', hardwareRange: 'R20 000+', hardwareMin: 20000, hardwareMax: 35000, color: 'neutral' },
    };
    const info = PLAN_COST_MAP[selPlan] || PLAN_COST_MAP.kiosk;
    const hwPerTerminal = info.hardwareMin;
    const hwTotal = hwPerTerminal * termCountSel;
    const hwTotalMax = info.hardwareMax * termCountSel;
    const colorClasses = info.color === 'amber' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' : info.color === 'indigo' ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20' : 'border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800';
    const textColor = info.color === 'amber' ? 'text-amber-700 dark:text-amber-400' : info.color === 'indigo' ? 'text-indigo-700 dark:text-indigo-400' : 'text-neutral-700 dark:text-neutral-300';
    return { selPlan, termCountSel, info, hwPerTerminal, hwTotal, hwTotalMax, colorClasses, textColor };
  });
  let approving = $state(false);
  let rejecting = $state(false);
  let rejectReason = $state('');
  let showRejectModal = $state(false);
  let approvalResult: any = $state(null);
  let appFilter = $state<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  let batches: any[] = $state([]);
  let batchesLoading = $state(false);
  let emailNotifs: any[] = $state([]);
  let batchSubTab = $state<'settlement' | 'emails'>('settlement');

  let previewingDoc = $state<string | null>(null);

  let settlingBatch = $state<string | null>(null);
  let showSettleConfirm = $state<string | null>(null);
  let batchMerchantFilter = $state<string>('all');

  let billingPlans: any[] = $state([]);
  let billingSubscriptions: any[] = $state([]);
  let billingInvoices: any[] = $state([]);
  let billingLoading = $state(false);
  let billingSubTab = $state<'overview' | 'plans' | 'invoices'>('overview');
  let assigningPlan = $state<{ merchantId: string; merchantName: string } | null>(null);
  let selectedPlanId = $state<string>('');
  let subscribing = $state(false);
  let cancelling = $state<string | null>(null);

  let downgradeTarget = $state<{ merchantId: string; merchantName: string; currentPlanId: string } | null>(null);
  let downgradePreview: any = $state(null);
  let downgradeLoading = $state(false);
  let downgradeProcessing = $state(false);
  let downgradeNewPlanId = $state<string>('');

  let cancelTarget = $state<{ merchantId: string; merchantName: string } | null>(null);
  let cancelPreview: any = $state(null);
  let cancelStep = $state<'reason' | 'retention' | 'confirm'>('reason');
  let cancelReason = $state('');
  let cancelFeedback = $state('');
  let cancelImmediately = $state(false);
  let cancelProcessing = $state(false);

  let merchantDetailTab = $state<'overview' | 'terminals' | 'staff' | 'transactions' | 'billing' | 'audit'>('overview');
  let merchantUsers: any[] = $state([]);
  let merchantTransactions: any[] = $state([]);
  let merchantSubscription: any = $state(null);
  let merchantInvoices: any[] = $state([]);
  let merchantConfig: any = $state(null);
  let detailLoading = $state(false);

  let togglingStatus = $state(false);
  let exportingData = $state<string | null>(null);

  $effect(() => {
    if (isAdmin) {
      loadMerchants();
    }
  });

  $effect(() => {
    if (isAdmin && activeTab === 'applications') {
      loadApplications();
    }
  });

  $effect(() => {
    if (activeTab === 'batches') {
      loadBatches();
    }
  });

  $effect(() => {
    if (isAdmin && activeTab === 'billing') {
      loadBilling();
    }
  });

  async function loadMerchants() {
    try {
      loading = true;
      const data = await api.getMerchants();
      merchants = Array.isArray(data) ? data : [];
    } catch (e) {
      toast.error('Cloud Sync Error');
    } finally {
      loading = false;
    }
  }

  async function loadApplications() {
    try {
      appsLoading = true;
      const data = await api.getApplications();
      applications = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('[MerchantMgmt] loadApplications error:', e);
      toast.error('Failed to load applications');
    } finally {
      appsLoading = false;
    }
  }

  async function loadAuditLogs(merchantId: string) {
    try {
      const logs = await api.getAuditLogs(merchantId);
      auditLogs = logs;
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTerminals(merchantId: string) {
    try {
      const data = await api.getTerminals(merchantId);
      terminals = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(e);
      terminals = [];
    }
  }

  async function loadMerchantDetail(merchant: any) {
    selectedMerchant = merchant;
    merchantDetailTab = 'overview';
    detailLoading = true;
    try {
      const [logs, terms, users, txns, sub, invoices, config] = await Promise.all([
        api.getAuditLogs(merchant.id).catch(() => []),
        api.getTerminals(merchant.id).catch(() => []),
        api.getUsers(merchant.id).catch(() => []),
        api.getTransactions(merchant.id).catch(() => []),
        api.getBillingSubscriptions(merchant.id).catch(() => null),
        api.getBillingInvoices(merchant.id).catch(() => []),
        api.getMerchantConfig(merchant.id, 'config').catch(() => null),
      ]);
      auditLogs = Array.isArray(logs) ? logs : [];
      terminals = Array.isArray(terms) ? terms : [];
      merchantUsers = Array.isArray(users) ? users : [];
      merchantTransactions = Array.isArray(txns) ? txns : [];
      merchantSubscription = sub;
      merchantInvoices = Array.isArray(invoices) ? invoices : [];
      merchantConfig = config;
    } catch (e) {
      console.error('[MerchantMgmt] loadMerchantDetail error:', e);
    } finally {
      detailLoading = false;
    }
  }

  async function handleMerchantLogoUpload(event: Event) {
    if (!selectedMerchant) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for the merchant logo');
      input.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2 MB');
      input.value = '';
      return;
    }

    merchantLogoUploading = true;
    try {
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read logo file'));
        reader.readAsDataURL(file);
      });
      const nextConfig = { ...(merchantConfig || {}), logoUrl: logoDataUrl, logoName: file.name };
      await api.updateMerchantConfig(selectedMerchant.id, 'config', nextConfig);
      merchantConfig = nextConfig;
      selectedMerchant = { ...selectedMerchant, logoUrl: logoDataUrl };
      merchants = merchants.map(m => m.id === selectedMerchant.id ? { ...m, logoUrl: logoDataUrl } : m);
      toast.success('Merchant logo saved');
    } catch (e) {
      console.error('[MerchantMgmt] handleMerchantLogoUpload error:', e);
      toast.error('Logo could not be saved');
    } finally {
      merchantLogoUploading = false;
      input.value = '';
    }
  }

  async function toggleMerchantStatus() {
    if (!selectedMerchant) return;
    const currentStatus = selectedMerchant.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const confirmed = window.confirm(
      `Are you sure you want to ${newStatus === 'Suspended' ? 'suspend' : 'activate'} ${selectedMerchant.name}?\n\n` +
      `This will ${newStatus === 'Suspended' ? 'restrict access and functionality' : 'restore full access'} for this merchant.`
    );
    if (!confirmed) return;
    togglingStatus = true;
    try {
      const result = await api.updateMerchantStatus(selectedMerchant.id, newStatus, `Status changed by admin from ${currentStatus} to ${newStatus}`);
      if (result.success) {
        toast.success(`Merchant ${newStatus === 'Suspended' ? 'suspended' : 'activated'} successfully`);
        selectedMerchant = result.merchant;
        loadMerchants();
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] toggleMerchantStatus error:', e);
      toast.error('Failed to update merchant status');
    } finally {
      togglingStatus = false;
    }
  }

  async function handleExportData(type: string, format: 'csv' | 'pdf') {
    if (!selectedMerchant) return;
    exportingData = `${type}-${format}`;
    try {
      const result = await api.exportMerchantData(selectedMerchant.id, type, format);
      if (format === 'csv' && result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `export_${type}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`);
      } else if (format === 'pdf') {
        toast.info('PDF export coming soon - use CSV for now');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleExportData error:', e);
      toast.error('Failed to export data');
    } finally {
      exportingData = null;
    }
  }

  async function loadBatches() {
    batchesLoading = true;
    try {
      const [batchData, emailData] = await Promise.all([
        api.getBatches(),
        api.getEmailNotifications()
      ]);
      batches = Array.isArray(batchData) ? batchData : [];
      emailNotifs = Array.isArray(emailData) ? emailData : [];
    } catch (e) {
      console.error('[MerchantMgmt] loadBatches error:', e);
    } finally {
      batchesLoading = false;
    }
  }

  async function handleDocPreview(docPath: string) {
    if (!docPath) { toast.error('No document path available'); return; }
    previewingDoc = docPath;
    try {
      const result = await api.getSignedUrl(docPath);
      if (result?.url) {
        const link = document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Document opened in new tab');
      } else {
        toast.error(result?.error || 'Failed to generate preview URL');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleDocPreview error:', e);
      toast.error('Failed to open document: ' + (e?.message || 'Unknown error'));
    } finally {
      previewingDoc = null;
    }
  }

  async function loadBilling() {
    billingLoading = true;
    try {
      const [plans, subs, invoices] = await Promise.all([
        api.getBillingPlans(),
        api.getBillingSubscriptions(),
        api.getBillingInvoices()
      ]);
      billingPlans = Array.isArray(plans) ? plans : [];
      billingSubscriptions = Array.isArray(subs) ? subs : [];
      billingInvoices = Array.isArray(invoices) ? invoices : [];
    } catch (e) {
      console.error('[MerchantMgmt] loadBilling error:', e);
    } finally {
      billingLoading = false;
    }
  }

  async function handleSettleBatch(batchId: string) {
    settlingBatch = batchId;
    try {
      const result = await api.settleBatch(batchId);
      if (result.success) {
        toast.success(`Batch ${batchId} settled successfully`);
        showSettleConfirm = null;
        loadBatches();
      } else {
        toast.error(result.error || 'Settlement failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleSettleBatch error:', e);
      toast.error('Settlement failed: ' + (e?.message || 'Unknown error'));
    } finally {
      settlingBatch = null;
    }
  }

  async function handleAssignPlan() {
    if (!assigningPlan || !selectedPlanId) return;
    subscribing = true;
    try {
      const result = await api.createSubscription(assigningPlan.merchantId, selectedPlanId);
      if (result.success) {
        toast.success(`${assigningPlan.merchantName} subscribed to ${result.subscription?.planName || selectedPlanId} plan`);
        assigningPlan = null;
        selectedPlanId = '';
        loadBilling();
      } else {
        toast.error(result.error || 'Subscription failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleAssignPlan error:', e);
      toast.error('Subscription failed: ' + (e?.message || 'Unknown error'));
    } finally {
      subscribing = false;
    }
  }

  async function handleCancelSubscription(merchantId: string) {
    cancelling = merchantId;
    try {
      const result = await api.cancelSubscription(merchantId);
      if (result.success) {
        toast.success('Subscription cancelled');
        loadBilling();
      } else {
        toast.error(result.error || 'Cancellation failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleCancelSubscription error:', e);
      toast.error('Cancellation failed');
    } finally {
      cancelling = null;
    }
  }

  async function openDowngradeModal(merchantId: string, merchantName: string, currentPlanId: string) {
    downgradeTarget = { merchantId, merchantName, currentPlanId };
    downgradeNewPlanId = '';
    downgradePreview = null;
  }

  async function loadDowngradePreview(newPlanId: string) {
    if (!downgradeTarget) return;
    downgradeNewPlanId = newPlanId;
    downgradeLoading = true;
    try {
      const result = await api.downgradePreview(downgradeTarget.merchantId, newPlanId);
      if (result.success) {
        downgradePreview = result.preview;
      } else {
        toast.error(result.error || 'Failed to load downgrade preview');
        downgradePreview = null;
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] loadDowngradePreview error:', e);
      toast.error('Failed to preview downgrade');
    } finally {
      downgradeLoading = false;
    }
  }

  async function handleConfirmDowngrade() {
    if (!downgradeTarget || !downgradeNewPlanId) return;
    downgradeProcessing = true;
    try {
      const result = await api.downgradePlan(downgradeTarget.merchantId, downgradeNewPlanId);
      if (result.success) {
        toast.success(`Plan downgraded successfully`, { description: `Credit of R ${result.downgradeDetails?.creditAmount?.toFixed(2)} applied` });
        downgradeTarget = null;
        downgradePreview = null;
        loadBilling();
      } else {
        toast.error(result.error || 'Downgrade failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleConfirmDowngrade error:', e);
      toast.error('Downgrade failed: ' + (e?.message || 'Unknown error'));
    } finally {
      downgradeProcessing = false;
    }
  }

  async function openCancelFlow(merchantId: string, merchantName: string) {
    cancelTarget = { merchantId, merchantName };
    cancelStep = 'reason';
    cancelReason = '';
    cancelFeedback = '';
    cancelImmediately = false;
    cancelProcessing = true;
    try {
      const result = await api.cancelPreview(merchantId);
      if (result.success) {
        cancelPreview = result.preview;
      }
    } catch (e) {
      console.error('[MerchantMgmt] openCancelFlow error:', e);
    } finally {
      cancelProcessing = false;
    }
  }

  async function handleAcceptRetention() {
    if (!cancelTarget) return;
    cancelProcessing = true;
    try {
      const result = await api.cancelWithReason(cancelTarget.merchantId, { reason: cancelReason, feedback: cancelFeedback, acceptRetention: true });
      if (result.success && result.retained) {
        toast.success('Retention offer applied!', { description: result.message });
        cancelTarget = null;
        cancelPreview = null;
        loadBilling();
      } else {
        toast.error(result.error || 'Failed to apply retention offer');
      }
    } catch (e: any) {
      toast.error('Failed to apply retention offer');
    } finally {
      cancelProcessing = false;
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !cancelReason) return;
    cancelProcessing = true;
    try {
      const result = await api.cancelWithReason(cancelTarget.merchantId, {
        reason: cancelReason,
        feedback: cancelFeedback,
        cancelImmediately,
      });
      if (result.success) {
        toast.success(cancelImmediately ? 'Subscription cancelled' : 'Cancellation scheduled', { description: result.message });
        cancelTarget = null;
        cancelPreview = null;
        loadBilling();
      } else {
        toast.error(result.error || 'Cancellation failed');
      }
    } catch (e: any) {
      toast.error('Cancellation failed');
    } finally {
      cancelProcessing = false;
    }
  }

  async function handleReverseCancellation(merchantId: string) {
    cancelling = merchantId;
    try {
      const result = await api.reverseCancellation(merchantId);
      if (result.success) {
        toast.success('Cancellation reversed');
        loadBilling();
      } else {
        toast.error(result.error || 'Failed to reverse cancellation');
      }
    } catch (e: any) {
      toast.error('Failed to reverse cancellation');
    } finally {
      cancelling = null;
    }
  }

  let filteredBatches = $derived(
    batchMerchantFilter === 'all'
      ? batches
      : batches.filter(b => b.merchantId === batchMerchantFilter)
  );

  let uniqueBatchMerchants = $derived([...new Set(batches.map(b => b.merchantId).filter(Boolean))]);

  async function handleApproveApp(app: any) {
    if (!app?.merchantId) return;
    approving = true;
    approvalResult = null;
    try {
      const result = await api.approveMerchant(app.merchantId, appTerminalCount);
      if (result.success) {
        await api.approveApplication(app.id);
        approvalResult = result;
        toast.success(`Merchant approved with ${result.terminals} terminal(s)`);
        loadApplications();
        loadMerchants();
      } else {
        toast.error(result.error || 'Approval failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleApproveApp error:', e);
      toast.error('Approval failed: ' + (e?.message || 'Unknown error'));
    } finally {
      approving = false;
    }
  }

  async function handleRejectApp(app: any) {
    if (!app?.id) return;
    rejecting = true;
    try {
      const result = await api.rejectApplication(app.id, rejectReason || 'Application did not meet requirements');
      if (result.success) {
        toast.success('Application rejected');
        showRejectModal = false;
        rejectReason = '';
        selectedApp = null;
        loadApplications();
        loadMerchants();
      } else {
        toast.error(result.error || 'Rejection failed');
      }
    } catch (e: any) {
      console.error('[MerchantMgmt] handleRejectApp error:', e);
      toast.error('Rejection failed: ' + (e?.message || 'Unknown error'));
    } finally {
      rejecting = false;
    }
  }

  let filteredApps = $derived(appFilter === 'all' ? applications : applications.filter(a => a.status === appFilter));

  let merchantTypes = $derived([...new Set(merchants.map(m => m.type || 'Retail').filter(Boolean))].sort());
  let filteredMerchants = $derived(merchants.filter(m => {
    const query = merchantSearch.trim().toLowerCase();
    const matchesSearch = !query || [m.name, m.id, m.email, m.contactEmail, m.address, m.type].some(value => String(value || '').toLowerCase().includes(query));
    const matchesStatus = merchantStatusFilter === 'all' || (m.status || 'Active') === merchantStatusFilter;
    const matchesType = merchantTypeFilter === 'all' || (m.type || 'Retail') === merchantTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }));
  let activeMerchantCount = $derived(merchants.filter(m => (m.status || 'Active') === 'Active').length);
  let pendingMerchantCount = $derived(merchants.filter(m => m.status === 'Pending').length);
  let merchantTerminalTotal = $derived(merchants.reduce((sum, m) => sum + Number(m.terminalCount || 0), 0));

  function statusBadge(status: string) {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  }
</script>

<div class="p-10 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
    <div>
      <h2 class="text-4xl font-black tracking-tight mb-2 text-neutral-900 dark:text-neutral-100">Merchant Control Center</h2>
      <p class="text-neutral-500 font-medium">Network Oversight â€¢ Forensic Audits â€¢ Loyalty Governance</p>
    </div>
    <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-[28px] shadow-inner overflow-x-auto scrollbar-hide">
      {#each [
        { id: 'merchants', label: 'Merchants', icon: Store, hidden: !isAdmin },
        { id: 'applications', label: 'Applications', icon: Mail, hidden: !isAdmin },
        { id: 'loyalty', label: 'Loyalty Engine', icon: Heart, hidden: !isAdmin },
        { id: 'receipts', label: 'Audit Logs', icon: ShieldCheck },
        { id: 'batches', label: 'Batches', icon: Database },
        { id: 'billing', label: 'Billing', icon: CreditCard, hidden: !isAdmin },
      ].filter(t => !t.hidden) as t}
        {@const TabIcon = t.icon}
        <button
          onclick={() => activeTab = t.id as any}
          class={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xl scale-105' : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'}`}
        >
          <TabIcon class="w-4 h-4" />
          {t.label}
        </button>
      {/each}
    </div>
  </div>

  {#if activeTab === 'merchants' && !selectedMerchant}
    <div class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 bg-indigo-600 text-white rounded-[28px] shadow-xl shadow-indigo-200 dark:shadow-indigo-950/40 relative overflow-hidden">
          <div class="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10"></div>
          <p class="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-100">Fleet pulse</p>
          <p class="text-3xl font-black mt-2">{merchants.length}</p>
          <p class="text-[10px] font-bold text-indigo-100 mt-1">merchant profiles in the network</p>
        </div>
        <div class="p-5 bg-white dark:bg-neutral-800/50 rounded-[28px] border border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center justify-between"><p class="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">Live accounts</p><CheckCircle2 class="w-4 h-4 text-emerald-500" /></div>
          <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100 mt-2">{activeMerchantCount}</p>
          <p class="text-[10px] font-bold text-emerald-500 mt-1">{pendingMerchantCount} awaiting review</p>
        </div>
        <div class="p-5 bg-white dark:bg-neutral-800/50 rounded-[28px] border border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center justify-between"><p class="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">Provisioned terminals</p><Monitor class="w-4 h-4 text-indigo-500" /></div>
          <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100 mt-2">{merchantTerminalTotal}</p>
          <p class="text-[10px] font-bold text-neutral-400 mt-1">across the merchant fleet</p>
        </div>
      </div>

      <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
          <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Registered merchant fleet</h3>
              <p class="text-[10px] font-bold text-neutral-400 mt-1">Search by business, node, contact, or location</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <label class="relative min-w-0 sm:min-w-[260px]">
                <span class="sr-only">Search merchants</span>
                <Search class="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input bind:value={merchantSearch} placeholder="Search merchants..." class="w-full pl-11 pr-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </label>
              <label>
                <span class="sr-only">Filter by status</span>
                <select bind:value={merchantStatusFilter} class="w-full sm:w-auto py-3 px-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="all">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </label>
              <label>
                <span class="sr-only">Filter by type</span>
                <select bind:value={merchantTypeFilter} class="w-full sm:w-auto py-3 px-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="all">All types</option>
                  {#each merchantTypes as type}<option value={type}>{type}</option>{/each}
                </select>
              </label>
              <button onclick={loadMerchants} class="p-3 hover:bg-white dark:hover:bg-neutral-700 rounded-2xl transition-all border border-neutral-200 dark:border-neutral-700" title="Refresh merchants"><RefreshCw class="w-4 h-4 text-neutral-400" /></button>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5">
            <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400"><Sliders class="w-3.5 h-3.5" /> Showing {filteredMerchants.length} of {merchants.length} merchants</div>
            <div class="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl" aria-label="Merchant view mode">
              <button onclick={() => merchantView = 'cards'} aria-label="Show merchant cards" aria-pressed={merchantView === 'cards'} class={`flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${merchantView === 'cards' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
                <Store class="w-3.5 h-3.5" /> Cards
              </button>
              <button onclick={() => merchantView = 'table'} aria-label="Show merchants in a table" aria-pressed={merchantView === 'table'} class={`flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${merchantView === 'table' ? 'bg-white dark:bg-neutral-700 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
                <TableIcon class="w-3.5 h-3.5" /> Table
              </button>
            </div>
          </div>
        </div>
        {#if merchantView === 'cards'}
        <div class="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredMerchants as m}
          <div key={m.id} onclick={() => loadMerchantDetail(m)} onkeydown={e => e.key === 'Enter' && loadMerchantDetail(m)} role="button" tabindex="0" class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700 hover:border-indigo-300 transition-all group relative overflow-hidden cursor-pointer hover:shadow-xl">
            <div class="flex items-center justify-between mb-6">
              <div class="w-12 h-12 bg-white dark:bg-neutral-700 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-neutral-100 dark:border-neutral-600 group-hover:bg-indigo-600 group-hover:text-white transition-all overflow-hidden">
                {#if m.logoUrl}<img src={m.logoUrl} alt={`${m.name} logo`} class="w-full h-full object-contain p-2" />{:else}{m.type === 'Forecourt' ? '\u26FD' : m.type === 'Restaurant' ? '\uD83C\uDF7D' : m.type === 'Workshop' ? '\uD83D\uDD27' : '\uD83D\uDED2'}{/if}
              </div>
              <span class={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : m.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                {m.status}
              </span>
            </div>
            <h4 class="text-xl font-black text-neutral-900 dark:text-neutral-100 mb-2 truncate">{m.name}</h4>
            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">{m.id}</p>
            <div class="flex items-center gap-3 text-[9px] text-neutral-400 font-bold">
              <span class="flex items-center gap-1"><MapPin class="w-3 h-3" />{m.type || 'Retail'}</span>
              <span>&bull;</span>
              <span class="flex items-center gap-1"><Monitor class="w-3 h-3" />{m.terminalCount || 'â€”'} terminals</span>
            </div>
            <div class="mt-4 pt-4 border-t border-neutral-200/70 dark:border-neutral-700 flex items-center justify-between text-[9px] font-bold text-neutral-400">
              <span>{m.email || m.contactEmail || 'No contact email'}</span>
              <span class="text-emerald-500">{m.status === 'Active' ? 'Operational' : 'Needs attention'}</span>
            </div>
            <div class="mt-5 flex items-center justify-between">
              <span class="text-[10px] font-black uppercase tracking-widest text-indigo-500 group-hover:text-indigo-600 transition-all">View Details</span>
              <ChevronRight class="w-4 h-4 text-neutral-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        {/each}
        {#if filteredMerchants.length === 0}
          <div class="md:col-span-2 lg:col-span-3 py-20 text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"><Search class="w-6 h-6 text-neutral-400" /></div>
            <p class="mt-4 text-sm font-black text-neutral-700 dark:text-neutral-200">No merchants match those filters</p>
            <p class="text-[10px] text-neutral-400 font-bold mt-1">Try a different search term or reset the filters.</p>
          </div>
        {/if}
      </div>
        {:else}
          <div class="p-4 sm:p-8 overflow-x-auto">
            <table class="w-full min-w-[820px] text-left border-separate border-spacing-0">
              <thead>
                <tr>
                  {#each ['Merchant', 'Type', 'Location', 'Terminals', 'Status', 'Joined', ''] as heading}
                    <th class="px-4 py-4 border-b border-neutral-200 dark:border-neutral-700 text-[9px] font-black uppercase tracking-[0.18em] text-neutral-400">{heading}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each filteredMerchants as m}
                  <tr class="group cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors" onclick={() => loadMerchantDetail(m)} onkeydown={e => e.key === 'Enter' && loadMerchantDetail(m)} role="button" tabindex="0">
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                          {#if m.logoUrl}<img src={m.logoUrl} alt={`${m.name} logo`} class="w-full h-full object-contain p-1.5" />{:else}<Store class="w-4 h-4 text-neutral-400" />{/if}
                        </div>
                        <div class="min-w-0"><p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate max-w-[220px]">{m.name}</p><p class="text-[9px] font-mono text-neutral-400 mt-1">{m.id}</p></div>
                      </div>
                    </td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"><span class="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">{m.type || 'Retail'}</span></td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"><span class="inline-flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 max-w-[180px] truncate"><MapPin class="w-3 h-3 shrink-0" />{m.address || 'No address recorded'}</span></td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"><span class="inline-flex items-center gap-1.5 text-[10px] font-black text-neutral-700 dark:text-neutral-200"><Monitor class="w-3 h-3 text-indigo-500" />{m.terminalCount || 0}</span></td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"><span class={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : m.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>{m.status || 'Active'}</span></td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"><span class="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}</span></td>
                    <td class="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800 text-right"><ChevronRight class="w-4 h-4 ml-auto text-neutral-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" /></td>
                  </tr>
                {/each}
                {#if filteredMerchants.length === 0}
                  <tr><td colspan="7" class="py-20 text-center"><Search class="w-6 h-6 mx-auto text-neutral-300" /><p class="mt-3 text-sm font-black text-neutral-700 dark:text-neutral-200">No merchants match those filters</p><p class="text-[10px] text-neutral-400 font-bold mt-1">Try a different search term or reset the filters.</p></td></tr>
                {/if}
              </tbody>
            </table>
          </div>
        {/if}
    </div>
    </div>
  {/if}

  {#if activeTab === 'merchants' && selectedMerchant}
    <div in:fly={{ y: 10, opacity: 0, duration: 500 }} class="space-y-6 animate-in fade-in duration-500">
      <button onclick={() => selectedMerchant = null} class="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-black text-[10px] uppercase tracking-widest transition-all">
        <ArrowLeft class="w-4 h-4" /> Back to Fleet
      </button>

      <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-10 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 relative overflow-hidden">
          <div class="absolute inset-0 opacity-5" style="background: radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 60%)"></div>
          <div class="relative flex flex-col md:flex-row md:items-center gap-8">
            <div class="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center text-white text-4xl shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/50 shrink-0">
              {selectedMerchant.type === 'Forecourt' ? '\u26FD' : selectedMerchant.type === 'Restaurant' ? '\uD83C\uDF7D' : selectedMerchant.type === 'Workshop' ? '\uD83D\uDD27' : '\uD83D\uDED2'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h3 class="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">{selectedMerchant.name}</h3>
                <span class={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${selectedMerchant.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : selectedMerchant.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                  {selectedMerchant.status}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <span>{selectedMerchant.id}</span>
                <div class="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
                <span class="text-indigo-500">{selectedMerchant.type || 'Retail'} Profile</span>
                {#if selectedMerchant.createdAt}
                  <div class="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
                  <span>Since {new Date(selectedMerchant.createdAt).toLocaleDateString()}</span>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <button
                onclick={toggleMerchantStatus}
                disabled={togglingStatus}
                class={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMerchant.status === 'Active' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/30' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30'} ${togglingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={selectedMerchant.status === 'Active' ? 'Suspend Merchant' : 'Activate Merchant'}
              >
                {#if togglingStatus}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else if selectedMerchant.status === 'Active'}
                  <Ban class="w-4 h-4" />
                {:else}
                  <CheckCircle class="w-4 h-4" />
                {/if}
                {togglingStatus ? 'Updating...' : selectedMerchant.status === 'Active' ? 'Suspend' : 'Activate'}
              </button>
              <button onclick={() => loadMerchantDetail(selectedMerchant)} class="p-2.5 hover:bg-white dark:hover:bg-neutral-700 rounded-xl transition-all border border-neutral-200 dark:border-neutral-700 shrink-0" title="Refresh">
                <RefreshCw class={`w-4 h-4 text-neutral-400 ${detailLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div class="px-10 py-6 border-b border-neutral-100 dark:border-neutral-700 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
            <div class="flex items-center gap-2 mb-2">
              <Monitor class="w-4 h-4 text-indigo-500" />
              <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">Terminals</p>
            </div>
            <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{terminals.length}</p>
            <p class="text-[9px] font-bold text-emerald-500">{terminals.filter(t => t.status === 'Online').length} online</p>
          </div>
          <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
            <div class="flex items-center gap-2 mb-2">
              <Users class="w-4 h-4 text-amber-500" />
              <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">Staff</p>
            </div>
            <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{merchantUsers.length}</p>
            <p class="text-[9px] font-bold text-neutral-400">registered users</p>
          </div>
          <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
            <div class="flex items-center gap-2 mb-2">
              <Receipt class="w-4 h-4 text-emerald-500" />
              <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">Transactions</p>
            </div>
            <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{merchantTransactions.length}</p>
            <p class="text-[9px] font-bold text-neutral-400">total records</p>
          </div>
          <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
            <div class="flex items-center gap-2 mb-2">
              <DollarSign class="w-4 h-4 text-rose-500" />
              <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">Revenue</p>
            </div>
            <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">
              R {merchantTransactions.reduce((sum, t) => sum + (t.total || t.amount || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p class="text-[9px] font-bold text-neutral-400">gross volume</p>
          </div>
        </div>

        <div class="px-10 py-4 border-b border-neutral-100 dark:border-neutral-700 flex flex-wrap gap-1 overflow-x-auto scrollbar-hide">
          {#each [
            { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
            { id: 'terminals' as const, label: 'Terminals', icon: Monitor },
            { id: 'staff' as const, label: 'Staff', icon: Users },
            { id: 'transactions' as const, label: 'Transactions', icon: Receipt },
            { id: 'billing' as const, label: 'Billing', icon: CreditCard },
            { id: 'audit' as const, label: 'Audit Trail', icon: Shield },
          ] as t}
            {@const TabIcon = t.icon}
            <button
              onclick={() => merchantDetailTab = t.id}
              class={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${merchantDetailTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              <TabIcon class="w-3.5 h-3.5" /> {t.label}
            </button>
          {/each}
        </div>

        <div class="p-10 min-h-[400px]">
          {#if detailLoading}
            <div class="flex flex-col items-center justify-center py-20">
              <Loader2 class="w-8 h-8 animate-spin text-neutral-300 mb-4" />
              <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Loading Merchant Intelligence...</p>
            </div>
          {:else}
            {#if merchantDetailTab === 'overview'}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-6">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Building2 class="w-3.5 h-3.5" /> Business Information</h5>
                  <div class="space-y-3">
                    {#each [
                      { label: 'Legal Name', value: selectedMerchant.name || 'N/A' },
                      { label: 'Merchant ID', value: selectedMerchant.id },
                      { label: 'Profile Type', value: selectedMerchant.type || 'Retail' },
                      { label: 'Status', value: selectedMerchant.status || 'N/A' },
                      { label: 'Contact Email', value: selectedMerchant.email || selectedMerchant.contactEmail || 'N/A' },
                      { label: 'Contact Phone', value: selectedMerchant.phone || selectedMerchant.contactPhone || 'N/A' },
                      { label: 'Address', value: selectedMerchant.address || 'N/A' },
                      { label: 'Created', value: selectedMerchant.createdAt ? new Date(selectedMerchant.createdAt).toLocaleString() : 'N/A' },
                    ] as f}
                      <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                        <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">{f.label}</p>
                        <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200 text-right max-w-[60%] truncate">{f.value}</p>
                      </div>
                    {/each}
                  </div>

                  <div class="p-6 rounded-[28px] border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
                    <div class="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <h5 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><ImageIcon class="w-4 h-4" /> Merchant logo</h5>
                        <p class="text-[10px] font-bold text-neutral-400 mt-1">Used on receipts, displays, and merchant-facing surfaces.</p>
                      </div>
                      <span class="text-[9px] font-black uppercase tracking-widest text-neutral-400">PNG / JPG · 2 MB</span>
                    </div>
                    <div class="flex items-center gap-5">
                      <div class="w-20 h-20 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                        {#if merchantConfig?.logoUrl || selectedMerchant.logoUrl}
                          <img src={merchantConfig?.logoUrl || selectedMerchant.logoUrl} alt={`${selectedMerchant.name} logo`} class="w-full h-full object-contain p-2" />
                        {:else}
                          <Store class="w-8 h-8 text-neutral-300" />
                        {/if}
                      </div>
                      <div>
                        <label class={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${merchantLogoUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                          {#if merchantLogoUploading}<Loader2 class="w-3.5 h-3.5 animate-spin" /> Saving...{:else}<UploadCloud class="w-3.5 h-3.5" /> Upload logo{/if}
                          <input type="file" accept="image/png,image/jpeg,image/webp" onchange={handleMerchantLogoUpload} class="sr-only" disabled={merchantLogoUploading} />
                        </label>
                        <p class="text-[10px] text-neutral-400 font-bold mt-2">Choose a square image for the cleanest display.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="space-y-6">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Zap class="w-3.5 h-3.5" /> Configuration & Settings</h5>
                  <div class="space-y-3">
                    {#if merchantConfig && typeof merchantConfig === 'object'}
                      {#each Object.entries(merchantConfig).filter(([k]) => !['id', 'key', 'merchantId'].includes(k)).slice(0, 8) as [key, val]}
                        <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                          <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
                          <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200 text-right max-w-[60%] truncate">{String(val)}</p>
                        </div>
                      {/each}
                    {:else}
                      <div class="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 text-center">
                        <Settings class="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                        <p class="text-[10px] font-bold text-neutral-400">Default configuration active</p>
                      </div>
                    {/if}
                  </div>

                  <div class="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[32px] border border-indigo-100 dark:border-indigo-800/30">
                    <h5 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2"><Activity class="w-4 h-4" /> Quick Stats</h5>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <p class="text-[10px] font-black uppercase text-indigo-400 mb-1">Terminals Online</p>
                        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{terminals.filter(t => t.status === 'Online').length}/{terminals.length}</p>
                      </div>
                      <div>
                        <p class="text-[10px] font-black uppercase text-indigo-400 mb-1">Audit Events</p>
                        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{auditLogs.length}</p>
                      </div>
                      <div>
                        <p class="text-[10px] font-black uppercase text-indigo-400 mb-1">Avg Basket</p>
                        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                          R {merchantTransactions.length > 0 ? (merchantTransactions.reduce((s, t) => s + (t.total || t.amount || 0), 0) / merchantTransactions.length).toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <div>
                        <p class="text-[10px] font-black uppercase text-indigo-400 mb-1">Staff Count</p>
                        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{merchantUsers.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {:else if merchantDetailTab === 'terminals'}
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Monitor class="w-3.5 h-3.5" /> Hardware Registry â€” {terminals.length} Device(s)</h5>
                  {#if terminals.length > 0}
                    <button
                      onclick={() => handleExportData('terminals', 'csv')}
                      disabled={exportingData === 'terminals-csv'}
                      class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {#if exportingData === ''}<Loader2></Loader2>{:else}<Download></Download>{/if}
                      Export CSV
                    </button>
                  {/if}
                </div>
                {#if terminals.length === 0}
                  <div class="py-16 text-center">
                    <Monitor class="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p class="text-sm font-black text-neutral-400">No terminals provisioned</p>
                    <p class="text-[10px] text-neutral-400 font-medium mt-1">Terminals will appear after merchant approval & provisioning</p>
                  </div>
                {:else}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each terminals as term}
                      <div class="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-[24px] border border-neutral-100 dark:border-neutral-700 hover:border-indigo-200 transition-all">
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex items-center gap-4">
                            <div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${term.status === 'Online' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-neutral-700'}`}>
                              {#if term.type === ''}<Phone></Phone>{:else}<Monitor></Monitor>{/if}
                            </div>
                            <div>
                              <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{term.name}</p>
                              <p class="text-[9px] font-mono text-neutral-400 uppercase">{term.id}</p>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <div class={`w-2 h-2 rounded-full ${term.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`}></div>
                            <span class={`text-[9px] font-black uppercase tracking-widest ${term.status === 'Online' ? 'text-emerald-600' : 'text-neutral-400'}`}>{term.status}</span>
                          </div>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                          {#each [
                            { label: 'Type', value: term.type || 'Desktop' },
                            { label: 'Version', value: `v${term.version || '1.0'}` },
                            { label: 'Last Seen', value: term.lastSeen ? new Date(term.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A' },
                          ] as f}
                            <div class="text-center">
                              <p class="text-[7px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">{f.label}</p>
                              <p class="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{f.value}</p>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if merchantDetailTab === 'staff'}
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Users class="w-3.5 h-3.5" /> Registered Staff â€” {merchantUsers.length} User(s)</h5>
                  {#if merchantUsers.length > 0}
                    <button
                      onclick={() => handleExportData('staff', 'csv')}
                      disabled={exportingData === 'staff-csv'}
                      class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {#if exportingData === ''}<Loader2></Loader2>{:else}<Download></Download>{/if}
                      Export CSV
                    </button>
                  {/if}
                </div>
                {#if merchantUsers.length === 0}
                  <div class="py-16 text-center">
                    <Users class="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p class="text-sm font-black text-neutral-400">No staff registered</p>
                    <p class="text-[10px] text-neutral-400 font-medium mt-1">Users will appear after being provisioned for this merchant</p>
                  </div>
                {:else}
                  <div class="space-y-3">
                    {#each merchantUsers as user}
                      <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center gap-5 hover:border-indigo-200 transition-all">
                        <div class="w-11 h-11 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shrink-0">
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate">{user.name || 'Unnamed User'}</p>
                          <p class="text-[9px] font-bold text-neutral-400 truncate">{user.email}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 shrink-0">
                          {user.role || 'N/A'}
                        </span>
                        <div class="flex items-center gap-2 shrink-0">
                          <div class={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-300'}`}></div>
                          <span class="text-[8px] font-black uppercase tracking-widest text-neutral-400">{user.status || 'Active'}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if merchantDetailTab === 'transactions'}
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Receipt class="w-3.5 h-3.5" /> Transaction Ledger â€” {merchantTransactions.length} Record(s)</h5>
                  {#if merchantTransactions.length > 0}
                    <button
                      onclick={() => handleExportData('transactions', 'csv')}
                      disabled={exportingData === 'transactions-csv'}
                      class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {#if exportingData === ''}<Loader2></Loader2>{:else}<Download></Download>{/if}
                      Export CSV
                    </button>
                  {/if}
                </div>
                <div class="flex items-center gap-4 text-right">
                  <div>
                    <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Gross Volume</p>
                    <p class="text-lg font-black text-neutral-900 dark:text-neutral-100">R {merchantTransactions.reduce((s, t) => s + (t.total || t.amount || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Refunds</p>
                    <p class="text-lg font-black text-rose-500">R {merchantTransactions.filter(t => t.type === 'REFUND' || t.refund).reduce((s, t) => s + Math.abs(t.total || t.amount || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                {#if merchantTransactions.length === 0}
                  <div class="py-16 text-center">
                    <Receipt class="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                    <p class="text-sm font-black text-neutral-400">No transactions recorded</p>
                    <p class="text-[10px] text-neutral-400 font-medium mt-1">Sales data will appear as the POS processes transactions</p>
                  </div>
                {:else}
                  <div class="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {#each merchantTransactions.slice(0, 50) as txn, i}
                      <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center gap-4 hover:bg-white dark:hover:bg-neutral-700 transition-all">
                        <div class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${txn.type === 'REFUND' || txn.refund ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500'}`}>
                          {#if txn.type === 'REFUND' || txn.refund}<ArrowLeft></ArrowLeft>{:else}<ArrowRight></ArrowRight>{/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{txn.receiptNumber || txn.id || `TXN-${i + 1}`}</p>
                          <p class="text-[9px] font-bold text-neutral-400">
                            {txn.timestamp || txn.date ? new Date(txn.timestamp || txn.date).toLocaleString() : 'N/A'}
                            {txn.cashier ? ` â€¢ ${txn.cashier}` : ''}
                            {txn.items ? ` â€¢ ${Array.isArray(txn.items) ? txn.items.length : txn.items} items` : ''}
                          </p>
                        </div>
                        <div class="text-right shrink-0">
                          <p class={`text-sm font-black ${txn.type === 'REFUND' || txn.refund ? 'text-rose-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
                            {txn.type === 'REFUND' || txn.refund ? '-' : ''}R {Math.abs(txn.total || txn.amount || 0).toFixed(2)}
                          </p>
                          <p class="text-[8px] font-bold text-neutral-400 uppercase">{txn.paymentMethod || txn.method || 'CARD'}</p>
                        </div>
                      </div>
                    {/each}
                    {#if merchantTransactions.length > 50}
                      <p class="text-center text-[10px] font-black text-neutral-400 uppercase tracking-widest py-4">Showing 50 of {merchantTransactions.length} transactions</p>
                    {/if}
                  </div>
                {/if}
              </div>
            {:else if merchantDetailTab === 'billing'}
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><CreditCard class="w-3.5 h-3.5" /> Subscription & Billing</h5>
                  {#if merchantInvoices.length > 0}
                    <button
                      onclick={() => handleExportData('billing', 'csv')}
                      disabled={exportingData === 'billing-csv'}
                      class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {#if exportingData === ''}<Loader2></Loader2>{:else}<Download></Download>{/if}
                      Export CSV
                    </button>
                  {/if}
                </div>

                <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700">
                  {#if merchantSubscription}
                    <div class="space-y-4">
                      <div class="flex items-center justify-between">
                        <div>
                          <p class="text-lg font-black text-neutral-900 dark:text-neutral-100">{merchantSubscription.planName || 'Active Plan'}</p>
                          <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            {merchantSubscription.status || 'Active'} &bull; Since {merchantSubscription.startDate ? new Date(merchantSubscription.startDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div class="text-right">
                          <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">R {(merchantSubscription.amount || merchantSubscription.price || 0).toFixed(2)}</p>
                          <p class="text-[9px] font-bold text-neutral-400 uppercase">/month</p>
                        </div>
                      </div>
                      {#if merchantSubscription.features && Array.isArray(merchantSubscription.features)}
                        <div class="flex flex-wrap gap-2 pt-2">
                          {#each merchantSubscription.features as f}
                            <span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{f}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <div class="text-center py-6">
                      <CreditCard class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p class="text-sm font-black text-neutral-400">No active subscription</p>
                      <p class="text-[10px] text-neutral-400 font-medium mt-1">Assign a billing plan from the Billing tab</p>
                    </div>
                {/if}
                </div>

                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><FileText class="w-3.5 h-3.5" /> Invoice History &mdash; {merchantInvoices.length} Invoice(s)</h5>
                {#if merchantInvoices.length === 0}
                  <div class="py-10 text-center bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                    <FileText class="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                    <p class="text-[10px] font-bold text-neutral-400">No invoices generated yet</p>
                  </div>
                {:else}
                  <div class="space-y-2">
                    {#each merchantInvoices.slice(0, 10) as inv, i}
                      <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center gap-4">
                        <div class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-500' : 'bg-amber-100 text-amber-500'}`}>
                          {#if inv.status === 'Paid'}<CheckCircle class="w-4 h-4" />{:else}<Clock class="w-4 h-4" />{/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-black text-neutral-900 dark:text-neutral-100">{inv.id || `INV-${i + 1}`}</p>
                          <p class="text-[9px] font-bold text-neutral-400">{inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'} &bull; {inv.status || 'Pending'}</p>
                        </div>
                        <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 shrink-0">R {(inv.amount || 0).toFixed(2)}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}

    <div class="space-y-8 animate-in fade-in duration-500">
      {#if selectedApp && !approvalResult}
        <div in:fly={{ y: 10, opacity: 0, duration: 500 }} class="space-y-8">
          <button onclick={() => { selectedApp = null; appTerminalCount = 1; approvalResult = null; }} class="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-black text-[10px] uppercase tracking-widest transition-all">
            <ArrowLeft class="w-4 h-4" /> Back to Applications
          </button>

          <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
            <div class="p-10 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-6">
                  <div class="w-16 h-16 bg-amber-500 rounded-[24px] flex items-center justify-center text-black shadow-lg">
                    <Mail class="w-8 h-8" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                      {selectedApp.businessInfo?.legalName || 'Unknown Business'}
                    </h3>
                    <div class="flex items-center gap-4 mt-1">
                      <span class="text-[10px] font-black uppercase tracking-widest text-neutral-400">{selectedApp.applicationId}</span>
                      <div class="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-amber-500">{selectedApp.businessInfo?.type || 'Retail'}</span>
                      <div class="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
                      <span class={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge(selectedApp.status)}`}>
                        {selectedApp.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                Submitted {selectedApp.submittedAt ? new Date(selectedApp.submittedAt).toLocaleString() : 'N/A'} &bull; Merchant Node: {selectedApp.merchantId || 'N/A'}
              </p>
            </div>

            <div class="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div class="space-y-6">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Users class="w-3.5 h-3.5" /> Primary Contact</h5>
                <div class="space-y-3">
                  {#each [
                    { label: 'Name', value: `${selectedApp.account?.firstName || ''} ${selectedApp.account?.lastName || ''}`.trim() || 'N/A' },
                    { label: 'Email', value: selectedApp.account?.email || 'N/A' },
                    { label: 'Mobile', value: selectedApp.account?.mobile || 'N/A' },
                  ] as f}
                    <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">{f.label}</p>
                      <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{f.value}</p>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="space-y-6">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Building2 class="w-3.5 h-3.5" /> Business Details</h5>
                <div class="space-y-3">
                  {#each [
                    { label: 'Legal Name', value: selectedApp.businessInfo?.legalName || 'N/A' },
                    { label: 'Type', value: selectedApp.businessInfo?.type || 'N/A' },
                    { label: 'Monthly Sales', value: selectedApp.businessInfo?.monthlySales || 'N/A' },
                    { label: 'Address', value: selectedApp.businessInfo?.address || 'N/A' },
                  ] as f}
                    <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">{f.label}</p>
                      <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{f.value}</p>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="space-y-6">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><CreditCard class="w-3.5 h-3.5" /> Banking</h5>
                <div class="space-y-3">
                  {#each [
                    { label: 'Bank', value: selectedApp.banking?.bankName || 'N/A' },
                    { label: 'Account Type', value: selectedApp.banking?.accountType || 'N/A' },
                  ] as f}
                    <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">{f.label}</p>
                      <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{f.value}</p>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="space-y-6">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><MapPin class="w-3.5 h-3.5" /> Location & Hardware</h5>
                <div class="space-y-3">
                  {#each [
                    { label: 'Store Name', value: selectedApp.location?.name || 'N/A' },
                    { label: 'Currency', value: selectedApp.location?.currency || 'ZAR' },
                    { label: 'Hardware Option', value: selectedApp.hardware?.hardwareOption === 'purchase' ? 'Purchase Bundle' : 'BYOD' },
                    { label: 'Requested Terminals', value: String(selectedApp.hardware?.terminalCount || 1) },
                  ] as f}
                    <div class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">{f.label}</p>
                      <p class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{f.value}</p>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="col-span-2 space-y-6">
                <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><CreditCard class="w-3.5 h-3.5" /> Plan & Hardware Investment Estimate</h5>
                <div class={`p-6 rounded-[28px] border-2 ${planInfo.colorClasses}`}>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <div>
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Selected Plan</p>
                      <p class={`text-sm font-black ${planInfo.textColor}`}>{planInfo.info.name}</p>
                    </div>
                    <div>
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Monthly Subscription</p>
                      <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{planInfo.info.monthlyRange}</p>
                    </div>
                    <div>
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Hardware (per unit)</p>
                      <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">~{planInfo.info.hardwareRange}</p>
                    </div>
                    <div>
                      <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Terminals</p>
                      <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{planInfo.termCountSel} unit{planInfo.termCountSel !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div class="p-4 bg-white/60 dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Estimated Once-off Hardware Investment</p>
                        <p class="text-[10px] font-bold text-neutral-500">Based on {planInfo.termCountSel} terminal{planInfo.termCountSel !== 1 ? 's' : ''} at {planInfo.info.hardwareRange} per terminal</p>
                      </div>
                      <div class="text-right">
                        <p class={`text-2xl font-black ${planInfo.textColor}`}>
                          ~R {planInfo.hwTotal.toLocaleString()}{planInfo.hwTotalMax > planInfo.hwTotal ? ` \u2013 R ${planInfo.hwTotalMax.toLocaleString()}` : '+'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="mt-3 flex items-center gap-2 text-[9px] font-bold text-neutral-500">
                    <AlertCircle class="w-3.5 h-3.5" />
                    <span>Hardware costs are estimates and vary based on terminal model, accessories, and supplier pricing.</span>
                  </div>
                </div>
              </div>

              {#if selectedApp.documents && selectedApp.documents.length > 0}
                <div class="col-span-2 space-y-6">
                  <h5 class="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><FileText class="w-3.5 h-3.5" /> Uploaded Documents ({selectedApp.documents.length})</h5>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {#each selectedApp.documents as doc, i}
                      {@const docTypeLabels = { cipc: 'Company Reg (CIPC)', id: 'Director ID', bank: 'Bank Confirmation', proof: 'Proof of Address' }}
                      <div class="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 group/doc hover:border-emerald-300 transition-all">
                        <div class="flex items-center justify-between mb-2">
                          <CheckCircle2 class="w-5 h-5 text-emerald-500" />
                          {#if doc.path}
                            <button
                              onclick={(e) => { e.stopPropagation(); handleDocPreview(doc.path); }}
                              disabled={previewingDoc === doc.path}
                              class="p-1.5 bg-white dark:bg-emerald-800/50 rounded-lg opacity-0 group-hover/doc:opacity-100 hover:bg-emerald-100 dark:hover:bg-emerald-700/50 transition-all border border-emerald-200 dark:border-emerald-700"
                              title="Open document in new tab"
                            >
                              {#if previewingDoc === doc.path}
                                <Loader2 class="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                              {:else}
                                <ExternalLink class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              {/if}
                            </button>
                          {/if}
                        </div>
                        <p class="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">{docTypeLabels[doc.type] || doc.type}</p>
                        <p class="text-[9px] font-bold text-neutral-500 truncate">{doc.name}</p>
                        {#if doc.size}
                          <p class="text-[8px] font-bold text-neutral-400 mt-1">{doc.size}</p>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            {#if selectedApp.status === 'Pending'}
              <div class="p-10 border-t border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
                <div class="flex flex-col md:flex-row items-start md:items-center gap-8">
                  <div class="flex items-center gap-4">
                    <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Terminals to Provision</p>
                    <div class="flex items-center gap-2">
                      <button onclick={() => appTerminalCount = Math.max(1, appTerminalCount - 1)} class="w-10 h-10 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl flex items-center justify-center font-black text-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-all">-</button>
                      <div class="w-16 h-10 bg-neutral-900 dark:bg-neutral-600 text-white rounded-xl flex items-center justify-center font-black text-sm">{appTerminalCount}</div>
                      <button onclick={() => appTerminalCount = appTerminalCount + 1} class="w-10 h-10 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl flex items-center justify-center font-black text-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-all">+</button>
                    </div>
                  </div>
                  {#if true}
                    {@const sp = selectedApp?.plan?.selected || 'kiosk'}
                    {@const perUnit = sp === 'kiosk' || sp === 'starter' ? 1500 : sp === 'standard' || sp === 'professional' ? 12000 : sp === 'multi' || sp === 'enterprise' ? 20000 : 1500}
                    <div class="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <p class="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Est. Hardware</p>
                      <p class="text-sm font-black text-amber-700 dark:text-amber-300">~R {(perUnit * appTerminalCount).toLocaleString()}</p>
                    </div>
                  {/if}
                  <div class="flex-1"></div>
                  <div class="flex items-center gap-4">
                    <button
                      onclick={() => showRejectModal = true}
                      disabled={rejecting}
                      class="flex items-center gap-2 px-8 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Ban class="w-4 h-4" /> Reject
                    </button>
                    <button
                      onclick={() => handleApproveApp(selectedApp)}
                      disabled={approving}
                      class="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {#if approving}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {:else}
                        <CheckCircle class="w-4 h-4" />
                      {/if}
                      {approving ? 'Provisioning...' : 'Approve & Provision'}
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            {#if selectedApp.status === 'Rejected'}
              <div class="p-10 border-t border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                <div class="flex items-start gap-4">
                  <XCircle class="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p class="text-xs font-black text-red-700 dark:text-red-400 mb-1">Application Rejected</p>
                    <p class="text-[10px] text-red-600/70 dark:text-red-400/60 font-medium">{selectedApp.rejectionReason || 'No reason provided'}</p>
                    {#if selectedApp.rejectedAt}
                      <p class="text-[9px] text-red-400/60 mt-2 font-bold">Rejected at {new Date(selectedApp.rejectedAt).toLocaleString()}</p>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else if approvalResult}
        <div in:scale={{ start: 0.95, opacity: 0, duration: 500 }} class="space-y-8">
          <button onclick={() => { selectedApp = null; approvalResult = null; appTerminalCount = 1; }} class="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-black text-[10px] uppercase tracking-widest transition-all">
            <ArrowLeft class="w-4 h-4" /> Back to Applications
          </button>

          <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-emerald-200 dark:border-emerald-800/40 overflow-hidden shadow-lg">
            <div class="p-12 text-center border-b border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10">
              <div class="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 class="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 class="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight mb-2">Merchant Provisioned</h3>
              <p class="text-neutral-500 font-medium">{selectedApp?.businessInfo?.legalName} has been activated on the CLINTPOS network</p>
            </div>

            <div class="p-12 space-y-8">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700 text-center">
                  <Monitor class="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                  <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">{approvalResult.terminals}</p>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Terminals Provisioned</p>
                </div>
                <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700 text-center">
                  <Store class="w-8 h-8 text-amber-500 mx-auto mb-3" />
                  <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 mb-1">{approvalResult.merchant?.name}</p>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{approvalResult.merchant?.type} Profile</p>
                </div>
                <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700 text-center">
                  <Activity class="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                  <p class="text-sm font-black text-emerald-600 dark:text-emerald-400 mb-1">ACTIVE</p>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Merchant Status</p>
                </div>
              </div>

              <div class="p-8 bg-neutral-900 rounded-[32px] text-white relative overflow-hidden">
                <div class="relative z-10">
                  <div class="flex items-center gap-3 mb-3">
                    <Key class="w-5 h-5 text-amber-400" />
                    <h5 class="text-[10px] font-black uppercase tracking-widest text-amber-400">Merchant account setup</h5>
                  </div>
                  <p class="text-sm font-medium text-neutral-200">The merchant chooses their own username and password through the secure link in the approval email. No password is generated or displayed here.</p>
                  {#if approvalResult.applicantEmail}<p class="mt-3 text-xs text-neutral-400">Applicant: {approvalResult.applicantEmail}</p>{/if}
                </div>
              </div>

              {#if approvalResult.emailDispatched}
                <div class="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[24px] border border-indigo-100 dark:border-indigo-800/30 flex items-center gap-4">
                  <div class="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <Send class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p class="text-xs font-black text-indigo-700 dark:text-indigo-300">Email Notification Dispatched</p>
                    <p class="text-[9px] font-medium text-indigo-500 dark:text-indigo-400/70">The approval confirmation and single-use account setup link were sent to the applicant.</p>
                  </div>
                </div>
              {/if}
              {#if !approvalResult.emailDispatched}
                <p class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">The merchant is approved, but the setup email could not be delivered. Check the configured sender in Resend and send the setup link again.</p>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Merchant Applications</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
                {applications.length} Total &bull; {applications.filter(a => a.status === 'Pending').length} Pending Review
              </p>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                {#each ['all', 'Pending', 'Approved', 'Rejected'] as f}
                  <button
                    onclick={() => appFilter = f as any}
                    class={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appFilter === f ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-400'}`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                {/each}
              </div>
              <button onclick={loadApplications} class="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-full transition-all border border-neutral-100 dark:border-neutral-700">
                <RefreshCw class={`w-4 h-4 text-neutral-400 ${appsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {#if appsLoading}
            <div class="p-20 text-center">
              <Loader2 class="w-8 h-8 animate-spin mx-auto text-neutral-300" />
              <p class="mt-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest">Loading Applications...</p>
            </div>
          {:else if filteredApps.length === 0}
            <div class="p-20 text-center">
              <Mail class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p class="text-sm font-black text-neutral-400">No applications found</p>
              <p class="text-[10px] text-neutral-400 font-medium mt-1">
                {appFilter !== 'all' ? `No ${appFilter.toLowerCase()} applications` : 'Applications will appear here when merchants apply'}
              </p>
            </div>
          {:else}
            <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#each filteredApps as app}
                <div
                  onclick={() => { selectedApp = app; appTerminalCount = app.hardware?.terminalCount || 1; approvalResult = null; }}
                  onkeydown={e => e.key === 'Enter' && (selectedApp = app, appTerminalCount = app.hardware?.terminalCount || 1, approvalResult = null)}
                  role="button"
                  tabindex="0"
                  class="p-6 px-8 flex items-center gap-6 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 cursor-pointer transition-all group"
                >
                  <div class={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${app.status === 'Pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : app.status === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {#if app.status === 'Pending'}
                      <Clock class="w-5 h-5" />
                    {:else if app.status === 'Approved'}
                      <CheckCircle class="w-5 h-5" />
                    {:else}
                      <XCircle class="w-5 h-5" />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                      <h4 class="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate">{app.businessInfo?.legalName || 'Unnamed Business'}</h4>
                      <span class={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0 ${statusBadge(app.status)}`}>{app.status}</span>
                    </div>
                    <div class="flex items-center gap-3 text-[9px] font-bold text-neutral-400">
                      <span>{app.applicationId}</span>
                      <span>&bull;</span>
                      <span>{app.businessInfo?.type || 'Retail'}</span>
                      <span>&bull;</span>
                      <span>{app.account?.email || 'N/A'}</span>
                      <span>&bull;</span>
                      <span>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                  <ChevronRight class="w-5 h-5 text-neutral-300 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-all shrink-0" />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#key showRejectModal}
        {#if showRejectModal}
          <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-neutral-900/90 backdrop-blur-md">
            <div in:scale={{ start: 0.9, opacity: 0 }} out:scale={{ start: 0.9, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl">
              <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <h3 class="text-lg font-black text-neutral-900 dark:text-neutral-100">Reject Application</h3>
                <button onclick={() => { showRejectModal = false; rejectReason = ''; }} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                  <X class="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div class="p-8 space-y-6">
                <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/30 flex gap-3">
                  <AlertCircle class="w-5 h-5 text-red-500 shrink-0" />
                  <p class="text-[10px] text-red-700 dark:text-red-400 font-medium leading-relaxed">
                    This will reject the application for <span class="font-black">{selectedApp?.businessInfo?.legalName}</span> ({selectedApp?.applicationId}). The merchant status will be set to Rejected.
                  </p>
                </div>
                <div class="space-y-2">
                  <label for="reject-reason" class="text-[10px] font-black uppercase tracking-widest text-neutral-400">Rejection Reason</label>
                  <textarea
                    id="reject-reason"
                    bind:value={rejectReason}
                    rows={3}
                    placeholder="Explain why this application is being rejected..."
                    class="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none dark:text-neutral-200"></textarea>
                </div>
                <div class="flex justify-end gap-3">
                  <button onclick={() => { showRejectModal = false; rejectReason = ''; }} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Cancel</button>
                  <button
                    onclick={() => handleRejectApp(selectedApp)}
                    disabled={rejecting}
                    class="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-red-500 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {#if rejecting}<Loader2></Loader2>{:else}<Ban></Ban>{/if}
                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/key}
    </div>

  {#if activeTab === 'loyalty'}
    <div class="space-y-8 animate-in fade-in duration-500">
      <div class="bg-white dark:bg-neutral-800/50 p-12 rounded-[56px] border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden">
        <div class="relative z-10">
          <h3 class="text-3xl font-black tracking-tight mb-2 dark:text-neutral-100">Global Loyalty Intelligence</h3>
          <p class="text-neutral-400 text-sm font-medium">Monitoring point velocity and reward distribution across all merchant nodes</p>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mt-12">
            <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Points Issued (24h)</p>
              <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">12,840 <span class="text-xs font-bold text-emerald-500">+14%</span></p>
            </div>
            <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Redemptions</p>
              <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">R 4,200 <span class="text-xs font-bold text-rose-500">-2%</span></p>
            </div>
            <div class="p-8 bg-indigo-900 rounded-[40px] text-white">
              <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Member Growth</p>
              <p class="text-3xl font-black">214 <span class="text-xs font-bold text-indigo-400">New Members</span></p>
            </div>
            <div class="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Burn Rate</p>
              <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">32% <span class="text-xs font-bold text-neutral-400">Healthy</span></p>
            </div>
          </div>
        </div>
        <div class="absolute top-0 right-0 p-12 opacity-5"><Heart class="w-64 h-64 text-rose-500" /></div>
      </div>
    </div>
  {/if}

  {#if activeTab === 'batches'}
    <div class="space-y-8 animate-in fade-in duration-500">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
          {#each [
            { id: 'settlement' as const, label: 'Settlement Batches', icon: Layers },
            { id: 'emails' as const, label: 'Email Queue', icon: Send },
          ] as t}
            {@const TabIcon = t.icon}
            <button
              onclick={() => batchSubTab = t.id}
              class={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${batchSubTab === t.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-400'}`}
            >
              <TabIcon class="w-3.5 h-3.5" /> {t.label}
            </button>
          {/each}
        </div>
        {#if batchSubTab === 'settlement' && uniqueBatchMerchants.length > 1}
          <div class="flex items-center gap-2">
            <Filter class="w-3.5 h-3.5 text-neutral-400" />
            <select
              bind:value={batchMerchantFilter}
              class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-amber-400 appearance-none cursor-pointer"
            >
              <option value="all">All Merchants</option>
              {#each uniqueBatchMerchants as mId}
                <option value={mId}>{mId?.replace('merchant:', 'Node ')}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="flex-1"></div>
        <button onclick={loadBatches} class="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-full transition-all border border-neutral-100 dark:border-neutral-700">
          <RefreshCw class={`w-4 h-4 text-neutral-400 ${batchesLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {#if batchSubTab === 'settlement'}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Settlement Batches</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
                Daily transaction aggregation per merchant node {batchMerchantFilter !== 'all' ? `â€¢ Filtered: ${batchMerchantFilter.replace('merchant:', '')}` : ''}
              </p>
            </div>
            <div class="flex items-center gap-6">
              {#if filteredBatches.length > 0}
                <div class="flex items-center gap-6 text-right">
                  <div>
                    <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Total Batches</p>
                    <p class="text-lg font-black text-neutral-900 dark:text-neutral-100">{filteredBatches.length}</p>
                  </div>
                  <div>
                    <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Open</p>
                    <p class="text-lg font-black text-amber-600">{filteredBatches.filter(b => b.status === 'Open').length}</p>
                  </div>
                  <div>
                    <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Gross Vol.</p>
                    <p class="text-lg font-black text-neutral-900 dark:text-neutral-100">R {filteredBatches.reduce((s, b) => s + (b.totalAmount || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          {#if batchesLoading}
            <div class="p-20 text-center">
              <Loader2 class="w-8 h-8 animate-spin mx-auto text-neutral-300" />
              <p class="mt-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest">Loading Batches...</p>
            </div>
          {:else if filteredBatches.length === 0}
            <div class="p-20 text-center">
              <Layers class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p class="text-sm font-black text-neutral-400">No settlement batches found</p>
              <p class="text-[10px] text-neutral-400 font-medium mt-1">
                {batchMerchantFilter !== 'all' ? 'No batches for this merchant â€” try "All Merchants"' : 'Transaction batches will appear as sales are processed'}
              </p>
            </div>
          {:else}
            <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#each filteredBatches as batch}
                <div class="p-6 px-8 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-all group/batch">
                  <div class="flex items-center gap-6">
                    <div class={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${batch.status === 'Open' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {#if batch.status === ''}<Unlock></Unlock>{:else}<Lock></Lock>{/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3 mb-1">
                        <h4 class="text-sm font-black text-neutral-900 dark:text-neutral-100">{batch.id}</h4>
                        <span class={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${batch.status === 'Open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                          {batch.status}
                        </span>
                      </div>
                      <div class="flex items-center gap-3 text-[9px] font-bold text-neutral-400">
                        <span>{batch.date}</span>
                        <span>&bull;</span>
                        <span>{batch.merchantId?.replace('merchant:', 'Node ')}</span>
                        <span>&bull;</span>
                        <span>{batch.transactions} txn{batch.transactions !== 1 ? 's' : ''}</span>
                        {#if batch.settledAt}
                          <span>&bull;</span>
                          <span class="text-emerald-500">Settled {new Date(batch.settledAt).toLocaleString()}</span>
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-6 shrink-0">
                      <div class="text-right">
                        <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Gross</p>
                        <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">R {(batch.totalAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                      </div>
                      {#if batch.cashTotal > 0}
                        <div class="text-right hidden md:block">
                          <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Cash</p>
                          <p class="text-xs font-bold text-neutral-600 dark:text-neutral-300">R {batch.cashTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      {/if}
                      {#if batch.cardTotal > 0}
                        <div class="text-right hidden md:block">
                          <p class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Card</p>
                          <p class="text-xs font-bold text-neutral-600 dark:text-neutral-300">R {batch.cardTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      {/if}
                      {#if batch.refundTotal > 0}
                        <div class="text-right hidden md:block">
                          <p class="text-[8px] font-black text-rose-400 uppercase tracking-widest">Refunds</p>
                          <p class="text-xs font-bold text-rose-500">-R {batch.refundTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      {/if}
                      {#if batch.status === 'Open' && isAdmin}
                        {#if showSettleConfirm === batch.id}
                          <div class="flex items-center gap-2">
                            <button
                              onclick={() => handleSettleBatch(batch.id)}
                              disabled={settlingBatch === batch.id}
                              class="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
                            >
                              {#if settlingBatch === batch.id}<Loader2></Loader2>{:else}<Lock></Lock>{/if}
                              Confirm
                            </button>
                            <button onclick={() => showSettleConfirm = null} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all">
                              <X class="w-3.5 h-3.5 text-neutral-400" />
                            </button>
                          </div>
                        {:else}
                          <button
                            onclick={() => showSettleConfirm = batch.id}
                            class="flex items-center gap-1.5 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all opacity-0 group-hover/batch:opacity-100"
                          >
                            <Lock class="w-3.5 h-3.5" /> Settle
                          </button>
                        {/if}
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if batchSubTab === 'emails'}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Email Notification Queue</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">{emailNotifs.length} dispatched notifications (simulated â€” no SMTP configured)</p>
            </div>
          </div>

          {#if batchesLoading}
            <div class="p-20 text-center">
              <Loader2 class="w-8 h-8 animate-spin mx-auto text-neutral-300" />
              <p class="mt-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest">Loading Queue...</p>
            </div>
          {:else if emailNotifs.length === 0}
            <div class="p-20 text-center">
              <Send class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p class="text-sm font-black text-neutral-400">No email notifications</p>
              <p class="text-[10px] text-neutral-400 font-medium mt-1">Email notifications will be logged here when merchants are approved or rejected</p>
            </div>
          {:else}
            <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#each emailNotifs as email}
                <div class="p-6 px-8 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-all">
                  <div class="flex items-start gap-5">
                    <div class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${email.metadata?.type === 'approval' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : email.metadata?.type === 'rejection' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
                      <Send class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3 mb-1">
                        <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{email.subject}</p>
                        <span class={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest shrink-0 ${email.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'}`}>{email.status}</span>
                      </div>
                      <div class="flex items-center gap-3 text-[9px] font-bold text-neutral-400 mb-2">
                        <span>To: {email.to}</span>
                        <span>&bull;</span>
                        <span>{email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}</span>
                        {#if email.metadata?.merchantName}
                          <span>&bull;</span>
                          <span>{email.metadata.merchantName}</span>
                        {/if}
                      </div>
                      <p class="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed overflow-hidden max-h-[2.8em]">{email.body?.substring(0, 200)}{(email.body?.length || 0) > 200 ? '...' : ''}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'billing' && isAdmin}
    <div class="space-y-8 animate-in fade-in duration-500">
      <div class="flex items-center gap-4">
        <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
          {#each [
            { id: 'overview' as const, label: 'Subscriptions', icon: Crown },
            { id: 'plans' as const, label: 'Plans', icon: Sparkles },
            { id: 'invoices' as const, label: 'Invoices', icon: Receipt },
          ] as t}
            {@const TabIcon = t.icon}
            <button
              onclick={() => billingSubTab = t.id}
              class={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${billingSubTab === t.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-400'}`}
            >
              <TabIcon class="w-3.5 h-3.5" /> {t.label}
            </button>
          {/each}
        </div>
        <div class="flex-1"></div>
        <button onclick={loadBilling} class="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-full transition-all border border-neutral-100 dark:border-neutral-700">
          <RefreshCw class={`w-4 h-4 text-neutral-400 ${billingLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {#if billingSubTab === 'overview'}
        <div class="space-y-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="p-8 bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Active Subscriptions</p>
              <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">{billingSubscriptions.filter(s => s.status === 'active').length}</p>
            </div>
            <div class="p-8 bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">MRR</p>
              <p class="text-3xl font-black text-emerald-600">R {billingSubscriptions.filter(s => s.status === 'active').reduce((s, sub) => s + (sub.price || 0), 0).toLocaleString('en-ZA')}</p>
            </div>
            <div class="p-8 bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700">
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Total Invoices</p>
              <p class="text-3xl font-black text-neutral-900 dark:text-neutral-100">{billingInvoices.length}</p>
            </div>
            <div class="p-8 bg-amber-500 rounded-[40px] text-black">
              <p class="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Unsubscribed Merchants</p>
              <p class="text-3xl font-black">{Math.max(0, merchants.filter(m => m.status === 'Active').length - billingSubscriptions.filter(s => s.status === 'active').length)}</p>
            </div>
          </div>

          <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
            <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-center justify-between">
              <div>
                <h3 class="text-xl font-black dark:text-neutral-100">Merchant Subscriptions</h3>
                <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Assign, upgrade, or cancel billing plans per merchant</p>
              </div>
            </div>

            {#if billingLoading}
              <div class="p-20 text-center">
                <Loader2 class="w-8 h-8 animate-spin mx-auto text-neutral-300" />
                <p class="mt-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest">Loading Billing...</p>
              </div>
            {:else if merchants.filter(m => m.status === 'Active').length === 0}
              <div class="p-20 text-center">
                <Store class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                <p class="text-sm font-black text-neutral-400">No active merchants</p>
                <p class="text-[10px] text-neutral-400 font-medium mt-1">Approve merchant applications to assign billing plans</p>
              </div>
            {:else}
              <div class="divide-y divide-neutral-50 dark:divide-neutral-800">
                {#each merchants.filter(m => m.status === 'Active') as m}
                  {@const sub = billingSubscriptions.find(s => s.merchantId === m.id)}
                  {@const isActive = sub?.status === 'active'}
                  {@const isPendingCancel = sub?.status === 'pending_cancellation'}
                  <div class="p-6 px-8 flex items-center gap-6 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-all">
                    <div class={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : isPendingCancel ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                      {#if isActive}<Crown></Crown>{:else if isPendingCancel}<Clock></Clock>{:else}<Tag></Tag>{/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3 mb-1">
                        <h4 class="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate">{m.name}</h4>
                        {#if isActive || isPendingCancel}
                          <span class={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isPendingCancel ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            {sub.planName}
                          </span>
                        {/if}
                        {#if isPendingCancel}
                          <span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
                            Cancelling {sub.scheduledCancelAt ? new Date(sub.scheduledCancelAt).toLocaleDateString() : ''}
                          </span>
                        {/if}
                        {#if sub?.status === 'cancelled'}
                          <span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelled</span>
                        {/if}
                        {#if !sub}
                          <span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-neutral-100 text-neutral-500">No Plan</span>
                        {/if}
                        {#if sub?.creditBalance > 0}
                          <span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">R {sub.creditBalance.toFixed(2)} credit</span>
                        {/if}
                        {#if sub?.retentionDiscount > 0}
                          <span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">10% retention discount</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-3 text-[9px] font-bold text-neutral-400">
                        <span>{m.id}</span>
                        <span>&bull;</span>
                        <span>{m.type}</span>
                        {#if isActive || isPendingCancel}
                          <span>&bull;</span>
                          <span>R {sub.price}/mo</span>
                          <span>&bull;</span>
                          <span>Next bill: {sub.nextBillingAt ? new Date(sub.nextBillingAt).toLocaleDateString() : 'N/A'}</span>
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      {#if isPendingCancel}
                        <button
                          onclick={() => handleReverseCancellation(m.id)}
                          disabled={cancelling === m.id}
                          class="flex items-center gap-1.5 px-4 py-2 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all disabled:opacity-50"
                        >
                          {#if cancelling === m.id}<Loader2></Loader2>{:else}<RefreshCw></RefreshCw>{/if}
                          Keep Plan
                        </button>
                      {/if}
                      {#if isActive}
                        <button
                          onclick={() => openCancelFlow(m.id, m.name)}
                          disabled={cancelling === m.id}
                          class="flex items-center gap-1.5 px-4 py-2 text-red-600 dark:text-red-400 text-[8px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all disabled:opacity-50"
                        >
                          {#if cancelling === m.id}<Loader2></Loader2>{:else}<Ban></Ban>{/if}
                          Cancel
                        </button>
                      {/if}
                      {#if isActive}
                        <button
                          onclick={() => openDowngradeModal(m.id, m.name, sub.planId)}
                          class="flex items-center gap-1.5 px-4 py-2 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                        >
                          <ArrowDown class="w-3.5 h-3.5" />
                          Downgrade
                        </button>
                      {/if}
                      <button
                        onclick={() => { assigningPlan = { merchantId: m.id, merchantName: m.name }; selectedPlanId = sub?.planId || ''; }}
                        class="flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 dark:bg-neutral-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-600 active:scale-95 transition-all"
                      >
                        <Sparkles class="w-3.5 h-3.5" />
                        {isActive ? 'Upgrade' : 'Assign Plan'}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if billingSubTab === 'plans'}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {#each billingPlans as plan}
            <div class={`relative p-10 rounded-[48px] border overflow-hidden transition-all ${plan.popular ? 'bg-neutral-900 text-white border-amber-500 shadow-2xl shadow-amber-500/10 scale-[1.02]' : 'bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'}`}>
              {#if plan.popular}
                <div class="absolute top-6 right-6 px-3 py-1 bg-amber-500 text-black rounded-full text-[8px] font-black uppercase tracking-widest">Most Popular</div>
              {/if}
              <div class="mb-8">
                <div class={`w-14 h-14 rounded-[20px] flex items-center justify-center mb-4 ${plan.popular ? 'bg-amber-500 text-black' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                  {#if plan.id === 'kiosk'}
                    <Zap class="w-7 h-7" />
                  {:else if plan.id === 'standard'}
                    <Crown class="w-7 h-7" />
                  {:else}
                    <Sparkles class="w-7 h-7" />
                  {/if}
                </div>
                <h3 class={`text-2xl font-black tracking-tight mb-1 ${plan.popular ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}>{plan.name}</h3>
                <p class={`text-[10px] font-medium ${plan.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{plan.description}</p>
              </div>
              <div class="mb-4">
                <div class="flex items-baseline gap-1">
                  <span class={`text-[10px] font-black uppercase tracking-widest ${plan.popular ? 'text-neutral-500' : 'text-neutral-400'}`}>from</span>
                  <span class={`text-4xl font-black ${plan.popular ? 'text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>R {plan.price.toLocaleString()}</span>
                  <span class={`text-xs font-bold ${plan.popular ? 'text-neutral-500' : 'text-neutral-400'}`}>/{plan.interval}</span>
                </div>
                {#if plan.priceRange}
                  <p class={`text-[10px] font-bold mt-1 ${plan.popular ? 'text-neutral-500' : 'text-neutral-400'}`}>Typical range: {plan.priceRange}/month</p>
                {/if}
              </div>
              {#if plan.hardwareCost}
                <div class={`mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${plan.popular ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'}`}>
                  <Monitor class="w-3.5 h-3.5" />
                  Hardware: ~{plan.hardwareCost} (once-off)
                </div>
              {/if}
              <div class="space-y-3">
                {#each plan.features as feat}
                  <div class="flex items-center gap-3">
                    <CheckCircle2 class={`w-4 h-4 shrink-0 ${plan.popular ? 'text-amber-400' : 'text-emerald-500'}`} />
                    <span class={`text-xs font-bold ${plan.popular ? 'text-neutral-300' : 'text-neutral-600 dark:text-neutral-400'}`}>{feat}</span>
                  </div>
                {/each}
                {#each plan.limitations || [] as lim}
                  <div class="flex items-center gap-3">
                    <XCircle class={`w-4 h-4 shrink-0 ${plan.popular ? 'text-neutral-600' : 'text-neutral-300 dark:text-neutral-600'}`} />
                    <span class={`text-xs font-bold ${plan.popular ? 'text-neutral-500' : 'text-neutral-400'}`}>{lim}</span>
                  </div>
                {/each}
              </div>
              <div class="mt-10">
                <p class={`text-[10px] font-black uppercase tracking-widest ${plan.popular ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {billingSubscriptions.filter(s => s.status === 'active' && s.planId === plan.id).length} active subscriber{billingSubscriptions.filter(s => s.status === 'active' && s.planId === plan.id).length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          {/each}
          {#if billingPlans.length === 0 && !billingLoading}
            <div class="col-span-3 p-20 text-center">
              <Sparkles class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p class="text-sm font-black text-neutral-400">No plans loaded</p>
            </div>
          {/if}
        </div>
      {/if}

      {#if billingSubTab === 'invoices'}
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-black dark:text-neutral-100">Invoice Ledger</h3>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">{billingInvoices.length} invoices generated</p>
            </div>
          </div>

          {#if billingLoading}
            <div class="p-20 text-center"><Loader2 class="w-8 h-8 animate-spin mx-auto text-neutral-300" /></div>
          {:else if billingInvoices.length === 0}
            <div class="p-20 text-center">
              <Receipt class="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p class="text-sm font-black text-neutral-400">No invoices yet</p>
              <p class="text-[10px] text-neutral-400 font-medium mt-1">Invoices are automatically generated when plans are assigned</p>
            </div>
          {:else}
            <div class="p-8">
              <div class="bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                <table class="w-full text-left">
                  <thead class="bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                    <tr>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Invoice ID</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Merchant</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Plan</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Amount</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Period</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
                      <th class="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Issued</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
                    {#each billingInvoices as inv}
                      <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all">
                        <td class="px-6 py-4 text-[10px] font-mono font-black text-neutral-900 dark:text-neutral-200">{inv.id}</td>
                        <td class="px-6 py-4 text-xs font-bold text-neutral-700 dark:text-neutral-300">{inv.merchantName || inv.merchantId}</td>
                        <td class="px-6 py-4"><span class="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{inv.planName}</span></td>
                        <td class="px-6 py-4 text-xs font-black text-neutral-900 dark:text-neutral-100">R {(inv.amount || 0).toLocaleString('en-ZA')}</td>
                        <td class="px-6 py-4 text-[10px] font-bold text-neutral-400">{inv.period}</td>
                        <td class="px-6 py-4"><span class={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span></td>
                        <td class="px-6 py-4 text-right text-[10px] font-bold text-neutral-400">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#key assigningPlan}
        {#if assigningPlan}
          <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-neutral-900/90 backdrop-blur-md">
            <div in:scale={{ start: 0.9, opacity: 0 }} out:scale={{ start: 0.9, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl">
              <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-black text-neutral-900 dark:text-neutral-100">Assign Billing Plan</h3>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">{assigningPlan.merchantName}</p>
                </div>
                <button onclick={() => { assigningPlan = null; selectedPlanId = ''; }} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                  <X class="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div class="p-8 space-y-4">
                {#each billingPlans as plan}
                  <button
                    onclick={() => selectedPlanId = plan.id}
                    class={`w-full p-5 rounded-2xl border-2 text-left transition-all ${selectedPlanId === plan.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'}`}
                  >
                    <div class="flex items-center justify-between mb-1">
                      <h4 class={`text-sm font-black ${selectedPlanId === plan.id ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{plan.name}</h4>
                      <span class={`text-lg font-black ${selectedPlanId === plan.id ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>R {plan.price}/mo</span>
                    </div>
                    <p class="text-[10px] font-medium text-neutral-500">{plan.description}</p>
                    {#if plan.popular}
                      <span class="inline-block mt-2 px-2 py-0.5 bg-amber-500 text-black rounded-full text-[7px] font-black uppercase tracking-widest">Recommended</span>
                    {/if}
                  </button>
                {/each}
                <div class="flex justify-end gap-3 pt-4">
                  <button onclick={() => { assigningPlan = null; selectedPlanId = ''; }} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Cancel</button>
                  <button
                    onclick={handleAssignPlan}
                    disabled={!selectedPlanId || subscribing}
                    class="flex items-center gap-2 px-8 py-3 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {#if subscribing}<Loader2></Loader2>{:else}<Crown></Crown>{/if}
                    {subscribing ? 'Processing...' : 'Confirm Subscription'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/key}

      {#key downgradeTarget}
        {#if downgradeTarget}
          <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-neutral-900/90 backdrop-blur-md">
            <div in:scale={{ start: 0.9, opacity: 0 }} out:scale={{ start: 0.9, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
              <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-black text-neutral-900 dark:text-neutral-100">Downgrade Plan</h3>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">{downgradeTarget.merchantName}</p>
                </div>
                <button onclick={() => { downgradeTarget = null; downgradePreview = null; downgradeNewPlanId = ''; }} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                  <X class="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div class="p-8 space-y-6">
                <div>
                  <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Select New Plan</p>
                  <div class="space-y-3">
                    {#each billingPlans.filter(p => p.id !== downgradeTarget.currentPlanId && p.price < (billingPlans.find(bp => bp.id === downgradeTarget.currentPlanId)?.price || Infinity)) as plan}
                      <button
                        onclick={() => loadDowngradePreview(plan.id)}
                        class={`w-full p-4 rounded-2xl border-2 text-left transition-all ${downgradeNewPlanId === plan.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'}`}
                      >
                        <div class="flex items-center justify-between">
                          <h4 class={`text-sm font-black ${downgradeNewPlanId === plan.id ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{plan.name}</h4>
                          <span class="text-lg font-black text-neutral-900 dark:text-neutral-100">R {plan.price}/mo</span>
                        </div>
                        <p class="text-[10px] font-medium text-neutral-500 mt-1">{plan.description}</p>
                      </button>
                    {/each}
                    {#if billingPlans.filter(p => p.id !== downgradeTarget.currentPlanId && p.price < (billingPlans.find(bp => bp.id === downgradeTarget.currentPlanId)?.price || Infinity)).length === 0}
                      <div class="p-8 text-center">
                        <ArrowDown class="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                        <p class="text-sm font-bold text-neutral-400">Already on the lowest plan</p>
                        <p class="text-[10px] text-neutral-400 mt-1">No lower plans available for downgrade</p>
                      </div>
                    {/if}
                  </div>
                </div>

                {#if downgradeLoading}
                  <div class="p-8 text-center">
                    <Loader2 class="w-6 h-6 animate-spin mx-auto text-amber-500" />
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-3">Calculating prorated credit...</p>
                  </div>
                {/if}

                {#if downgradePreview && !downgradeLoading}
                  <div class="space-y-4">
                    <div class="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                      <div class="flex items-center gap-2 mb-3">
                        <DollarSign class="w-4 h-4 text-emerald-600" />
                        <span class="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Prorated Credit</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4 text-xs">
                        <div><span class="text-neutral-500 font-bold">Current: </span><span class="font-black text-neutral-900 dark:text-neutral-100">{downgradePreview.currentPlan.name} (R {downgradePreview.currentPlan.price}/mo)</span></div>
                        <div><span class="text-neutral-500 font-bold">New: </span><span class="font-black text-neutral-900 dark:text-neutral-100">{downgradePreview.newPlan.name} (R {downgradePreview.newPlan.price}/mo)</span></div>
                        <div><span class="text-neutral-500 font-bold">Days used: </span><span class="font-black">{downgradePreview.usedDays} of {downgradePreview.totalDays}</span></div>
                        <div><span class="text-neutral-500 font-bold">Remaining: </span><span class="font-black">{downgradePreview.remainingDays} days</span></div>
                      </div>
                      <div class="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-700 flex items-center justify-between">
                        <span class="text-sm font-black text-emerald-700 dark:text-emerald-400">Credit to Account</span>
                        <span class="text-2xl font-black text-emerald-600">R {downgradePreview.creditAmount.toFixed(2)}</span>
                      </div>
                      <div class="mt-2 flex items-center justify-between text-[10px] font-bold text-emerald-600/70">
                        <span>Monthly savings</span>
                        <span>R {downgradePreview.monthlySavings}/mo</span>
                      </div>
                    </div>

                    {#if downgradePreview.lostFeatures.length > 0}
                      <div class="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                        <div class="flex items-center gap-2 mb-3">
                          <AlertTriangle class="w-4 h-4 text-amber-600" />
                          <span class="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Features You'll Lose</span>
                        </div>
                        <div class="space-y-1.5">
                          {#each downgradePreview.lostFeatures as f}
                            <div class="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                              <XCircle class="w-3 h-3 shrink-0" />
                              <span class="font-bold">{f}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                      <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Features You Keep</p>
                      <div class="space-y-1.5">
                        {#each downgradePreview.keptFeatures as f}
                          <div class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                            <CheckCircle class="w-3 h-3 text-emerald-500 shrink-0" />
                            <span class="font-bold">{f}</span>
                          </div>
                        {/each}
                      </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-2">
                      <button onclick={() => { downgradeTarget = null; downgradePreview = null; }} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Cancel</button>
                      <button
                        onclick={handleConfirmDowngrade}
                        disabled={downgradeProcessing}
                        class="flex items-center gap-2 px-8 py-3 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {#if downgradeProcessing}<Loader2></Loader2>{:else}<ArrowDown></ArrowDown>{/if}
                        {downgradeProcessing ? 'Processing...' : 'Confirm Downgrade'}
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/key}

      {#key cancelTarget}
        {#if cancelTarget}
          <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-neutral-900/90 backdrop-blur-md">
            <div in:scale={{ start: 0.9, opacity: 0 }} out:scale={{ start: 0.9, opacity: 0 }} class="bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
              <div class="p-8 border-b border-neutral-100 dark:border-neutral-700">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-lg font-black text-neutral-900 dark:text-neutral-100">Cancel Subscription</h3>
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">{cancelTarget.merchantName}</p>
                  </div>
                  <button onclick={() => { cancelTarget = null; cancelPreview = null; }} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all">
                    <X class="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
                <div class="flex items-center gap-2 mt-4">
                  {#each ['reason', 'retention', 'confirm'] as step, i}
                    <div class="flex items-center gap-2">
                      <div class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${cancelStep === step ? 'bg-red-500 text-white' : i < ['reason', 'retention', 'confirm'].indexOf(cancelStep) ? 'bg-emerald-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>{i + 1}</div>
                      {#if i < 2}
                        <div class={`w-12 h-0.5 ${i < ['reason', 'retention', 'confirm'].indexOf(cancelStep) ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}></div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <div class="p-8">
                {#if cancelProcessing && !cancelPreview}
                  <div class="p-8 text-center">
                    <Loader2 class="w-6 h-6 animate-spin mx-auto text-red-500" />
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-3">Loading...</p>
                  </div>
                {:else if cancelStep === 'reason'}
                  <div class="space-y-5">
                    <p class="text-sm font-bold text-neutral-600 dark:text-neutral-300">We're sorry to see you go. Could you tell us why?</p>
                    <div class="space-y-2">
                      {#each [
                        { value: 'too_expensive', label: 'Too expensive' },
                        { value: 'missing_features', label: 'Missing features I need' },
                        { value: 'switching_provider', label: 'Switching to another provider' },
                        { value: 'business_closing', label: 'Business is closing' },
                        { value: 'not_using', label: 'Not using the service enough' },
                        { value: 'technical_issues', label: 'Technical issues' },
                        { value: 'other', label: 'Other reason' },
                      ] as opt}
                        <button
                          onclick={() => cancelReason = opt.value}
                          class={`w-full p-3.5 rounded-xl border-2 text-left text-xs font-bold transition-all ${cancelReason === opt.value ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                        >{opt.label}</button>
                      {/each}
                    </div>
                    <div>
                      <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Additional feedback (optional)</p>
                      <textarea
                        bind:value={cancelFeedback}
                        placeholder="Tell us how we can improve..."
                        class="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-red-500/30 resize-none h-20"></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                      <button onclick={() => { cancelTarget = null; cancelPreview = null; }} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Keep Subscription</button>
                      <button onclick={() => cancelStep = 'retention'} disabled={!cancelReason} class="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50">
                        Continue <ChevronRight class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                {:else if cancelStep === 'retention'}
                  <div class="space-y-5">
                    {#if cancelPreview?.retentionOffer}
                      <div class="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                        <div class="flex items-center gap-3 mb-4">
                          <div class="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center"><Gift class="w-5 h-5" /></div>
                          <div>
                            <h4 class="text-sm font-black text-purple-800 dark:text-purple-300">Wait! We have an offer for you</h4>
                            <p class="text-[10px] font-bold text-purple-600 dark:text-purple-400">{cancelPreview.retentionOffer.description}</p>
                          </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                          <div class="p-4 bg-white/60 dark:bg-neutral-800/60 rounded-xl">
                            <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Current Price</p>
                            <p class="text-lg font-black text-neutral-900 dark:text-neutral-100 line-through">R {cancelPreview.currentPlan?.price}/mo</p>
                          </div>
                          <div class="p-4 bg-white/60 dark:bg-neutral-800/60 rounded-xl">
                            <p class="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">With Discount</p>
                            <p class="text-lg font-black text-purple-600 dark:text-purple-400">R {cancelPreview.retentionOffer.discountedPrice}/mo</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 mb-4">
                          <CalendarDays class="w-3.5 h-3.5" />
                          <span>Discount applies for {cancelPreview.retentionOffer.durationMonths} months, saving you R {(cancelPreview.retentionOffer.discountAmount * cancelPreview.retentionOffer.durationMonths).toLocaleString()} total</span>
                        </div>
                        <button
                          onclick={handleAcceptRetention}
                          disabled={cancelProcessing}
                          class="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {#if cancelProcessing}<Loader2></Loader2>{:else}<Gift></Gift>{/if}
                          Accept Offer & Stay
                        </button>
                      </div>
                    {/if}
                    <div class="text-center"><p class="text-[10px] font-bold text-neutral-400 mb-3">or</p></div>
                    <div class="flex justify-between gap-3">
                      <button onclick={() => cancelStep = 'reason'} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Back</button>
                      <button onclick={() => cancelStep = 'confirm'} class="flex items-center gap-2 px-6 py-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-95 transition-all">
                        No thanks, continue cancelling <ChevronRight class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                {:else}
                  <div class="space-y-5">
                    <div class="p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                      <div class="flex items-center gap-2 mb-3">
                        <AlertTriangle class="w-4 h-4 text-red-600" />
                        <span class="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Confirm Cancellation</span>
                      </div>
                      {#if cancelPreview}
                        <div class="space-y-2 text-xs text-neutral-600 dark:text-neutral-300 font-bold">
                          <p>Plan: <span class="text-neutral-900 dark:text-neutral-100">{cancelPreview.currentPlan?.name}</span></p>
                          <p>Reason: <span class="text-neutral-900 dark:text-neutral-100">{cancelReason.replace(/_/g, ' ')}</span></p>
                          {#if cancelPreview.remainingDays > 0}
                            <p>Remaining billing period: <span class="text-neutral-900 dark:text-neutral-100">{cancelPreview.remainingDays} days</span></p>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all border-neutral-200 dark:border-neutral-700 hover:border-neutral-300">
                        <input type="radio" name="cancelType" checked={!cancelImmediately} onchange={() => cancelImmediately = false} class="mt-0.5 accent-red-500" />
                        <div>
                          <p class="text-xs font-black text-neutral-900 dark:text-neutral-100">Cancel at end of billing period</p>
                          <p class="text-[10px] font-medium text-neutral-500 mt-0.5">Access until {cancelPreview?.nextBillingDate ? new Date(cancelPreview.nextBillingDate).toLocaleDateString() : 'next billing date'}. You can reverse this before then.</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all border-neutral-200 dark:border-neutral-700 hover:border-neutral-300">
                        <input type="radio" name="cancelType" checked={cancelImmediately} onchange={() => cancelImmediately = true} class="mt-0.5 accent-red-500" />
                        <div>
                          <p class="text-xs font-black text-neutral-900 dark:text-neutral-100">Cancel immediately</p>
                          <p class="text-[10px] font-medium text-neutral-500 mt-0.5">Access ends now. No prorated refund.</p>
                        </div>
                      </label>
                    </div>
                    <div class="flex justify-between gap-3 pt-2">
                      <button onclick={() => cancelStep = 'retention'} class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all">Back</button>
                      <button onclick={handleConfirmCancel} disabled={cancelProcessing} class="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
                        {#if cancelProcessing}<Loader2></Loader2>{:else}<Ban></Ban>{/if}
                        {cancelProcessing ? 'Processing...' : cancelImmediately ? 'Cancel Now' : 'Schedule Cancellation'}
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/key}
    </div>
  {/if}

  {#if activeTab === 'receipts'}
    <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
      <div class="p-10 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex items-center justify-between">
        <div>
          <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100">Forensic Audit Log</h3>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Global Immutable Record Chain</p>
        </div>
        <div class="flex gap-4">
          <button class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <FileDown class="w-4 h-4" /> Export Ledger
          </button>
        </div>
      </div>
      <div class="p-10">
        <div class="bg-neutral-50 dark:bg-neutral-800 rounded-[32px] border border-neutral-100 dark:border-neutral-700 overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
              <tr>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Timestamp</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Merchant</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Action</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dossier / Payload</th>
                <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Integrity Hash</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
              {#if auditLogs.length === 0}
                <tr><td colspan={5} class="p-20 text-center"><Loader2 class="animate-spin mx-auto text-neutral-200" /><p class="mt-4 text-[10px] font-black uppercase text-neutral-400 tracking-widest">Select a merchant to view logs</p></td></tr>
              {:else}
                {#each auditLogs as log}
                  <tr class="hover:bg-white dark:hover:bg-neutral-700/50 transition-all cursor-default">
                    <td class="px-8 py-5">
                      <div class="flex items-center gap-3">
                        <Clock class="w-3.5 h-3.5 text-neutral-300" />
                        <span class="text-xs font-bold text-neutral-900 dark:text-neutral-200">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td class="px-8 py-5"><span class="text-[10px] font-black text-neutral-500 uppercase">{log.merchantId}</span></td>
                    <td class="px-8 py-5">
                      <span class={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${log.action.includes('SALE') ? 'bg-emerald-50 text-emerald-600' : log.action.includes('USER') ? 'bg-indigo-50 text-indigo-600' : 'bg-neutral-100 text-neutral-600'}`}>{log.action.replace('_',' ')}</span>
                    </td>
                    <td class="px-8 py-5 max-w-xs"><p class="text-[10px] font-bold text-neutral-400 truncate">{JSON.stringify(log.details)}</p></td>
                    <td class="px-8 py-5 text-right font-mono text-[9px] text-emerald-500 font-bold tracking-tighter">{log.hash}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
 
</div>
