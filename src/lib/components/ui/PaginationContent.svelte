<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<ul data-slot="pagination-content" class={cn('flex flex-row items-center gap-1', className)} {...rest}>
  {#if children}{@render children()}{/if}
</ul>
