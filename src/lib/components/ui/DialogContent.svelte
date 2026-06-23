<script lang="ts">
  import { cn } from './utils';
  import { XIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclose, children, ...rest }: { class?: string; onclose?: () => void; children?: Snippet; [key: string]: any } = $props();
</script>

<div
  data-slot="dialog-content"
  class={cn(
    'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
  {#if onclose}
    <button
      onclick={onclose}
      data-slot="dialog-close"
      class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
    >
      <XIcon class="size-4" />
      <span class="sr-only">Close</span>
    </button>
  {/if}
</div>
