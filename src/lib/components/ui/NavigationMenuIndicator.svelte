<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', ...rest }: { class?: string; [key: string]: any } = $props();
</script>

<div data-slot="navigation-menu-indicator" class={cn('top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden', className)} {...rest}>
  <div class="bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm shadow-md" />
</div>
