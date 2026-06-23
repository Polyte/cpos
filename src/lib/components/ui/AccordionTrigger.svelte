<script lang="ts">
  import { cn } from './utils';
  import { ChevronDownIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="accordion-trigger"
  {onclick}
  class={cn('focus-visible:border-ring focus-visible:ring-ring/50 flex w-full flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
  <ChevronDownIcon class="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
</button>
