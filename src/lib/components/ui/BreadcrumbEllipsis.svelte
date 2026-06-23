<script lang="ts">
  import { cn } from './utils';
  import { MoreHorizontal } from 'lucide-svelte';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" class={cn('flex size-9 items-center justify-center', className)} {...rest}>
  <MoreHorizontal class="size-4" />
  <span class="sr-only">More</span>
</span>
