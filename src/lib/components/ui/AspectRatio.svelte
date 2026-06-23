<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', ratio = 1, children, ...rest }: { class?: string; ratio?: number; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="aspect-ratio" class={cn('relative', className)} style={`padding-bottom: ${100 / ratio}%`} {...rest}>
  <div class="absolute inset-0">
    {#if children}{@render children()}{/if}
  </div>
</div>
