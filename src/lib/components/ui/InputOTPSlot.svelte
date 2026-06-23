<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', index = 0, char = '', isActive = false, ...rest }: { class?: string; index?: number; char?: string; isActive?: boolean; [key: string]: any } = $props();
</script>

<div
  data-slot="input-otp-slot"
  data-active={isActive}
  class={cn(
    'data-[active=true]:border-ring data-[active=true]:ring-ring/50 dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm bg-input-background transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]',
    className
  )}
  {...rest}
>
  {char}
</div>
