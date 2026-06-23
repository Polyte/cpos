<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<h4 data-slot="card-title" class={cn('leading-none', className)} {...rest}>
  {#if children}{@render children()}{/if}
</h4>
