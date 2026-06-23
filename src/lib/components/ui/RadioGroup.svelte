<script lang="ts">
  import { cn } from './utils';
  import { CircleIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', value = '', onchange, children, ...rest }: { class?: string; value?: string; onchange?: (e: Event) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="radio-group" class={cn('grid gap-3', className)} role="radiogroup" {...rest}>
  {#if children}{@render children()}{/if}
</div>
