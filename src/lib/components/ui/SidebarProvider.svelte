<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';
  import { isMobile as mobileStore } from './use-mobile';

  let {
    class: className = '',
    defaultOpen = true,
    children,
    style,
    ...rest
  }: {
    class?: string;
    defaultOpen?: boolean;
    children?: Snippet;
    style?: string;
    [key: string]: any;
  } = $props();

  let open = $state(defaultOpen);
  let openMobile = $state(false);
  let mobile = $state(false);

  $effect(() => {
    const unsub = mobileStore.subscribe(v => mobile = v);
    return () => unsub();
  });

  function setOpen(v: boolean) { open = v; }
  function setOpenMobile(v: boolean) { openMobile = v; }
  function toggleSidebar() { if (mobile) { openMobile = !openMobile; } else { open = !open; } }

  const SIDEBAR_WIDTH = '16rem';
  const SIDEBAR_WIDTH_ICON = '3rem';
  let state = $derived(open ? 'expanded' : 'collapsed');
</script>

<div
  data-slot="sidebar-wrapper"
  data-state={state}
  style={`--sidebar-width: ${SIDEBAR_WIDTH}; --sidebar-width-icon: ${SIDEBAR_WIDTH_ICON}; ${style || ''}`}
  class={cn('group/sidebar-wrapper flex min-h-svh w-full', className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
</div>
