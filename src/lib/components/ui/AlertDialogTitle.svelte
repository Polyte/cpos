<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="alert-dialog-title" class={cn('text-lg font-semibold', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
