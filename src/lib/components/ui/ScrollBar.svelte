<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', orientation = 'vertical' as 'vertical' | 'horizontal', ...rest }: { class?: string; orientation?: 'vertical' | 'horizontal'; [key: string]: any } = $props();
</script>

<div
  data-slot="scroll-area-scrollbar"
  role="scrollbar"
  aria-orientation={orientation}
  class={cn(
    'flex touch-none p-px transition-colors select-none',
    orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
    orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
    className
  )}
  {...rest}
>
  <div data-slot="scroll-area-thumb" class="bg-border relative flex-1 rounded-full" />
</div>
