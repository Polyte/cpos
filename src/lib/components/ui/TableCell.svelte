<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<td data-slot="table-cell" class={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...rest}>
  {#if children}{@render children()}{/if}
</td>
