<script lang="ts">
  import { CheckIcon } from 'lucide-svelte';
  import { cn } from './utils';

  let { class: className = '', checked = false, disabled = false, onchange, ...rest }: { class?: string; checked?: boolean; disabled?: boolean; onchange?: (e: Event) => void; [key: string]: any } = $props();
</script>

<button
  role="checkbox"
  aria-checked={checked}
  data-slot="checkbox"
  data-state={checked ? 'checked' : 'unchecked'}
  disabled={disabled}
  onclick={() => { checked = !checked; }}
  class={cn(
    'peer border bg-input-background dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...rest}
>
  {#if checked}
    <span data-slot="checkbox-indicator" class="flex items-center justify-center text-current transition-none">
      <CheckIcon class="size-3.5" />
    </span>
  {/if}
</button>
