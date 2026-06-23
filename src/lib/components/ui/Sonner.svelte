<script lang="ts">
  import { Toaster as SonnerToaster } from 'svelte-sonner';

  let { ...rest }: { [key: string]: any } = $props();
</script>

<SonnerToaster
  position="top-right"
  class="toaster group"
  {...rest}
/>
