<script lang="ts">
  import { XIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  let {
    class: className = '',
    open = false,
    onclose,
    children,
    ...rest
  }: {
    class?: string;
    open?: boolean;
    onclose?: () => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

{#if open}
  <div data-slot="dialog-portal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div
      data-slot="dialog-overlay"
      transition:fade={{ duration: 200 }}
      class="fixed inset-0 bg-black/50"
      onclick={onclose}
      onkeydown={(e) => e.key === 'Escape' && onclose?.()}
    />
    <div
      data-slot="dialog-content"
      transition:scale={{ start: 0.95, opacity: 0, duration: 200 }}
      class={cn(
        'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg',
        className
      )}
      {...rest}
    >
      {#if children}{@render children()}{/if}
      <button
        onclick={onclose}
        data-slot="dialog-close"
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <XIcon class="size-4" />
        <span class="sr-only">Close</span>
      </button>
    </div>
  </div>
{/if}
