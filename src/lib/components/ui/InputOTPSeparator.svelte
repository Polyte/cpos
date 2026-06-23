<script lang="ts">
  import { MinusIcon } from 'lucide-svelte';

  let { ...rest }: { [key: string]: any } = $props();
</script>

<div data-slot="input-otp-separator" role="separator" {...rest}>
  <MinusIcon class="size-4" />
</div>
