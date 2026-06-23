<script lang="ts">
  import { cn } from './utils';
  import { GripVerticalIcon } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    direction = 'horizontal' as 'horizontal' | 'vertical',
    children,
    ...rest
  }: {
    class?: string;
    direction?: 'horizontal' | 'vertical';
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<div
  data-slot="resizable-panel-group"
  class={cn('flex h-full w-full', direction === 'vertical' ? 'flex-col' : 'flex-row', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
