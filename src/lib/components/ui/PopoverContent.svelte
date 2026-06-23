<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  let { class: className = '', align = 'center' as 'start' | 'center' | 'end', sideOffset = 4, open = false, onclose, children, ...rest }: { class?: string; align?: 'start' | 'center' | 'end'; sideOffset?: number; open?: boolean; onclose?: () => void; children?: Snippet; [key: string]: any } = $props();
</script>

{#if open}
  <div transition:fade={{ duration: 150 }} class="fixed inset-0 z-40" onclick={onclose} />
  <div
    data-slot="popover-content"
    transition:scale={{ start: 0.95, opacity: 0, duration: 150 }}
    class={cn(
      'bg-popover text-popover-foreground absolute z-50 w-72 rounded-md border p-4 shadow-md outline-hidden',
      className
    )}
    {...rest}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
