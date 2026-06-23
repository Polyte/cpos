<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="sidebar-group-content" data-sidebar="group-content" class={cn('w-full text-sm', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
