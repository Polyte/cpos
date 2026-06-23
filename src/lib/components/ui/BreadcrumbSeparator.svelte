<script lang="ts">
  import { cn } from './utils';
  import { ChevronRight } from 'lucide-svelte';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class={cn('[&>svg]:size-3.5', className)} {...rest}>
  <ChevronRight class="size-3.5" />
</li>
