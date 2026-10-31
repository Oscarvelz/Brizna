import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-[transform,background-color,box-shadow,opacity,color] duration-150 ease-out select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-card hover:bg-primary-hover",
        secondary: "bg-surface-2 text-fg hover:bg-border",
        outline: "bg-surface text-fg shadow-card hover:shadow-card-hover",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "bg-late text-primary-fg hover:opacity-90",
        money: "bg-money text-primary-fg hover:opacity-90",
      },
      size: {
        sm: "h-10 px-3 rounded-sm text-sm",
        md: "h-12 px-4 rounded-sm text-base",
        lg: "h-14 px-5 rounded-md text-base",
        icon: "size-12 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), "active:not-disabled:scale-[0.96]", className)}
      {...props}
    />
  );
}
