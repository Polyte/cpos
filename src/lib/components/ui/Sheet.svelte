<script lang="ts">
  import { XIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let {
    class: className = '',
    open = false,
    side = 'right' as 'top' | 'right' | 'bottom' | 'left',
    onclose,
    children,
    ...rest
  }: {
    class?: string;
    open?: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    onclose?: () => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  let flyConfig = $derived(() => {
    switch (side) {
      case 'top': return { y: -200, duration: 300 };
      case 'bottom': return { y: 200, duration: 300 };
      case 'left': return { x: -200, duration: 300 };
      case 'right': return { x: 200, duration: 300 };
    }
  });
</script>

{#if open}
  <div data-slot="sheet-portal" class="fixed inset-0 z-50">
    <div data-slot="sheet-overlay" transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/50" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose?.()} />
    <div
      data-slot="sheet-content"
      transition:fly={flyConfig()}
      class={cn(
        'bg-background fixed z-50 flex flex-col gap-4 shadow-lg',
        side === 'right' && 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
        side === 'left' && 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
        side === 'top' && 'inset-x-0 top-0 h-auto border-b',
        side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t',
        className
      )}
      {...rest}
    >
      {#if children}{@render children()}{/if}
      <button
        onclick={onclose}
        data-slot="sheet-close"
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <XIcon class="size-4" />
        <span class="sr-only">Close</span>
      </button>
    </div>
  </div>
{/if}
