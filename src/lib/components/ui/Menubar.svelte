<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="menubar" class={cn('bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
