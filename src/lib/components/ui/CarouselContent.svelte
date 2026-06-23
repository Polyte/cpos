<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="carousel-content" class="overflow-hidden" {...rest}>
  <div class={cn('flex', className)}>
    {#if children}{@render children()}{/if}
  </div>
</div>
