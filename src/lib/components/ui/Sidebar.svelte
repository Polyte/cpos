<script lang="ts">
  import { cn } from './utils';
  import { PanelLeftIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    side = 'left' as 'left' | 'right',
    collapsible = 'offcanvas' as 'offcanvas' | 'icon' | 'none',
    open = true,
    onToggle,
    children,
    ...rest
  }: {
    class?: string;
    side?: 'left' | 'right';
    collapsible?: 'offcanvas' | 'icon' | 'none';
    open?: boolean;
    onToggle?: () => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<div
  data-slot="sidebar"
  data-sidebar="sidebar"
  data-side={side}
  data-state={open ? 'expanded' : 'collapsed'}
  class={cn(
    'bg-sidebar text-sidebar-foreground flex h-full flex-col',
    collapsible === 'none' ? 'w-(--sidebar-width)' : 'group peer',
    className
  )}
  {...rest}
>
  {#if collapsible !== 'none' && !open}
    <div class="flex items-center justify-center p-2">
      <button type="button" data-sidebar="trigger" data-slot="sidebar-trigger" onclick={onToggle}
        class="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground size-7">
        <PanelLeftIcon class="size-4" />
        <span class="sr-only">Toggle Sidebar</span>
      </button>
    </div>
  {/if}
  {#if children}{@render children()}{/if}
</div>
