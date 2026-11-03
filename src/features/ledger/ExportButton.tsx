"use client";

/**
 * "Export data" (T126, FR-043, Principle I): built in the browser from the cached snapshot — no
 * second download, no server. Two formats:
 *  - the ledger as CSV (the given entries, e.g. the filtered view; the whole ledger by default);
 *  - the full backup: one CSV per entity plus the ledger, in a ZIP.
 * Reading data is allowed in the demo too.
 */
import { Download, FileArchive, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { ledgerToCsv, snapshotToCsvBundle } from "@/domain/csv";
import { buildLedger } from "@/domain/ledger";
import type { LedgerEntry } from "@/domain/types";
import { downloadBlob } from "@/lib/download";
import { useToday } from "@/lib/use-today";
import { createZip } from "@/lib/zip";
import { useCsvNames } from "./hooks";

interface Props {
  /** Entries for the ledger CSV; defaults to the whole ledger. */
  entries?: readonly LedgerEntry[];
}

export function ExportButton({ entries }: Props) {
  const t = useTranslations("ledger");
  const { data: snapshot } = useFinanceSnapshot();
  const names = useCsvNames();
  const today = useToday();

  function exportLedger() {
    if (!snapshot) return;
    const csv = ledgerToCsv(entries ?? buildLedger(snapshot), names);
    downloadBlob(`ledger-${today}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    toast.success(t("exported"));
  }

  function exportBackup() {
    if (!snapshot) return;
    const zip = createZip(snapshotToCsvBundle(snapshot, names), new Date());
    downloadBlob(
      `personal-finances-${today}.zip`,
      new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
    );
    toast.success(t("exported"));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!snapshot} data-testid="export-data">
          <Download aria-hidden="true" />
          {t("export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={exportLedger} data-testid="export-ledger-csv">
          <FileSpreadsheet aria-hidden="true" />
          {entries ? t("exportFilteredCsv") : t("exportLedgerCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportBackup} data-testid="export-backup-zip">
          <FileArchive aria-hidden="true" />
          {t("exportBackupZip")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
