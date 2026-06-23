<script lang="ts">
  import { cn } from './utils';
  import { SearchIcon } from 'lucide-svelte';

  let { class: className = '', value = '', oninput, placeholder = 'Search...', ...rest }: { class?: string; value?: string; oninput?: (e: Event) => void; placeholder?: string; [key: string]: any } = $props();
</script>

<div data-slot="command-input-wrapper" class="flex h-9 items-center gap-2 border-b px-3">
  <SearchIcon class="size-4 shrink-0 opacity-50" />
  <input
    data-slot="command-input"
    {value}
    {oninput}
    {placeholder}
    class={cn('placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50', className)}
    {...rest}
  />
</div>
