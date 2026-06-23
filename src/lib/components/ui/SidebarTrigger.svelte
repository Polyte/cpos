<script lang="ts">
  import { cn } from './utils';
  import { PanelLeftIcon } from 'lucide-svelte';
  import Button from './Button.svelte';

  let { class: className = '', onclick, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; [key: string]: any } = $props();
</script>

<Button data-sidebar="trigger" data-slot="sidebar-trigger" variant="ghost" size="icon" {onclick} class={cn('size-7', className)} {...rest}>
  <PanelLeftIcon class="size-4" />
  <span class="sr-only">Toggle Sidebar</span>
</Button>
