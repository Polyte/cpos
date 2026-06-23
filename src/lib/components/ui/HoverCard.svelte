<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';

  let { class: className = '', text = '', side = 'top' as 'top' | 'bottom' | 'left' | 'right', children, ...rest }: { class?: string; text?: string; side?: 'top' | 'bottom' | 'left' | 'right'; children?: Snippet; [key: string]: any } = $props();

  let visible = $state(false);
  let timeoutId: ReturnType<typeof setTimeout>;

  function handleMouseEnter() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => visible = true, 300);
  }

  function handleMouseLeave() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => visible = false, 100);
  }
</script>

<div data-slot="hover-card" class={cn('relative inline-flex', className)} onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave} {...rest}>
  <span data-slot="hover-card-trigger" class="inline-flex">
    {#if children}{@render children()}{/if}
  </span>
  {#if visible}
    <div
      data-slot="hover-card-content"
      transition:fade={{ duration: 150 }}
      class="bg-popover text-popover-foreground z-50 w-64 rounded-md border p-4 shadow-md outline-hidden"
      class:top={side === 'top'} class:bottom={side === 'bottom'} class:left={side === 'left'} class:right={side === 'right'}
      style={side === 'top' ? 'bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); position: absolute;' :
             side === 'bottom' ? 'top: calc(100% + 8px); left: 50%; transform: translateX(-50%); position: absolute;' :
             side === 'left' ? 'right: calc(100% + 8px); top: 50%; transform: translateY(-50%); position: absolute;' :
             'left: calc(100% + 8px); top: 50%; transform: translateY(-50%); position: absolute;'}
    >
      {text}
    </div>
  {/if}
</div>
