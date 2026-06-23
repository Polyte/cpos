<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', href = '', children, ...rest }: { class?: string; href?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<a data-slot="breadcrumb-link" {href} class={cn('hover:text-foreground transition-colors', className)} {...rest}>
  {#if children}{@render children()}{/if}
</a>
