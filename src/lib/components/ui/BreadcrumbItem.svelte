<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<li data-slot="breadcrumb-item" class={cn('inline-flex items-center gap-1.5', className)} {...rest}>
  {#if children}{@render children()}{/if}
</li>
