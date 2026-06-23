<script lang="ts">
  import { cn } from './utils';
  import { CheckIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { class: className = '', checked = false, onclick, children, ...rest }: { class?: string; checked?: boolean; onclick?: (e: MouseEvent) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button type="button" data-slot="context-menu-checkbox-item" role="menuitemcheckbox" aria-checked={checked} {onclick}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 w-full text-left',
    className
  )}
  {...rest}
>
  <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
    {#if checked}
      <CheckIcon class="size-4" />
    {/if}
  </span>
  {#if children}{@render children()}{/if}
</button>
