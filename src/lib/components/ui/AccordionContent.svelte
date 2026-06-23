<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="accordion-content" class="overflow-hidden text-sm" {...rest}>
  <div class={cn('pt-0 pb-4', className)}>
    {#if children}{@render children()}{/if}
  </div>
</div>
