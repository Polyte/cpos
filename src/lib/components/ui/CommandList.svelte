<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="command-list" class={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
