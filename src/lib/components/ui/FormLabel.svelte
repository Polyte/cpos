<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import Label from './Label.svelte';

  let { class: className = '', for: forAttr, error = false, children, ...rest }: { class?: string; for?: string; error?: boolean; children?: Snippet; [key: string]: any } = $props();
</script>

<Label data-slot="form-label" data-error={error || undefined} {for: forAttr} class={cn('data-[error]:text-destructive', className)} {...rest}>
  {#if children}{@render children()}{/if}
</Label>
