<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', oncontextmenu, children, ...rest }: { class?: string; oncontextmenu?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="context-menu-trigger" {oncontextmenu} class={cn('inline-flex', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
