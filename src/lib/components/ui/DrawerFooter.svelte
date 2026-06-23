<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="drawer-footer" class={cn('mt-auto flex flex-col gap-2 p-4', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
