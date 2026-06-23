<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="drawer-header" class={cn('flex flex-col gap-1.5 p-4', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
