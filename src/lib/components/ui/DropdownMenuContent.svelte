<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  let { class: className = '', sideOffset = 4, open = false, onclose, children, ...rest }: { class?: string; sideOffset?: number; open?: boolean; onclose?: () => void; children?: Snippet; [key: string]: any } = $props();
</script>

{#if open}
  <div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose?.()} />
  <div
    data-slot="dropdown-menu-content"
    transition:scale={{ start: 0.95, opacity: 0, duration: 150 }}
    class={cn(
      'bg-popover text-popover-foreground absolute z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md',
      className
    )}
    {...rest}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
