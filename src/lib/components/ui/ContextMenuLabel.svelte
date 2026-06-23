<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="context-menu-label" class={cn('text-foreground px-2 py-1.5 text-sm font-medium', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
