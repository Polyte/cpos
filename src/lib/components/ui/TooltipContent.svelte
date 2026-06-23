<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', side = 'top' as 'top' | 'bottom' | 'left' | 'right', ...rest }: { class?: string; side?: 'top' | 'bottom' | 'left' | 'right'; [key: string]: any } = $props();
</script>

<div
  data-slot="tooltip-content"
  class={cn(
    'bg-primary text-primary-foreground z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance',
    className
  )}
  style={side === 'top' ? 'bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); position: absolute;' :
         side === 'bottom' ? 'top: calc(100% + 6px); left: 50%; transform: translateX(-50%); position: absolute;' :
         side === 'left' ? 'right: calc(100% + 6px); top: 50%; transform: translateY(-50%); position: absolute;' :
         'left: calc(100% + 6px); top: 50%; transform: translateY(-50%); position: absolute;'}
  {...rest}
>
  <slot />
</div>
