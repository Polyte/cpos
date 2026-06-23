<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<div data-slot="skeleton" class={cn('bg-accent animate-pulse rounded-md', className)} {...rest} />
