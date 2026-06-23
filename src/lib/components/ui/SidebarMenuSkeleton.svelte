<script lang="ts">
  import { cn } from './utils';
  import Skeleton from './Skeleton.svelte';

  let { class: className = '', showIcon = false, ...rest }: { class?: string; showIcon?: boolean; [key: string]: any } = $props();

  const width = `${Math.floor(Math.random() * 40) + 50}%`;
</script>

<div data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" class={cn('flex h-8 items-center gap-2 rounded-md px-2', className)} {...rest}>
  {#if showIcon}
    <Skeleton class="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />
  {/if}
  <Skeleton class="h-4 flex-1" data-sidebar="menu-skeleton-text" style={`max-width: ${width}`} />
</div>
