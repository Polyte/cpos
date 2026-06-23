<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    id = '',
    config = {} as Record<string, { label?: string; color?: string; theme?: Record<string, string> }>,
    children,
    ...rest
  }: {
    class?: string;
    id?: string;
    config?: Record<string, { label?: string; color?: string; theme?: Record<string, string> }>;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  const chartId = `chart-${id || Math.random().toString(36).slice(2, 9)}`;

  const THEMES = { light: '', dark: '.dark' };
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color);

  let styleContent = '';
  if (colorConfig.length > 0) {
    styleContent = Object.entries(THEMES).map(([theme, prefix]) =>
      `${prefix} [data-chart="${chartId}"] {\n${colorConfig.map(([key, itemConfig]) => {
        const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
        return color ? `  --color-${key}: ${color};` : null;
      }).filter(Boolean).join('\n')}\n}`
    ).join('\n');
  }
</script>

<div
  data-slot="chart"
  data-chart={chartId}
  class={cn(
    '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke="#fff"]]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-surface]:outline-hidden',
    className
  )}
  {...rest}
>
  {#if styleContent}
    <style>{styleContent}</style>
  {/if}
  {#if children}{@render children()}{/if}
</div>
