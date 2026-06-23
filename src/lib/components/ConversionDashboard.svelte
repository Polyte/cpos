<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import manifest from '../progress-manifest.json';

  interface FileEntry {
    path: string;
    from: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  }

  interface Phase {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed';
    files: FileEntry[];
  }

  let data = $state<{ phases: Phase[] }>(manifest as any);
  let autoRefresh = $state(true);
  let lastUpdated = $state(new Date().toLocaleTimeString());

  function getPhaseProgress(files: FileEntry[]) {
    const total = files.length;
    const done = files.filter(f => f.status === 'completed').length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function getOverallProgress() {
    let total = 0, done = 0;
    for (const phase of data.phases) {
      for (const file of phase.files) {
        total++;
        if (file.status === 'completed') done++;
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function updatePhaseStatus(phase: Phase) {
    const { done, total } = getPhaseProgress(phase.files);
    if (done === total) phase.status = 'completed';
    else if (done > 0) phase.status = 'in_progress';
    else phase.status = 'pending';
  }

  onMount(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      lastUpdated = new Date().toLocaleTimeString();
    }, 1000);
    return () => clearInterval(interval);
  });

  const overall = $derived(getOverallProgress());
  let phaseEntries = $derived(data.phases);

  const statusColors: Record<string, string> = {
    pending: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500',
    in_progress: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    skipped: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700',
  };

  const fileStatusColors: Record<string, string> = {
    pending: 'text-neutral-400',
    in_progress: 'text-amber-500',
    completed: 'text-emerald-500',
    skipped: 'text-neutral-300',
  };
</script>

<div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
  <div class="max-w-5xl mx-auto space-y-8">

    <!-- Header -->
    <div class="flex items-center justify-between" in:fly={{ y: -20, duration: 400 }}>
      <div>
        <h1 class="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          Conversion Dashboard
        </h1>
        <p class="text-sm text-neutral-500 mt-1">React → Svelte 5 migration tracker</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-neutral-500 font-mono">Updated {lastUpdated}</span>
        </div>
      </div>
    </div>

    <!-- Overall Progress -->
    <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm" transition:fade={{ duration: 300 }}>
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">Overall Progress</span>
          <span class="text-xs text-neutral-400 ml-2">{overall.done} / {overall.total} files</span>
        </div>
        <span class="text-2xl font-black tabular-nums {overall.pct === 100 ? 'text-emerald-500' : 'text-indigo-500'}">{overall.pct}%</span>
      </div>
      <div class="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-1000 ease-out"
          class:bg-emerald-500={overall.pct === 100}
          class:bg-gradient-to-r={overall.pct < 100}
          class:from-indigo-500={overall.pct < 100}
          class:to-amber-500={overall.pct < 100}
          style="width: {overall.pct}%"
        ></div>
      </div>
    </div>

    <!-- Phase Cards -->
    {#each phaseEntries as phase (phase.id)}
      {@const progress = getPhaseProgress(phase.files)}
      <div
        class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm"
        transition:fly={{ y: 10, duration: 300 }}
      >
        <!-- Phase Header -->
        <div class="px-6 py-4 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800">
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full"
              class:bg-emerald-500={phase.status === 'completed'}
              class:bg-amber-500={phase.status === 'in_progress'}
              class:bg-neutral-300={phase.status === 'pending'}
              class:dark:bg-neutral-600={phase.status === 'pending'}
            ></div>
            <div>
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{phase.name}</span>
              <span class="text-xs text-neutral-400 ml-2">{progress.done}/{progress.total}</span>
            </div>
          </div>
          <span
            class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border {statusColors[phase.status]}"
          >
            {phase.status === 'in_progress' ? 'In Progress' : phase.status}
          </span>
        </div>

        <!-- Progress bar -->
        <div class="px-6 pt-3 pb-1">
          <div class="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-700 ease-out"
              class:bg-emerald-500={phase.status === 'completed'}
              class:bg-amber-500={phase.status === 'in_progress'}
              class:bg-neutral-300={phase.status === 'pending' && progress.pct === 0}
              style="width: {progress.pct}%"
            ></div>
          </div>
        </div>

        <!-- File List -->
        <div class="px-6 pb-4 pt-2">
          <div class="space-y-1">
            {#each phase.files as file (file.path)}
              <div class="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div class="w-4 flex justify-center">
                  {#if file.status === 'completed'}
                    <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  {:else if file.status === 'in_progress'}
                    <div class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  {:else if file.status === 'skipped'}
                    <span class="text-neutral-300 text-xs">—</span>
                  {:else}
                    <div class="w-3 h-3 rounded-full border-2 border-neutral-300 dark:border-neutral-600"></div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <span class="text-xs font-mono {fileStatusColors[file.status]}">{file.path}</span>
                  <span class="text-[10px] text-neutral-400 ml-2 truncate">← {file.from}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<script module>
  // Allow hot-reload of manifest
  if (import.meta.hot) {
    import.meta.hot.accept(['../progress-manifest.json'], () => {});
  }
</script>
