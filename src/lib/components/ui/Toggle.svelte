<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    pressed = false,
    onclick,
    variant = 'default' as 'default' | 'outline',
    size = 'default' as 'default' | 'sm' | 'lg',
    disabled = false,
    children,
    ...rest
  }: {
    class?: string;
    pressed?: boolean;
    onclick?: (e: MouseEvent) => void;
    variant?: 'default' | 'outline';
    size?: 'default' | 'sm' | 'lg';
    disabled?: boolean;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<button
  type="button"
  data-slot="toggle"
  data-state={pressed ? 'on' : 'off'}
  aria-pressed={pressed}
  {disabled}
  {onclick}
  class={cn(
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap',
    variant === 'default' && 'bg-transparent',
    variant === 'outline' && 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
    size === 'default' && 'h-9 px-2 min-w-9',
    size === 'sm' && 'h-8 px-1.5 min-w-8',
    size === 'lg' && 'h-10 px-2.5 min-w-10',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>
