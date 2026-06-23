<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let {
    class: className = '',
    open = false,
    onclose,
    direction = 'bottom' as 'top' | 'bottom' | 'left' | 'right',
    children,
    ...rest
  }: {
    class?: string;
    open?: boolean;
    onclose?: () => void;
    direction?: 'top' | 'bottom' | 'left' | 'right';
    children?: Snippet;
    [key: string]: any;
  } = $props();

  let flyConfig = $derived(() => {
    switch (direction) {
      case 'top': return { y: -200, duration: 300 };
      case 'bottom': return { y: 200, duration: 300 };
      case 'left': return { x: -200, duration: 300 };
      case 'right': return { x: 200, duration: 300 };
    }
  });
</script>

{#if open}
  <div data-slot="drawer-portal" class="fixed inset-0 z-50">
    <div data-slot="drawer-overlay" transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/50" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose?.()} />
    <div
      data-slot="drawer-content"
      transition:fly={flyConfig()}
      class={cn(
        'bg-background fixed z-50 flex h-auto flex-col gap-4 shadow-lg',
        direction === 'bottom' && 'inset-x-0 bottom-0 max-h-[80vh] rounded-t-lg border-t',
        direction === 'top' && 'inset-x-0 top-0 max-h-[80vh] rounded-b-lg border-b',
        direction === 'right' && 'inset-y-0 right-0 w-3/4 border-l sm:max-w-sm',
        direction === 'left' && 'inset-y-0 left-0 w-3/4 border-r sm:max-w-sm',
        className
      )}
      {...rest}
    >
      <div class="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full"
        class:block={direction === 'bottom' || direction === 'top'} />
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
