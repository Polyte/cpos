<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', href = '', isActive = false, children, ...rest }: { class?: string; href?: string; isActive?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

<a
  {href}
  aria-current={isActive ? 'page' : undefined}
  data-slot="pagination-link"
  data-active={isActive}
  class={cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 shrink-0 outline-none',
    isActive
      ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9'
      : 'hover:bg-accent hover:text-accent-foreground h-9 w-9',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</a>
