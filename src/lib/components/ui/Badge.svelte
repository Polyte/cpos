<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', variant = 'default' as 'default' | 'secondary' | 'destructive' | 'outline', children, ...rest }: { class?: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline'; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<div
  data-slot="badge"
  class={cn(
    'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none',
    variant === 'default' && 'border-transparent bg-primary text-primary-foreground',
    variant === 'secondary' && 'border-transparent bg-secondary text-secondary-foreground',
    variant === 'destructive' && 'border-transparent bg-destructive text-destructive-foreground',
    variant === 'outline' && 'text-foreground',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
