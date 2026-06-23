<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    value = '',
    onchange,
    variant = 'default' as 'default' | 'outline',
    size = 'default' as 'default' | 'sm' | 'lg',
    children,
    ...rest
  }: {
    class?: string;
    value?: string;
    onchange?: (e: Event) => void;
    variant?: 'default' | 'outline';
    size?: 'default' | 'sm' | 'lg';
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<div
  data-slot="toggle-group"
  data-variant={variant}
  data-size={size}
  class={cn('group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs', className)}
  role="group"
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
