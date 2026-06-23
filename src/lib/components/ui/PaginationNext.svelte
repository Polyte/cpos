<script lang="ts">
  import { cn } from './utils';
  import { ChevronRightIcon } from 'lucide-svelte';

  let { class: className = '', href = '', ...rest }: { class?: string; href?: string; [key: string]: any } = $props();
</script>

<a
  {href}
  aria-label="Go to next page"
  data-slot="pagination-link"
  class={cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 shrink-0 outline-none hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 gap-1 px-2.5 sm:pr-2.5',
    className
  )}
  {...rest}
>
  <span class="hidden sm:block">Next</span>
  <ChevronRightIcon class="size-4" />
</a>
