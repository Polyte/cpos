<script lang="ts">
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

  let {
    title,
    value,
    subtitle = '',
    icon,
    trend = 'neutral' as 'up' | 'down' | 'neutral',
    trendValue = '',
    color = 'indigo'
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: any;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: string;
  } = $props();
</script>

<div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col gap-2">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      {#if icon}
        {@const Icon = icon}
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-{color}-100 dark:bg-{color}-500/10">
          <Icon class="w-4 h-4 text-{color}-600 dark:text-{color}-400" />
        </div>
      {/if}
      <span class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{title}</span>
    </div>
    {#if trend !== 'neutral' && trendValue}
      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold {trend === 'up' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}">
        {#if trend === 'up'}
          <TrendingUp class="w-3 h-3" />
        {:else}
          <TrendingDown class="w-3 h-3" />
        {/if}
        {trendValue}
      </div>
    {/if}
  </div>
  <p class="text-2xl font-black text-neutral-900 dark:text-white tabular-nums">{value}</p>
  {#if subtitle}
    <p class="text-[11px] text-neutral-400 dark:text-neutral-500">{subtitle}</p>
  {/if}
</div>
