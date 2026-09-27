import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Download } from "lucide-react";
import { formatServerError } from "@/lib/format-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkImportEmails,
  inviteMembersBulk,
  type BulkRowResult,
  type MemberInput,
} from "@/lib/members.functions";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const TEMPLATE = `name,email,phone,goals,experience_level,medical_history,membership_type,membership_expires_at
Jane Doe,jane@example.com,+15555550100,Build strength,beginner,None,Monthly,2026-12-31
`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RowStatus =
  | "Will invite"
  | "Already a member — will be skipped"
  | "Registered with another gym"
  | "Duplicate in this file"
  | "Invalid email"
  | "Name missing";

type PreviewRow = { row: number; member: MemberInput; raw: Record<string, string>; status: RowStatus };

function toMember(r: Record<string, string>): MemberInput {
  const lvl = (r.experience_level ?? "").trim().toLowerCase();
  return {
    name: (r.name ?? "").trim(),
    email: (r.email ?? "").trim().toLowerCase(),
    phone: r.phone?.trim() || null,
    goals: r.goals?.trim() || null,
    experience_level: ["beginner", "intermediate", "advanced"].includes(lvl) ? (lvl as any) : null,
    medical_history: r.medical_history?.trim() || null,
    membership_type: r.membership_type?.trim() || null,
    membership_expires_at: r.membership_expires_at?.trim() || null,
  };
}

function downloadCsv(name: string, rows: Record<string, string>[]) {
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [filename, setFilename] = useState("");
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<BulkRowResult[] | null>(null);

  const good = preview.filter((p) => p.status === "Will invite");

  const mut = useMutation({
    mutationFn: () =>
      inviteMembersBulk({
        data: { members: good.map((p) => ({ row: p.row, member: p.member as any })) },
      }),
    onSuccess: (res) => {
      // Rows the preview already excluded are reported alongside the server results.
      const pre: BulkRowResult[] = preview
        .filter((p) => p.status !== "Will invite")
        .map((p) => ({
          row: p.row,
          email: p.member.email,
          name: p.member.name,
          status:
            p.status.startsWith("Already") || p.status === "Duplicate in this file"
              ? "skipped"
              : "failed",
          reason: p.status.replace(" — will be skipped", ""),
        }));
      setResults([...pre, ...res.results].sort((a, b) => a.row - b.row));
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: unknown) => toast.error("Import failed", { description: formatServerError(e) }),
  });

  function reset() {
    setPreview([]);
    setFilename("");
    setResults(null);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFilename(file.name);
    setResults(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const seen = new Set<string>();
        const rows: PreviewRow[] = res.data.map((raw, i) => {
          const member = toMember(raw);
          let status: RowStatus = "Will invite";
          if (!member.name) status = "Name missing";
          else if (!EMAIL_RE.test(member.email)) status = "Invalid email";
          else if (seen.has(member.email)) status = "Duplicate in this file";
          seen.add(member.email);
          // Row 1 is the header, so data starts at row 2.
          return { row: i + 2, member, raw, status };
        });
        setChecking(true);
        try {
          const emails = rows.filter((r) => r.status === "Will invite").map((r) => r.member.email);
          const { thisGym, otherGym } = await checkImportEmails({ data: { emails } });
          const a = new Set(thisGym.map((x) => x.toLowerCase()));
          const b = new Set(otherGym.map((x) => x.toLowerCase()));
          for (const r of rows) {
            if (r.status !== "Will invite") continue;
            if (a.has(r.member.email)) r.status = "Already a member — will be skipped";
            else if (b.has(r.member.email)) r.status = "Registered with another gym";
          }
        } catch (err) {
          toast.error("Couldn't check existing members", {
            description: formatServerError(err),
          });
        } finally {
          setChecking(false);
        }
        setPreview(rows);
      },
    });
  }

  const counts = results && {
    invited: results.filter((r) => r.status === "invited").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{results ? "Import results" : "Bulk import members"}</DialogTitle>
          <DialogDescription>
            {results
              ? `${counts!.invited} invited · ${counts!.skipped} skipped (already members or duplicates) · ${counts!.failed.length} failed`
              : "Upload a CSV. New people get an email invite; existing members are never changed."}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            {counts!.failed.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {counts!.failed.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="text-sm">{r.email || "—"}</TableCell>
                        <TableCell className="text-sm">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const byRow = new Map(preview.map((p) => [p.row, p.raw]));
                    downloadCsv(
                      "failed-rows.csv",
                      counts!.failed.map((f) => ({
                        row: String(f.row),
                        ...(byRow.get(f.row) ?? { email: f.email, name: f.name }),
                        reason: f.reason ?? "",
                      })),
                    );
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download failed rows as CSV
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv("members-template.csv", Papa.parse<Record<string, string>>(TEMPLATE, { header: true, skipEmptyLines: true }).data)}
              className="rounded-lg"
            >
              <Download className="mr-2 h-4 w-4" /> Download CSV template
            </Button>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-background px-6 py-8 text-sm text-muted-foreground hover:bg-muted">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">
                {filename || "Drop CSV here or click to browse"}
              </span>
              <span className="text-xs">
                {checking
                  ? "Checking rows…"
                  : preview.length
                    ? `${good.length} of ${preview.length} rows will be invited`
                    : "Required columns: name, email"}
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={onFile} />
            </label>

            {preview.length > 0 && !checking && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p) => (
                    <TableRow key={p.row}>
                      <TableCell>{p.row}</TableCell>
                      <TableCell className="text-sm">{p.member.name || "—"}</TableCell>
                      <TableCell className="text-sm">{p.member.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "Will invite" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mut.mutate()}
                disabled={!good.length || checking || mut.isPending}
              >
                {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite {good.length} new member{good.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
