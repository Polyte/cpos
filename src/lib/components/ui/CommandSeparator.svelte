<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<hr data-slot="command-separator" class={cn('bg-border -mx-1 h-px', className)} {...rest} />
