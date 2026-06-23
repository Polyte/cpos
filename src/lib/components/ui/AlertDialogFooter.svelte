<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="alert-dialog-footer" class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
