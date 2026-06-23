<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', href = '', children, ...rest }: { class?: string; href?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<a data-slot="navigation-menu-link" {href}
  class={cn('hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg:not([class*="text-"])]:text-muted-foreground flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none [&_svg:not([class*="size-"])]:size-4', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
</a>
