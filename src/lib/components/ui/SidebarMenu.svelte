<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<ul data-slot="sidebar-menu" data-sidebar="menu" class={cn('flex w-full min-w-0 flex-col gap-1', className)} {...rest}>
  {#if children}{@render children()}{/if}
</ul>
