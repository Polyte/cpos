<script lang="ts">
  import { cn } from './utils';
  import Separator from './Separator.svelte';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<Separator data-slot="sidebar-separator" data-sidebar="separator" class={cn('bg-sidebar-border mx-2 w-auto', className)} {...rest} />
