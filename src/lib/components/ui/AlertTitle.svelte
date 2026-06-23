<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="alert-title" class={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
