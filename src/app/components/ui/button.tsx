/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[0.75rem] font-bold uppercase tracking-[0.2em] transition-transform duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring border-none hover:-translate-y-[2px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-background hover:bg-[#222]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-background text-foreground hover:bg-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent text-primary hover:bg-card border-none hover:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline font-bold",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90",
      },
      size: {
        default: "h-[50px] px-5 py-[20px]",
        sm: "h-9 px-4 text-[0.65rem]",
        lg: "h-14 px-10 text-sm",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
