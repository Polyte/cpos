<script lang="ts">
  import { ChevronRightIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', inset = false, open = false, onclick, children, ...rest }: { class?: string; inset?: boolean; open?: boolean; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="dropdown-menu-sub" class={cn('relative', className)} {...rest}>
  <button
    data-slot="dropdown-menu-sub-trigger"
    data-inset={inset}
    data-state={open ? 'open' : 'closed'}
    onclick={onclick}
    class={cn(
      'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 text-left',
      className
    )}
  >
    {#if children}{@render children()}{/if}
    <ChevronRightIcon class="ml-auto size-4" />
  </button>
</div>
