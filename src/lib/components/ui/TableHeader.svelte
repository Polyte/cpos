<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<thead data-slot="table-header" class={cn('[&_tr]:border-b', className)} {...rest}>
  {#if children}{@render children()}{/if}
</thead>
