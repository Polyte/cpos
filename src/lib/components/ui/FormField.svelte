<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, ...rest }: { children?: Snippet; name?: string; [key: string]: any } = $props();
</script>

<div data-slot="form-field" {...rest}>
  {#if children}{@render children()}{/if}
</div>
