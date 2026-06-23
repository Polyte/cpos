<script lang="ts">
  import { CircleIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', checked = false, onclick, children, ...rest }: { class?: string; checked?: boolean; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button
  data-slot="dropdown-menu-radio-item"
  role="menuitemradio"
  aria-checked={checked}
  onclick={onclick}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 text-left',
    className
  )}
  {...rest}
>
  <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
    {#if checked}
      <CircleIcon class="size-2 fill-current" />
    {/if}
  </span>
  {#if children}{@render children()}{/if}
</button>
