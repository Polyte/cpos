<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', variant = 'default' as 'default' | 'destructive', children, ...rest }: { class?: string; variant?: 'default' | 'destructive'; children?: Snippet; [key: string]: any } = $props();
</script>

<div
  data-slot="alert"
  role="alert"
  class={cn(
    'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
    variant === 'default' && 'bg-card text-card-foreground',
    variant === 'destructive' && 'text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
