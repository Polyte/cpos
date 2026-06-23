<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<hr data-slot="select-separator" class={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)} {...rest} />
