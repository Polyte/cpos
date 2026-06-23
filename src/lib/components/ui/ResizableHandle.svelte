<script lang="ts">
  import { cn } from './utils';
  import { GripVerticalIcon } from 'lucide-svelte';

  let { class: className = '', withHandle = false, ...rest }: { class?: string; withHandle?: boolean; [key: string]: any } = $props();
</script>

<div
  data-slot="resizable-handle"
  class={cn(
    'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden cursor-col-resize shrink-0',
    className
  )}
  {...rest}
>
  {#if withHandle}
    <div class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
      <GripVerticalIcon class="size-2.5" />
    </div>
  {/if}
</div>
