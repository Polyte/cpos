<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<span data-slot="menubar-shortcut" class={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)} {...rest}>
  {#if children}{@render children()}{/if}
</span>
