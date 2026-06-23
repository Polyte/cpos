<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', onclick, ...rest }: { class?: string; onclick?: () => void; [key: string]: any } = $props();
</script>

<button data-sidebar="rail" data-slot="sidebar-rail" aria-label="Toggle Sidebar" tabindex={-1} {onclick} title="Toggle Sidebar"
  class={cn(
    'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex cursor-pointer',
    className
  )}
  {...rest}
/>
