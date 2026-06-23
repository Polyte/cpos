<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<ul data-slot="navigation-menu-list" class={cn('group flex flex-1 list-none items-center justify-center gap-1', className)} {...rest}>
  {#if children}{@render children()}{/if}
</ul>
