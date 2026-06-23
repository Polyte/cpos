<script lang="ts">
  import { cn } from './utils';
  import { ArrowLeft } from 'lucide-svelte';
  import Button from './Button.svelte';

  let { class: className = '', onclick, disabled = false, ...rest }: { class?: string; onclick?: (e: MouseEvent) => void; disabled?: boolean; [key: string]: any } = $props();
</script>

<Button data-slot="carousel-previous" variant="outline" size="icon" {disabled} {onclick} class={cn('absolute size-8 rounded-full top-1/2 -left-12 -translate-y-1/2', className)} {...rest}>
  <ArrowLeft class="size-4" />
  <span class="sr-only">Previous slide</span>
</Button>
