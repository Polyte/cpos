<script lang="ts">
  import { XIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

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
  <div data-slot="alert-dialog-portal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div data-slot="alert-dialog-overlay" class="fixed inset-0 bg-black/50 animate-in fade-in-0" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose?.()} />
    <div
      data-slot="alert-dialog-content"
      class={cn(
        'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg animate-in fade-in-0 zoom-in-95 sm:max-w-lg',
        className
      )}
      {...rest}
    >
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
