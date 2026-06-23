<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<span data-slot="dropdown-menu-sub-content" class={cn('bg-popover text-popover-foreground absolute left-full top-0 z-50 min-w-[8rem] rounded-md border p-1 shadow-lg ml-1', className)} {...rest}>
  {#if children}{@render children()}{/if}
</span>
