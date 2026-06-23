<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    variant = 'default' as 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link',
    size = 'default' as 'default' | 'sm' | 'lg' | 'icon',
    disabled = false,
    type = 'button' as 'button' | 'submit' | 'reset',
    onclick,
    children,
    ...rest
  }: {
    class?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<button
  {type}
  {disabled}
  onclick={onclick}
  class={cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
    variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
    variant === 'outline' && 'border bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
    variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
    variant === 'link' && 'text-primary underline-offset-4 hover:underline',
    size === 'default' && 'h-9 px-4 py-2 has-[>svg]:px-3',
    size === 'sm' && 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
    size === 'lg' && 'h-10 rounded-md px-6 has-[>svg]:px-4',
    size === 'icon' && 'size-9 rounded-md',
    className
  )}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</button>
