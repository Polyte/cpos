<script lang="ts">
  import { cn } from './utils';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    containerClassName = '',
    length = 6,
    value = '',
    onchange,
    children,
    ...rest
  }: {
    class?: string;
    containerClassName?: string;
    length?: number;
    value?: string;
    onchange?: (e: Event) => void;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  let inputRefs: HTMLInputElement[] = [];
  let otpValues = $state(value.padEnd(length, '').slice(0, length).split(''));

  function handleInput(e: Event & { currentTarget: HTMLInputElement }, index: number) {
    const val = e.currentTarget.value.replace(/\D/g, '');
    if (val) {
      otpValues[index] = val.slice(-1);
      if (index < length - 1) {
        inputRefs[index + 1]?.focus();
      }
    }
    updateValue();
  }

  function handleKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpValues[index] = '';
      inputRefs[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) inputRefs[index + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent) {
    const data = e.clipboardData?.getData('text') || '';
    const digits = data.replace(/\D/g, '').slice(0, length);
    digits.split('').forEach((char, i) => { otpValues[i] = char; });
    updateValue();
  }

  function updateValue() {
    value = otpValues.join('');
    const event = new Event('change', { bubbles: true });
    inputRefs[0]?.dispatchEvent(event);
  }
</script>

<div data-slot="input-otp" class={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)} {...rest}>
  <div data-slot="input-otp-group" class={cn('flex items-center gap-1', className)}>
    {#each Array(length) as _, i}
      <input
        type="text"
        inputmode="numeric"
        maxlength="1"
        value={otpValues[i] || ''}
        bind:this={inputRefs[i]}
        oninput={(e) => handleInput(e, i)}
        onkeydown={(e) => handleKeyDown(e, i)}
        onpaste={handlePaste}
        data-slot="input-otp-slot"
        data-active={document.activeElement === inputRefs[i]}
        class={cn(
          'data-[active=true]:border-ring data-[active=true]:ring-ring/50 dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm bg-input-background transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px] text-center',
          'aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive'
        )}
      />
    {/each}
  </div>
  {#if children}{@render children()}{/if}
</div>
