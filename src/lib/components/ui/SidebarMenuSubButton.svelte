<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, isActive = false, href = '', children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; isActive?: boolean; href?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<a
  data-slot="sidebar-menu-sub-button"
  data-sidebar="menu-sub-button"
  data-active={isActive}
  {href}
  class={cn(
    'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 text-sm data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</a>
