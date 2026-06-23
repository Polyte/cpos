<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="accordion-item" class={cn('border-b last:border-b-0', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
