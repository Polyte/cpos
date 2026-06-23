<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', minSize = 0, children, ...rest }: { class?: string; minSize?: number; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="resizable-panel" class={cn('overflow-auto', className)} style={minSize ? `min-${'width'}: ${minSize}px` : ''} {...rest}>
  {#if children}{@render children()}{/if}
</div>
