<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<nav data-slot="navigation-menu" class={cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center', className)} {...rest}>
  {#if children}{@render children()}{/if}
</nav>
