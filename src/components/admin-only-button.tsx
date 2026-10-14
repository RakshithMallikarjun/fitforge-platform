import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Renders a normal button for admins; for trainers the same control shows
 * disabled with an "Admins only" tooltip instead of disappearing silently.
 */
export function AdminOnlyButton({
  isAdmin,
  children,
  ...props
}: ComponentProps<typeof Button> & { isAdmin: boolean }) {
  if (isAdmin) return <Button {...props}>{children}</Button>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons don't receive focus/hover, so the wrapper carries the tooltip. */}
        <span tabIndex={0} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Button {...props} onClick={undefined} disabled aria-disabled="true">
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Admins only</TooltipContent>
    </Tooltip>
  );
}
