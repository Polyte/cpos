<script lang="ts">
  import { CheckIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', value = '', active = false, disabled = false, onselect, children, ...rest }: { class?: string; value?: string; active?: boolean; disabled?: boolean; onselect?: (value: string) => void; children?: Snippet; [key: string]: any } = $props();
</script>

<button
  role="option"
  aria-selected={active}
  data-slot="select-item"
  data-highlighted={active}
  disabled={disabled}
  onclick={() => onselect?.(value)}
  class={cn(
    'focus:bg-accent focus:text-accent-foreground [&_svg:not([class*="text-"])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    active && 'bg-accent text-accent-foreground',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
  {#if active}
    <span class="absolute right-2 flex size-3.5 items-center justify-center">
      <CheckIcon class="size-4" />
    </span>
  {/if}
</button>
