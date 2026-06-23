<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', children, ...rest }: { class?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<button data-slot="dropdown-menu-trigger" class={cn('', className)} {...rest}>
  {#if children}{@render children()}{/if}
</button>
