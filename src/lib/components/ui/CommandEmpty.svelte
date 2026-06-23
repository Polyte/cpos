<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="command-empty" class={cn('py-6 text-center text-sm', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
