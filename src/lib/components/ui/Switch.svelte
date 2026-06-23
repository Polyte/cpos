<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', checked = false, disabled = false, onchange, ...rest }: { class?: string; checked?: boolean; disabled?: boolean; onchange?: (e: Event) => void; [key: string]: any } = $props();
</script>

<button
  role="switch"
  aria-checked={checked}
  data-slot="switch"
  data-state={checked ? 'checked' : 'unchecked'}
  disabled={disabled}
  onclick={() => { checked = !checked; }}
  class={cn(
    'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...rest}
>
  <span
    data-slot="switch-thumb"
    data-state={checked ? 'checked' : 'unchecked'}
    class={cn(
      'bg-card dark:data-[state=unchecked]:bg-card-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0'
    )}
  />
</button>
