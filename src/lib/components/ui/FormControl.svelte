<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, ...rest }: { children?: Snippet; [key: string]: any } = $props();
</script>

<div data-slot="form-control" {...rest}>
  {#if children}{@render children()}{/if}
</div>
