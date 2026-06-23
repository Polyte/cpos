<script lang="ts">
  import { cn } from './utils';
  import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<nav role="navigation" aria-label="pagination" data-slot="pagination" class={cn('mx-auto flex w-full justify-center', className)} {...rest}>
  {#if children}{@render children()}{/if}
</nav>
