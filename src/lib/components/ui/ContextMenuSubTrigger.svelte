<script lang="ts">
  import { cn } from './utils';
  import { ChevronRightIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="context-menu-sub-trigger" {onclick}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 w-full text-left',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
  <ChevronRightIcon class="ml-auto size-4" />
</button>
