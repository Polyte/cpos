<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, disabled = false, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; disabled?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="context-menu-item" {onclick} {disabled}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 w-full text-left',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>
