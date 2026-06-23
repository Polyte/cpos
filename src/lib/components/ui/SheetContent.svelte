<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', side = 'right' as 'top' | 'right' | 'bottom' | 'left', children, ...rest }: { class?: string; side?: 'top' | 'right' | 'bottom' | 'left'; children?: Snippet; [key: string]: any } = $props();
</script>

<div
  data-slot="sheet-content"
  class={cn(
    'bg-background fixed z-50 flex flex-col gap-4 shadow-lg p-6',
    side === 'right' && 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
    side === 'left' && 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
    side === 'top' && 'inset-x-0 top-0 h-auto border-b',
    side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
