<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="navigation-menu-content" class={cn('top-0 left-0 w-full p-2 pr-2.5 md:absolute md:w-auto', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
