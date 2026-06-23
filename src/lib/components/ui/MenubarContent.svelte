<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  let { class: className = '', open = false, align = 'start' as 'start' | 'center' | 'end', children, ...rest }: { class?: string; open?: boolean; align?: 'start' | 'center' | 'end'; children?: Snippet; [key: string]: any } = $props();
</script>

{#if open}
  <div data-slot="menubar-portal" class="fixed inset-0 z-50" onclick={() => {}} onkeydown={(e) => e.key === 'Escape' && (open = false)}>
    <div
      data-slot="menubar-content"
      transition:fade={{ duration: 100 }}
      class={cn(
        'bg-popover text-popover-foreground z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md absolute top-full mt-1',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        className
      )}
      {...rest}
    >
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
