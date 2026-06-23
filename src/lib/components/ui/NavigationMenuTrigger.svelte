<script lang="ts">
  import { cn } from './utils';
  import { ChevronDownIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', onclick, children, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="navigation-menu-trigger" {onclick}
  class={cn('group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-ring/50 outline-none transition-[color,box-shadow] focus-visible:ring-[3px]', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
  <ChevronDownIcon class="relative top-[1px] ml-1 size-3 transition duration-300" aria-hidden="true" />
</button>
