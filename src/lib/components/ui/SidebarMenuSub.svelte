<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class={cn('border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5', className)} {...rest}>
  {#if children}{@render children()}{/if}
</ul>
