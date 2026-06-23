<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', children, ...rest }: { class?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<tr data-slot="table-row" class={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...rest}>
  {#if children}{@render children()}{/if}
</tr>
