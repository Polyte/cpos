<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', src = '', alt = '', fallback, ...rest }: { class?: string; src?: string; alt?: string; fallback?: string; [key: string]: any } = $props();
</script>

<div data-slot="avatar" class={cn('relative flex shrink-0 overflow-hidden rounded-full', className)} {...rest}>
  {#if src}
    <img src={src} {alt} class="aspect-square h-full w-full" />
  {:else if fallback}
    <div class="flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-medium">{fallback}</div>
  {/if}
</div>
