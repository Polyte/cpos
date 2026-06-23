<script lang="ts">
  import { scale } from 'svelte/transition';
  import { Lock, Fingerprint, Hash, CheckCircle2 } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    userName,
    role,
    onUnlock,
    lockReason = 'inactivity'
  }: {
    userName: string;
    role: string;
    onUnlock: () => void;
    lockReason?: 'inactivity' | 'manual';
  } = $props();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let pin = $state('');
  let mode = $state<'choose' | 'pin' | 'biometric'>('choose');
  let bioProgress = $state(0);
  let bioPhase = $state<'idle' | 'scanning' | 'verified'>('idle');
  let currentTime = $state(new Date());

  // Timer refs — plain module-level variables, not reactive state
  let bioIntervalRef: ReturnType<typeof setInterval> | null = null;
  let bioTimeoutRef: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Clock ticker
  $effect(() => {
    const timer = setInterval(() => {
      currentTime = new Date();
    }, 1000);
    return () => clearInterval(timer);
  });

  // Cleanup biometric timers on unmount
  $effect(() => {
    return () => {
      if (bioIntervalRef) clearInterval(bioIntervalRef);
      if (bioTimeoutRef) clearTimeout(bioTimeoutRef);
    };
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handlePinSubmit() {
    if (pin.length === 4) onUnlock();
  }

  function handleBiometric() {
    mode = 'biometric';
    bioPhase = 'scanning';
    bioProgress = 0;

    if (bioIntervalRef) clearInterval(bioIntervalRef);

    bioIntervalRef = setInterval(() => {
      if (bioProgress >= 100) {
        if (bioIntervalRef) clearInterval(bioIntervalRef);
        bioPhase = 'verified';
        bioTimeoutRef = setTimeout(() => onUnlock(), 600);
        return;
      }
      bioProgress += 4;
    }, 50);
  }

  function handleKeyPress(k: string) {
    if (k === 'CLR') {
      pin = '';
    } else if (k === 'OK') {
      handlePinSubmit();
    } else if (pin.length < 4) {
      pin = pin + k;
    }
  }

  // ---------------------------------------------------------------------------
  // Derived / helpers
  // ---------------------------------------------------------------------------

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
</script>

<div
  class="fixed inset-0 z-[9999] flex items-center justify-center"
  style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);"
  role="dialog"
  aria-modal="true"
  aria-label="Terminal locked"
>
  <!-- Background glows -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[150px]"></div>
    <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[150px]"></div>
  </div>

  <!-- Main card -->
  <div
    class="relative z-10 max-w-md w-full mx-4"
    transition:scale={{ duration: 400, start: 0.9 }}
  >
    <!-- Clock -->
    <div class="text-center mb-10">
      <p class="text-6xl font-black text-white tabular-nums tracking-tight">
        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p class="text-xs font-black text-neutral-500 uppercase tracking-[0.3em] mt-2">
        {currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>

    <!-- Lock panel -->
    <div class="bg-neutral-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
          <Lock class="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wider">Terminal Locked</h3>
          <p class="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">
            {lockReason === 'inactivity' ? 'Inactivity timeout' : 'Manual lock'} • {userName} ({role})
          </p>
        </div>
      </div>

      <!-- Mode views -->
      {#if mode === 'choose'}
        <div class="space-y-3">
          <p class="text-xs text-neutral-400 mb-4">Authenticate to resume your session. Shift remains active.</p>

          <button
            onclick={handleBiometric}
            class="w-full py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-amber-500/20 transition-all active:scale-95"
            aria-label="Authenticate with biometric scan"
          >
            <Fingerprint class="w-5 h-5" /> Biometric Scan
          </button>

          <button
            onclick={() => (mode = 'pin')}
            class="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
            aria-label="Authenticate with PIN entry"
          >
            <Hash class="w-5 h-5" /> PIN Entry
          </button>
        </div>

      {:else if mode === 'pin'}
        <div class="space-y-4">
          <!-- PIN dots -->
          <div class="flex justify-center gap-2 mb-2">
            {#each [0, 1, 2, 3] as i (i)}
              <div
                class={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black ${
                  pin.length > i
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-white/10 text-transparent'
                }`}
              >
                {pin.length > i ? '*' : ''}
              </div>
            {/each}
          </div>

          <!-- Numpad -->
          <div class="grid grid-cols-3 gap-2">
            {#each keys as k (k)}
              <button
                onclick={() => handleKeyPress(k)}
                class={`h-11 rounded-lg font-black text-sm transition-all active:scale-95 ${
                  k === 'OK'
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : k === 'CLR'
                    ? 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {k}
              </button>
            {/each}
          </div>

          <button
            onclick={() => (mode = 'choose')}
            class="w-full text-center text-[9px] font-bold text-neutral-500 uppercase tracking-widest hover:text-white transition-colors pt-2"
          >
            Back
          </button>
        </div>

      {:else}
        <!-- Biometric -->
        <div class="flex flex-col items-center py-4">
          <div class="relative w-24 h-24 mb-6">
            <div
              class={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                bioPhase === 'verified'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              {#if bioPhase === 'verified'}
                <CheckCircle2 class="w-10 h-10 text-emerald-400" />
              {:else}
                <Fingerprint class="w-10 h-10 text-amber-400 animate-pulse" />
              {/if}
            </div>

            {#if bioPhase === 'scanning'}
              <svg class="absolute inset-0 w-24 h-24 -rotate-90" aria-hidden="true">
                <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(245,158,11,0.3)" stroke-width="4" />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  fill="none"
                  stroke="#f59e0b"
                  stroke-width="4"
                  stroke-dasharray="{bioProgress * 2.76} 276"
                  stroke-linecap="round"
                  class="transition-all duration-100"
                />
              </svg>
            {/if}
          </div>

          <p
            class={`text-xs font-black uppercase tracking-widest ${
              bioPhase === 'verified' ? 'text-emerald-400' : 'text-amber-400'
            }`}
            role="status"
          >
            {bioPhase === 'verified' ? 'Identity Verified' : 'Scanning Biometrics...'}
          </p>
        </div>
      {/if}

    </div>

    <!-- Footer -->
    <div class="text-center mt-6">
      <p class="text-[8px] font-black text-neutral-600 uppercase tracking-[0.3em]">
        Roxton Secure OS v4.2.1 • Session Preserved
      </p>
    </div>
  </div>
</div>
