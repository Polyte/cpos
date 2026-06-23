<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<nav aria-label="breadcrumb" data-slot="breadcrumb" class={cn('', className)} {...rest}>
  {#if children}{@render children()}{/if}
</nav>
