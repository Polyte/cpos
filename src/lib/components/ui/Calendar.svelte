<script lang="ts">
  import { cn } from './utils';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  import { dateLib } from './utils';

  let {
    class: className = '',
    month = new Date(),
    selected,
    onselect,
    min,
    max,
    ...rest
  }: {
    class?: string;
    month?: Date;
    selected?: Date;
    onselect?: (d: Date) => void;
    min?: Date;
    max?: Date;
    [key: string]: any;
  } = $props();

  let viewMonth = $state(new Date(month.getFullYear(), month.getMonth()));

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let weeks = $derived(() => {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const weeks: Date[][] = [];
    let current: Date[] = [];
    const d = new Date(startDate);
    while (d <= lastDay || d.getDay() !== 0) {
      current.push(new Date(d));
      if (current.length === 7) {
        weeks.push(current);
        current = [];
      }
      d.setDate(d.getDate() + 1);
    }
    if (current.length > 0) weeks.push(current);
    return weeks;
  });

  function prevMonth() { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1); }
  function nextMonth() { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1); }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isToday(d: Date) {
    return isSameDay(d, new Date());
  }

  function isSelected(d: Date) {
    return selected ? isSameDay(d, selected) : false;
  }

  function isCurrentMonth(d: Date) {
    return d.getMonth() === viewMonth.getMonth() && d.getFullYear() === viewMonth.getFullYear();
  }

  function isDisabled(d: Date) {
    if (min && d < min) return true;
    if (max && d > max) return true;
    return false;
  }
</script>

<div data-slot="calendar" class={cn('p-3', className)} {...rest}>
  <div class="flex justify-center pt-1 relative items-center w-full">
    <button type="button" onclick={prevMonth} class="absolute left-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent size-7 p-0 opacity-50 hover:opacity-100">
      <ChevronLeft class="size-4" />
    </button>
    <div class="text-sm font-medium">{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
    <button type="button" onclick={nextMonth} class="absolute right-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent size-7 p-0 opacity-50 hover:opacity-100">
      <ChevronRight class="size-4" />
    </button>
  </div>
  <table class="w-full border-collapse mt-4">
    <thead>
      <tr class="flex">
        {#each weekdays as wd}
          <th class="text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]">{wd}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each weeks() as week}
        <tr class="flex w-full mt-2">
          {#each week as day}
            <td class="relative p-0 text-center text-sm focus-within:relative focus-within:z-20">
              <button
                type="button"
                disabled={isDisabled(day)}
                onclick={() => onselect?.(day)}
                class={cn(
                  'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground size-8 p-0 font-normal aria-selected:opacity-100',
                  !isCurrentMonth(day) && 'text-muted-foreground opacity-50',
                  isToday(day) && 'bg-accent text-accent-foreground',
                  isSelected(day) && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )}
                aria-selected={isSelected(day)}
              >
                {day.getDate()}
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
