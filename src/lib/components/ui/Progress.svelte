<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', value = 0, ...rest }: { class?: string; value?: number; [key: string]: any } = $props();

  let indicatorStyle = $derived(`transform: translateX(-${100 - Math.min(100, Math.max(0, value))}%)`);
</script>

<div data-slot="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} class={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)} {...rest}>
  <div data-slot="progress-indicator" class="bg-primary h-full w-full flex-1 transition-all" style={indicatorStyle} />
</div>
