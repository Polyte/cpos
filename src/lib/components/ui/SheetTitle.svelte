<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<h2 data-slot="sheet-title" class={cn('text-foreground font-semibold', className)} {...rest}>
  {#if children}{@render children()}{/if}
</h2>
