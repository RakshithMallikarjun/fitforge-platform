import { scorePassword } from "@/lib/auth-errors";

const BAR = ["bg-muted", "bg-destructive", "bg-secondary", "bg-secondary", "bg-primary"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, hints } = scorePassword(password);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? BAR[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        {hints.length > 0 && <> · {hints.join(" · ")}</>}
      </p>
    </div>
  );
}
