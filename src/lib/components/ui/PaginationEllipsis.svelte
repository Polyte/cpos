<script lang="ts">
  import { cn } from './utils';
  import { MoreHorizontalIcon } from 'lucide-svelte';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<span aria-hidden data-slot="pagination-ellipsis" class={cn('flex size-9 items-center justify-center', className)} {...rest}>
  <MoreHorizontalIcon class="size-4" />
  <span class="sr-only">More pages</span>
</span>
