<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="card-footer" class={cn('flex items-center px-6 pb-6 [.border-t]:pt-6', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
