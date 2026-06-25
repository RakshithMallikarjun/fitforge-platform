import { useState, type ChangeEvent } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteMembersBulk, type MemberInput } from "@/lib/members.functions";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const TEMPLATE = `name,email,phone,goals,experience_level,medical_history,membership_type,membership_expires_at
Jane Doe,jane@example.com,+15555550100,Build strength,beginner,None,Monthly,2026-12-31
`;

export function BulkImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<MemberInput[]>([]);
  const [filename, setFilename] = useState<string>("");

  const mut = useMutation({
    mutationFn: () => inviteMembersBulk({ data: { members: rows } }),
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      toast.success(`Imported ${ok} members`, { description: fail ? `${fail} failed — check console for details` : undefined });
      if (fail) console.warn("Bulk import failures", res.results.filter((r) => !r.ok));
      qc.invalidateQueries({ queryKey: ["members"] });
      setRows([]);
      setFilename("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Import failed", { description: e?.message }),
  });

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed: MemberInput[] = res.data
          .filter((r) => r.email && r.name)
          .map((r) => ({
            name: r.name?.trim(),
            email: r.email?.trim(),
            phone: r.phone?.trim() || null,
            goals: r.goals?.trim() || null,
            experience_level: (["beginner", "intermediate", "advanced"].includes((r.experience_level ?? "").toLowerCase())
              ? (r.experience_level!.toLowerCase() as any)
              : null),
            medical_history: r.medical_history?.trim() || null,
            membership_type: r.membership_type?.trim() || null,
            membership_expires_at: r.membership_expires_at?.trim() || null,
          }));
        setRows(parsed);
      },
    });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "members-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk import members</DialogTitle>
          <DialogDescription>Upload a CSV. Each row creates an account and sends an email invite.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="rounded-lg">
            <Download className="mr-2 h-4 w-4" /> Download CSV template
          </Button>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input bg-background px-6 py-10 text-sm text-muted-foreground hover:bg-muted">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="font-medium text-foreground">{filename || "Drop CSV here or click to browse"}</span>
            <span className="text-xs">{rows.length ? `${rows.length} valid rows ready` : "Required columns: name, email"}</span>
            <input type="file" accept=".csv" className="hidden" onChange={onFile} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!rows.length || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Invite {rows.length || ""} members
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
