"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-1",
        month: "flex flex-col gap-2",
        caption: "flex justify-center pt-0.5 pb-1 relative items-center w-full",
        caption_label: "text-xs font-bold text-foreground",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-6 bg-transparent p-0 opacity-60 hover:opacity-100 rounded-md border border-border/60",
        ),
        nav_button_previous: "absolute left-0.5",
        nav_button_next: "absolute right-0.5",
        table: "w-full border-collapse space-y-0.5",
        head_row: "flex justify-between w-full",
        head_cell:
          "text-muted-foreground rounded-md w-7 text-[0.7rem] font-semibold text-center py-0.5",
        row: "flex w-full mt-1 justify-between",
        cell: cn(
          "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent/10 rounded-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 p-0 font-normal text-xs rounded-md aria-selected:opacity-100 hover:bg-accent/20",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold shadow-xs",
        day_today: "bg-accent/30 text-accent-foreground font-bold underline underline-offset-2",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-40",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-3.5", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-3.5", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
