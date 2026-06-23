<script lang="ts">
  import { cn } from './utils';
  import Input from './Input.svelte';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<Input data-slot="sidebar-input" data-sidebar="input" class={cn('bg-background h-8 w-full shadow-none', className)} {...rest} />
