<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<th data-slot="table-head" class={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...rest}>
  {#if children}{@render children()}{/if}
</th>
