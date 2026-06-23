<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', align = 'center' as 'start' | 'center' | 'end', sideOffset = 4, children, ...rest }: { class?: string; align?: 'start' | 'center' | 'end'; sideOffset?: number; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="popover" class={cn('relative', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
