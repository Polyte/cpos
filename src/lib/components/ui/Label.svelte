<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', for: forAttr, children, ...rest }: { class?: string; for?: string; children?: import('svelte').Snippet; [key: string]: any } = $props();
</script>

<label
  data-slot="label"
  for={forAttr}
  class={cn('flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
</label>
