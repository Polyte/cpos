<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="scroll-area" class={cn('relative overflow-hidden', className)} {...rest}>
  <div data-slot="scroll-area-viewport" class="size-full rounded-[inherit] overflow-auto">
    {#if children}{@render children()}{/if}
  </div>
</div>
