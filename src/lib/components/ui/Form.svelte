<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, ...rest }: { children?: Snippet; [key: string]: any } = $props();
</script>

<form data-slot="form" {...rest}>
  {#if children}{@render children()}{/if}
</form>
