<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<p data-slot="card-description" class={cn('text-muted-foreground', className)} {...rest}>
  {#if children}{@render children()}{/if}
</p>
