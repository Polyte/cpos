<script lang="ts">
  import { fly, fade, scale } from 'svelte/transition';
  import { Clock, Zap, Crown, Star, ArrowRight, X, AlertTriangle, Lock } from 'lucide-svelte';
  import { api } from '../api';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let { merchantId, role, onUpgrade }: {
    merchantId: string;
    role: string;
    onUpgrade?: () => void;
  } = $props();

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface TrialInfo {
    plan: string;
    billingCycle: string;
    trial: {
      active: boolean;
      startDate: string | null;
      endDate: string | null;
      daysRemaining: number;
    };
    planLimits: {
      maxTerminals: number;
      maxSkus: number;
      maxLocations: number;
      features: string[];
    };
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let trialInfo = $state<TrialInfo | null>(null);
  let dismissed = $state(false);
  let showDetails = $state(false);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (merchantId) loadTrialStatus();
  });

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  async function loadTrialStatus() {
    try {
      const data = await api.getTrialStatus(merchantId);
      if (data && !data.error) {
        trialInfo = data;
      }
    } catch (e) {
      console.error('[TrialBanner] Failed to load trial status:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  let daysLeft = $derived(trialInfo?.trial?.daysRemaining ?? 0);
  let isUrgent = $derived(daysLeft <= 7);
  let isCritical = $derived(daysLeft <= 3);

  const planColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    starter: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800/40',
      text: 'text-amber-800 dark:text-amber-300',
      badge: 'bg-amber-500'
    },
    professional: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      border: 'border-indigo-200 dark:border-indigo-800/40',
      text: 'text-indigo-800 dark:text-indigo-300',
      badge: 'bg-indigo-600'
    },
    enterprise: {
      bg: 'bg-neutral-50 dark:bg-neutral-800/50',
      border: 'border-neutral-200 dark:border-neutral-700',
      text: 'text-neutral-800 dark:text-neutral-300',
      badge: 'bg-neutral-900 dark:bg-neutral-600'
    }
  };

  let colors = $derived(
    isCritical
      ? { bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800/40', text: 'text-rose-800 dark:text-rose-300', badge: 'bg-rose-600' }
      : isUrgent
      ? { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800/50', text: 'text-amber-800 dark:text-amber-300', badge: 'bg-amber-600' }
      : (trialInfo ? (planColors[trialInfo.plan] ?? planColors.starter) : planColors.starter)
  );

  const featureLimitLabels: Record<string, string> = {
    basic_pos: 'Basic Point of Sale',
    full_pos: 'Full POS Suite',
    kitchen_display: 'Kitchen Display System',
    basic_reports: 'Basic Reports',
    advanced_reports: 'Advanced Reports',
    analytics: 'Analytics Dashboard',
    batch_settlement: 'Batch Settlement',
    loyalty: 'Customer Loyalty',
    forensic_ledger: 'Forensic Ledger',
    api_access: 'API Access',
    webhooks: 'Webhooks',
    white_label: 'White Label',
    custom_integrations: 'Custom Integrations',
    email_support: 'Email Support',
    priority_support: 'Priority Support',
    dedicated_support: 'Dedicated Account Manager',
    sla_guarantee: 'SLA Guarantee'
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleUpgradeClick() {
    if (onUpgrade) {
      onUpgrade();
    } else {
      showDetails = true;
    }
  }

  function handleModalBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) showDetails = false;
  }
</script>

{#if trialInfo && trialInfo.trial?.active && !dismissed}
  <!-- Banner -->
  <div
    transition:fly={{ y: -10, duration: 300 }}
    class="mx-6 mt-3 mb-0 px-5 py-3 rounded-2xl border {colors.bg} {colors.border} flex items-center justify-between gap-4"
  >
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 {colors.badge} text-white">
        {#if isCritical}
          <AlertTriangle class="w-4 h-4" />
        {:else}
          <Clock class="w-4 h-4" />
        {/if}
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-black uppercase tracking-widest {colors.text}">
            {isCritical ? 'Trial Expiring Soon' : 'Free Trial Active'}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white {colors.badge}">
            {trialInfo.plan}
          </span>
        </div>
        <p class="text-[10px] font-medium {colors.text} opacity-80 mt-0.5">
          {#if daysLeft === 0}
            Your trial expires today. Upgrade to continue using CLINTPOS.
          {:else if daysLeft === 1}
            1 day remaining. Features will be restricted after trial ends.
          {:else}
            {daysLeft} days remaining on your 30-day trial.
          {/if}
          {#if trialInfo.planLimits.maxSkus > 0}
            {' '}Limited to {trialInfo.planLimits.maxSkus} SKUs, {trialInfo.planLimits.maxTerminals} terminal{trialInfo.planLimits.maxTerminals !== 1 ? 's' : ''}.
          {/if}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button
        onclick={handleUpgradeClick}
        class="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 {colors.badge} text-white shadow-lg"
      >
        {isUrgent ? 'Upgrade Now' : 'View Plan'}
      </button>
      {#if !isUrgent}
        <button
          onclick={() => dismissed = true}
          class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <X class="w-3.5 h-3.5 text-neutral-400" />
        </button>
      {/if}
    </div>
  </div>

  <!-- Details Modal -->
  {#if showDetails}
    <div
      transition:fade={{ duration: 150 }}
      role="dialog"
      aria-modal="true"
      class="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
      onclick={handleModalBackdropClick}
      onkeydown={(e) => e.key === 'Escape' && (showDetails = false)}
    >
      <div
        transition:scale={{ duration: 200, start: 0.95 }}
        class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-lg w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center {colors.badge} text-white">
              {#if trialInfo.plan === 'starter'}
                <Zap class="w-6 h-6" />
              {:else if trialInfo.plan === 'professional'}
                <Star class="w-6 h-6" />
              {:else}
                <Crown class="w-6 h-6" />
              {/if}
            </div>
            <div>
              <h3 class="text-xl font-black tracking-tight dark:text-neutral-100 uppercase">{trialInfo.plan} Plan</h3>
              <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">30-Day Trial</p>
            </div>
          </div>
          <button
            onclick={() => showDetails = false}
            class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"
          >
            <X class="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <!-- Trial Countdown -->
        <div class="rounded-2xl p-5 {colors.bg} {colors.border} border space-y-1">
          <div class="flex items-center gap-2">
            {#if isCritical}
              <AlertTriangle class="w-4 h-4 {colors.text}" />
            {:else}
              <Clock class="w-4 h-4 {colors.text}" />
            {/if}
            <span class="text-xs font-black uppercase tracking-widest {colors.text}">
              {isCritical ? 'Critical — Expiring Soon' : 'Trial Status'}
            </span>
          </div>
          <p class="text-2xl font-black {colors.text}">
            {#if daysLeft === 0}
              Expires Today
            {:else if daysLeft === 1}
              1 Day Left
            {:else}
              {daysLeft} Days Left
            {/if}
          </p>
          <p class="text-[11px] font-medium {colors.text} opacity-70">
            {#if daysLeft === 0}
              Your trial expires today. Upgrade now to avoid service interruption.
            {:else if isCritical}
              Upgrade before your trial ends to avoid losing access to your data and features.
            {:else if isUrgent}
              Your trial is ending soon. Upgrade to keep all your features and data.
            {:else}
              You have {daysLeft} days remaining on your free trial. No payment required until then.
            {/if}
          </p>
        </div>

        <!-- Plan Limits -->
        <div class="space-y-3">
          <h4 class="text-xs font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Current Trial Limits
          </h4>
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl p-3 bg-neutral-50 dark:bg-neutral-800 text-center">
              <p class="text-xl font-black text-neutral-900 dark:text-neutral-100">
                {trialInfo.planLimits.maxTerminals}
              </p>
              <p class="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">
                Terminal{trialInfo.planLimits.maxTerminals !== 1 ? 's' : ''}
              </p>
            </div>
            <div class="rounded-xl p-3 bg-neutral-50 dark:bg-neutral-800 text-center">
              <p class="text-xl font-black text-neutral-900 dark:text-neutral-100">
                {trialInfo.planLimits.maxSkus > 0 ? trialInfo.planLimits.maxSkus : '∞'}
              </p>
              <p class="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">SKUs</p>
            </div>
            <div class="rounded-xl p-3 bg-neutral-50 dark:bg-neutral-800 text-center">
              <p class="text-xl font-black text-neutral-900 dark:text-neutral-100">
                {trialInfo.planLimits.maxLocations > 0 ? trialInfo.planLimits.maxLocations : '∞'}
              </p>
              <p class="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">Locations</p>
            </div>
          </div>
        </div>

        <!-- Included Features -->
        {#if trialInfo.planLimits.features && trialInfo.planLimits.features.length > 0}
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Included Features
            </h4>
            <div class="space-y-2">
              {#each trialInfo.planLimits.features as feature (feature)}
                <div class="flex items-center gap-2.5">
                  <div class="w-4 h-4 rounded-full {colors.badge} flex items-center justify-center shrink-0">
                    <svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {featureLimitLabels[feature] ?? feature}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Upgrade CTA -->
        <div class="pt-2 space-y-3">
          <button
            onclick={() => { showDetails = false; if (onUpgrade) onUpgrade(); }}
            class="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] {colors.badge} text-white shadow-lg flex items-center justify-center gap-2"
          >
            <span>{isUrgent ? 'Upgrade Now — Keep Your Data' : 'Upgrade to Full Plan'}</span>
            <ArrowRight class="w-4 h-4" />
          </button>
          <button
            onclick={() => showDetails = false}
            class="w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
          >
            Continue with Trial
          </button>
        </div>

        <!-- Billing cycle note -->
        {#if trialInfo.billingCycle}
          <p class="text-[10px] text-neutral-400 text-center font-medium">
            After trial ends, billed {trialInfo.billingCycle === 'annual' ? 'annually' : 'monthly'}. Cancel anytime.
          </p>
        {/if}
      </div>
    </div>
  {/if}
{/if}
