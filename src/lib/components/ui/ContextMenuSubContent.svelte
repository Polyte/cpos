<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  let { class: className = '', open = false, children, ...rest }: { class?: string; open?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

{#if open}
  <div data-slot="context-menu-sub-content" transition:fade={{ duration: 100 }}
    class={cn(
      'bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg absolute left-full top-0',
      className
    )}
    {...rest}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
