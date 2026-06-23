<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', orientation = 'horizontal' as 'horizontal' | 'vertical', ...rest }: { class?: string; orientation?: 'horizontal' | 'vertical'; [key: string]: any } = $props();
</script>

<hr
  data-slot="separator"
  role="separator"
  aria-orientation={orientation}
  class={cn(
    'shrink-0 bg-border',
    orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
    className
  )}
  {...rest}
/>
