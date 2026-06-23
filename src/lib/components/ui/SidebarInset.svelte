<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<main data-slot="sidebar-inset" class={cn('bg-background relative flex w-full flex-1 flex-col', className)} {...rest}>
  {#if children}{@render children()}{/if}
</main>
