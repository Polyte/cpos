<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', inset, children, ...rest }: { class?: string; inset?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="dropdown-menu-label" data-inset={inset} class={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
