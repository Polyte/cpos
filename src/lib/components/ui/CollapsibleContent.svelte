<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="collapsible-content" class={cn('', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
