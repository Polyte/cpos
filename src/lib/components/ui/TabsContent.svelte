<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let { class: className = '', value = '', active = false, children, ...rest }: { class?: string; value?: string; active?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

<div role="tabpanel" data-slot="tabs-content" data-state={active ? 'active' : 'inactive'} class={cn('flex-1 outline-none', className)} {...rest}>
  {#if children && active}{@render children()}{/if}
</div>
