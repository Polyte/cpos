<script lang="ts">
  import { cn } from './utils';
  import { CircleIcon } from 'lucide-svelte';

  let { class: className = '', value = '', checked = false, onclick, disabled = false, ...rest }: { class?: string; value?: string; checked?: boolean; onclick?: (e: MouseEvent) => void; disabled?: boolean; [key: string]: any } = $props();
</script>

<button
  type="button"
  role="radio"
  aria-checked={checked}
  data-slot="radio-group-item"
  {value}
  {disabled}
  {onclick}
  class={cn(
    'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...rest}
>
  {#if checked}
    <span data-slot="radio-group-indicator" class="relative flex items-center justify-center">
      <CircleIcon class="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
    </span>
  {/if}
</button>
