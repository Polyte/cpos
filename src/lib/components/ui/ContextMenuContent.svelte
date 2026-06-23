<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  let { class: className = '', open = false, onclose, children, ...rest }: { class?: string; open?: boolean; onclose?: () => void; children?: Snippet; [key: string]: any } = $props();
</script>

{#if open}
  <div data-slot="context-menu-portal" class="fixed inset-0 z-50" onclick={onclose} oncontextmenu={(e) => { e.preventDefault(); onclose?.(); }}>
    <div
      data-slot="context-menu-content"
      transition:fade={{ duration: 100 }}
      class={cn(
        'bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md',
        className
      )}
      onclick={(e) => e.stopPropagation()}
      {...rest}
    >
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
