<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="collapsible-trigger" {onclick} class={cn('', className)} {...rest}>
  {#if children}{@render children()}{/if}
</button>
