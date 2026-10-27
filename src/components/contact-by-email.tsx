import { useEffect, useRef } from "react";
import { ChevronDown, Copy, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { emailLinks, watchMailApp } from "@/lib/contact-email";

type Props = {
  to?: string | null;
  subject?: string;
  body?: string;
  label?: string;
  recipientName?: string | null;
};

export function ContactByEmail({
  to,
  subject = "",
  body = "",
  label = "Contact by email",
  recipientName,
}: Props) {
  const links = emailLinks(to, subject, body);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  async function copy(fallback = false) {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.email);
      toast.success(fallback ? "No mail app detected. Email copied to clipboard" : "Email copied");
    } catch {
      // Delayed clipboard writes can be denied in browsers/previews. Never claim a copy succeeded.
      toast.error("Couldn't copy email address", { description: `Copy manually: ${links.email}` });
    }
  }

  function openMailApp(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    cleanup.current?.();
    cleanup.current = watchMailApp(() => {
      void copy(true);
    });
    // The anchor performs navigation synchronously, without waiting for clipboard work.
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <p className="max-w-full break-words text-xs text-muted-foreground">
        {recipientName && (
          <span className="block font-medium text-foreground">{recipientName}</span>
        )}
        {links?.email ?? "No email on file"}
      </p>
      <div className="flex items-center gap-1">
        {links ? (
          <Button asChild variant="outline" size="sm">
            <a href={links.mailto} onClick={openMailApp}>
              <Mail />
              {label}
            </a>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-label="No email on file">
                <Button disabled variant="outline" size="sm">
                  <Mail />
                  {label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>No email on file</TooltipContent>
          </Tooltip>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!links}
              aria-label={`Email options for ${recipientName ?? links?.email ?? "recipient"}`}
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {links && (
              <>
                <DropdownMenuItem asChild>
                  <a href={links.gmail} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    Open in Gmail
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void copy();
                  }}
                >
                  <Copy />
                  Copy email address
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={links.mailto} onClick={openMailApp}>
                    <Mail />
                    Open in my mail app
                  </a>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
