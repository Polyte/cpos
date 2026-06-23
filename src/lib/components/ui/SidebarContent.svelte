<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="sidebar-content" data-sidebar="content" class={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
