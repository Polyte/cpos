<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
  <table data-slot="table" class={cn('w-full caption-bottom text-sm', className)} {...rest}>
    {#if children}{@render children()}{/if}
  </table>
</div>
