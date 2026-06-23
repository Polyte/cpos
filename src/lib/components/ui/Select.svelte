<script lang="ts">
  import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from 'lucide-svelte';
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    value = '',
    placeholder = '',
    size = 'default' as 'sm' | 'default',
    disabled = false,
    onchange,
    children,
    ...rest
  }: {
    class?: string;
    value?: string;
    placeholder?: string;
    size?: 'sm' | 'default';
    disabled?: boolean;
    onchange?: (value: string) => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement;

  function handleToggle() {
    if (!disabled) open = !open;
  }

  function handleSelect(val: string) {
    value = val;
    onchange?.(val);
    open = false;
    triggerEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      const items = document.querySelectorAll('[data-slot="select-item"]');
      const focused = document.activeElement;
      const idx = Array.from(items).indexOf(focused as HTMLElement);
      (items[idx + 1] as HTMLElement)?.focus();
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      const items = document.querySelectorAll('[data-slot="select-item"]');
      const focused = document.activeElement;
      const idx = Array.from(items).indexOf(focused as HTMLElement);
      (items[idx - 1] as HTMLElement)?.focus();
    }
  }
</script>

<div data-slot="select" class="relative" {...rest}>
  <button
    bind:this={triggerEl}
    data-slot="select-trigger"
    data-size={size}
    disabled={disabled}
    onclick={handleToggle}
    onkeydown={handleKeydown}
    class={cn(
      'border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*="text-"])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-input-background px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8',
      className
    )}
  >
    {#if children}
      {@render children()}
    {:else}
      <span data-slot="select-value" class="line-clamp-1 flex items-center gap-2">{value || placeholder}</span>
    {/if}
    <ChevronDownIcon class="size-4 opacity-50 shrink-0" />
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      data-slot="select-content"
      role="listbox"
      class="bg-popover text-popover-foreground absolute z-50 mt-1 min-w-[8rem] w-full overflow-hidden rounded-md border shadow-md animate-in fade-in-0 zoom-in-95"
      onkeydown={handleKeydown}
    >
      <div class="flex cursor-default items-center justify-center py-1"><ChevronUpIcon class="size-4" /></div>
      <div data-slot="select-viewport" class="p-1 max-h-[var(--radix-select-content-available-height, 300px)] overflow-y-auto">
        {#if children}
          {@render children()}
        {/if}
      </div>
      <div class="flex cursor-default items-center justify-center py-1"><ChevronDownIcon class="size-4" /></div>
    </div>
  {/if}
</div>
