<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="carousel-item" role="group" aria-roledescription="slide" class={cn('min-w-0 shrink-0 grow-0 basis-full', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
