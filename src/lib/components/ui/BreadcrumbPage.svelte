<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class={cn('text-foreground font-normal', className)} {...rest}>
  {#if children}{@render children()}{/if}
</span>
