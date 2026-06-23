<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  let { class: className = '', onclick, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<Button variant="outline" {onclick} class={cn('', className)} {...rest}>
  {#if children}{@render children()}{/if}
</Button>
