<script lang="ts">
  import { AlertTriangle, RefreshCw } from 'lucide-svelte';

  let { fallbackTitle = 'Module Fault', onReset, children }: {
    fallbackTitle?: string;
    onReset?: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  let hasError = $state(false);
  let error = $state<Error | null>(null);
  let errorInfo = $state('');

  const handleWindowError = (e: ErrorEvent) => {
    hasError = true;
    error = e.error || new Error(e.message);
    errorInfo = e.filename || '';
    console.error('[ErrorFallback] Caught:', e.error?.message || e.message);
  };

  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', handleWindowError);
      return () => window.removeEventListener('error', handleWindowError);
    }
  });

  function handleReset() {
    hasError = false;
    error = null;
    errorInfo = '';
    onReset?.();
  }
</script>

{#if hasError && error}
  <div class="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center">
    <div class="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 border border-amber-200 dark:border-amber-500/20">
      <AlertTriangle class="w-8 h-8 text-amber-500" />
    </div>
    <h3 class="text-sm font-black uppercase tracking-widest text-neutral-900 dark:text-neutral-100 mb-2">
      {fallbackTitle}
    </h3>
    <p class="text-xs text-neutral-400 max-w-sm mb-1">
      An unexpected error occurred in this section. Your data is safe.
    </p>
    <p class="text-[9px] font-mono text-neutral-300 max-w-md mb-6 break-all">
      {error.message || 'Unknown error'}
    </p>
    <button
      onclick={handleReset}
      class="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-800 transition-colors"
    >
      <RefreshCw class="w-3.5 h-3.5" />
      Recover Module
    </button>
  </div>
{:else}
  {#if children}
    {@render children()}
  {/if}
{/if}
