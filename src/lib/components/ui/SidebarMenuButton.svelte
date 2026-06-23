<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, isActive = false, tooltip = '', children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; isActive?: boolean; tooltip?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-active={isActive}
  {onclick}
  class={cn(
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-sm',
    className
  )}
  title={tooltip || undefined}
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>
