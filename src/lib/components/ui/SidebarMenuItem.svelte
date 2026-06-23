<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class={cn('group/menu-item relative', className)} {...rest}>
  {#if children}{@render children()}{/if}
</li>
