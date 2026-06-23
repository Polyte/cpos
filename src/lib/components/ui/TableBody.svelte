<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<tbody data-slot="table-body" class={cn('[&_tr:last-child]:border-0', className)} {...rest}>
  {#if children}{@render children()}{/if}
</tbody>
