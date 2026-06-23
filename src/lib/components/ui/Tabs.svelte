<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    value = '',
    onchange,
    children,
    ...rest
  }: {
    class?: string;
    value?: string;
    onchange?: (value: string) => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<div data-slot="tabs" class={cn('flex flex-col gap-2', className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
