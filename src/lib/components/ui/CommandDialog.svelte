<script lang="ts">
  import type { Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  import DialogHeader from './DialogHeader.svelte';
  import DialogTitle from './DialogTitle.svelte';
  import DialogDescription from './DialogDescription.svelte';
  import DialogContent from './DialogContent.svelte';
  import Command from './Command.svelte';

  let {
    open = false,
    onclose,
    title = 'Command Palette',
    description = 'Search for a command to run...',
    children,
    ...rest
  }: {
    open?: boolean;
    onclose?: () => void;
    title?: string;
    description?: string;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<Dialog {open} {onclose} {...rest}>
  <DialogHeader class="sr-only">
    <DialogTitle>{title}</DialogTitle>
    <DialogDescription>{description}</DialogDescription>
  </DialogHeader>
  <div class="overflow-hidden p-0">
    <Command class="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
      {#if children}{@render children()}{/if}
    </Command>
  </div>
</Dialog>
