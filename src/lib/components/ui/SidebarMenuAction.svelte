<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', onclick, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; [key: string]: any } = $props();
</script>

<button type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action"
  {onclick}
  class={cn(
    'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
    className
  )}
  {...rest}
/>
