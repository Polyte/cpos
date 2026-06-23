<script lang="ts">
  import { cn } from './utils';

  let { class: className = '', value = 0, min = 0, max = 100, step = 1, oninput, disabled = false, ...rest }: { class?: string; value?: number; min?: number; max?: number; step?: number; oninput?: (e: Event) => void; disabled?: boolean; [key: string]: any } = $props();
</script>

<div data-slot="slider" class={cn('relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50', className)} data-disabled={disabled || undefined} {...rest}>
  <input
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    {oninput}
    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
  />
  <div data-slot="slider-track" class="bg-muted relative grow overflow-hidden rounded-full h-1.5 w-full">
    <div data-slot="slider-range" class="bg-primary absolute h-full" style={`width: ${((value - min) / (max - min)) * 100}%`} />
  </div>
  <div data-slot="slider-thumb" class="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden pointer-events-none ml-auto"
    style={`margin-left: ${((value - min) / (max - min)) * 100}%`}
  />
</div>
