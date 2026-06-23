<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', text = '', side = 'top' as 'top' | 'bottom' | 'left' | 'right', children, ...rest }: { class?: string; text?: string; side?: 'top' | 'bottom' | 'left' | 'right'; children?: Snippet; [key: string]: any } = $props();

  let visible = $state(false);
  let timeoutId: ReturnType<typeof setTimeout>;

  function handleMouseEnter() {
    timeoutId = setTimeout(() => visible = true, 300);
  }

  function handleMouseLeave() {
    clearTimeout(timeoutId);
    visible = false;
  }
</script>

<div data-slot="tooltip" class={cn('relative inline-flex', className)} onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave} {...rest}>
  <span data-slot="tooltip-trigger" class="inline-flex">
    {#if children}{@render children()}{/if}
  </span>
  {#if visible}
    <div
      data-slot="tooltip-content"
      class="bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 absolute z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance pointer-events-none"
      class:top={side === 'top'}
      class:bottom={side === 'bottom'}
      class:left={side === 'left'}
      class:right={side === 'right'}
      style={side === 'top' ? 'bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);' :
             side === 'bottom' ? 'top: calc(100% + 6px); left: 50%; transform: translateX(-50%);' :
             side === 'left' ? 'right: calc(100% + 6px); top: 50%; transform: translateY(-50%);' :
             'left: calc(100% + 6px); top: 50%; transform: translateY(-50%);'}
    >
      {text}
    </div>
  {/if}
</div>
