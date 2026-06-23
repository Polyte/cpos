<script lang="ts">
  import { MapPin, Search, Loader2, X, AlertCircle } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';

  let {
    value,
    onchange,
    onselect,
    placeholder = 'Start typing an address...',
    hasError = false,
    errorMessage = ''
  }: {
    value: string;
    onchange: (v: string) => void;
    onselect: (details: any) => void;
    placeholder?: string;
    hasError?: boolean;
    errorMessage?: string;
  } = $props();

  let predictions = $state<any[]>([]);
  let loading = $state(false);
  let open = $state(false);
  let selectedDescription = $state('');
  let containerEl: HTMLDivElement | undefined = $state();
  let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    function handleClick(e: MouseEvent) {
      if (containerEl && !containerEl.contains(e.target as Node)) {
        open = false;
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  });

  async function fetchPredictions(input: string) {
    if (input.length < 3) { predictions = []; open = false; return; }
    loading = true;
    try {
      const res = await api.placesAutocomplete(input);
      predictions = res.predictions || [];
      open = (res.predictions || []).length > 0;
    } catch { predictions = []; }
    finally { loading = false; }
  }

  function handleInput(v: string) {
    onchange(v);
    selectedDescription = '';
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => fetchPredictions(v), 350);
  }

  async function handleSelect(prediction: any) {
    open = false;
    selectedDescription = prediction.description;
    onchange(prediction.description);
    try {
      const details = await api.placeDetails(prediction.placeId);
      if (details && !details.error) {
        onselect(details);
      }
    } catch (e) {
      console.error('[AddressAutocomplete] placeDetails error:', e);
    }
  }
</script>

<div bind:this={containerEl} class="relative">
  <div class="relative">
    <input
      value={value}
      oninput={e => handleInput(e.target.value)}
      onfocus={() => { if (predictions.length > 0 && !selectedDescription) open = true; }}
      {placeholder}
      class="w-full pl-12 pr-10 py-4 bg-neutral-50 dark:bg-neutral-800 text-white border rounded-2xl font-bold outline-none focus:ring-2 transition-all {hasError ? 'border-red-300 focus:ring-red-400 bg-red-50/30' : 'border-neutral-100 dark:border-neutral-700 focus:ring-indigo-500'}"
    />
    <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 {hasError ? 'text-red-400' : 'text-neutral-300'}" />
    {#if loading}
      <Loader2 class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-300" />
    {/if}
    {#if !loading && value}
      <button
        type="button"
        onclick={() => { onchange(''); predictions = []; open = false; selectedDescription = ''; }}
        class="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-all"
      >
        <X class="w-3.5 h-3.5 text-neutral-400" />
      </button>
    {/if}
  </div>

  {#if hasError && errorMessage}
    <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500">
      <AlertCircle class="w-3 h-3" /> {errorMessage}
    </p>
  {/if}

  {#if open && predictions.length > 0}
    <div
      transition:fly={{ y: -4, duration: 150 }}
      class="absolute z-50 w-full mt-2 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-2xl overflow-hidden"
    >
      <div class="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-700">
        <p class="text-[8px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
          <Search class="w-3 h-3"></Search> Address Suggestions
        </p>
      </div>
      {#each predictions as p, i}
        <button
          type="button"
          onclick={() => handleSelect(p)}
          class="w-full text-left px-5 py-3.5 hover:bg-indigo-50 dark:hover:bg-neutral-700 transition-all flex items-start gap-3 border-b border-neutral-50 dark:border-neutral-700/50 last:border-0"
        >
          <MapPin class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div class="min-w-0">
            <p class="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">{p.mainText}</p>
            <p class="text-[10px] font-medium text-neutral-400 truncate">{p.secondaryText}</p>
          </div>
        </button>
      {/each}
      <div class="px-4 py-2 bg-neutral-50 dark:bg-neutral-900">
        <p class="text-[7px] font-bold text-neutral-300 uppercase tracking-widest">Powered by Google Places</p>
      </div>
    </div>
  {/if}
</div>
