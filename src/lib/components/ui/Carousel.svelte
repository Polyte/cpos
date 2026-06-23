<script lang="ts">
  import { cn } from './utils';
  import { ArrowLeft, ArrowRight } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    orientation = 'horizontal' as 'horizontal' | 'vertical',
    children,
    ...rest
  }: {
    class?: string;
    orientation?: 'horizontal' | 'vertical';
    children?: Snippet;
    [key: string]: any;
  } = $props();

  let scrollRef: HTMLDivElement | undefined = $state(undefined);
  let canScrollPrev = $state(false);
  let canScrollNext = $state(false);

  function updateScrollState() {
    if (!scrollRef) return;
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = scrollRef;
    if (orientation === 'horizontal') {
      canScrollPrev = scrollLeft > 0;
      canScrollNext = scrollLeft + clientWidth < scrollWidth - 1;
    } else {
      canScrollPrev = scrollTop > 0;
      canScrollNext = scrollTop + clientHeight < scrollHeight - 1;
    }
  }

  function scrollPrev() {
    if (!scrollRef) return;
    const amount = orientation === 'horizontal' ? -scrollRef.clientWidth : -scrollRef.clientHeight;
    scrollRef.scrollBy({ left: orientation === 'horizontal' ? amount : 0, top: orientation === 'vertical' ? amount : 0, behavior: 'smooth' });
  }

  function scrollNext() {
    if (!scrollRef) return;
    const amount = orientation === 'horizontal' ? scrollRef.clientWidth : scrollRef.clientHeight;
    scrollRef.scrollBy({ left: orientation === 'horizontal' ? amount : 0, top: orientation === 'vertical' ? amount : 0, behavior: 'smooth' });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollNext(); }
  }
</script>

<div data-slot="carousel" class={cn('relative', className)} role="region" aria-roledescription="carousel" onkeydown={handleKeyDown} {...rest}>
  {#if children}{@render children()}{/if}
</div>
