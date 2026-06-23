<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', inset = false, variant = 'default' as 'default' | 'destructive', onclick, children, ...rest }: { class?: string; inset?: boolean; variant?: 'default' | 'destructive'; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button
  data-slot="dropdown-menu-item"
  data-inset={inset}
  data-variant={variant}
  onclick={onclick}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 w-full text-left',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>
