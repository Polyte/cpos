<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="form-item" class={cn('grid gap-2', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
