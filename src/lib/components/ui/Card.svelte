<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="card" class={cn('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
