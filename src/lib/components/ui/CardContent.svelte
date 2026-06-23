<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="card-content" class={cn('px-6 [&:last-child]:pb-6', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
