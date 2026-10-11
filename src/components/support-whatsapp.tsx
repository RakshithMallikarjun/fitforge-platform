import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSupportWhatsapp, supportWhatsappUrl } from "@/lib/platform-brand";

/** Link to Fit Foundry's own support (never a gym's). */
export function SupportWhatsappLink({
  text,
  label,
  className,
}: {
  text?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={supportWhatsappUrl(text)}
      target="_blank"
      rel="noreferrer"
      className={className ?? "font-medium text-primary hover:underline"}
    >
      {label ?? `WhatsApp ${formatSupportWhatsapp()}`}
    </a>
  );
}

export function SupportWhatsappButton({ text, label }: { text?: string; label?: string }) {
  return (
    <Button asChild size="sm" variant="outline" className="gap-1.5">
      <a href={supportWhatsappUrl(text)} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4" /> {label ?? "WhatsApp Fit Foundry support"}
      </a>
    </Button>
  );
}
