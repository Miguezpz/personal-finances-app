"use client";

/**
 * "Retry" after a failed save (spec 009, FR-008, research.md R2): the error toast reopens the same
 * dialog with what the owner had typed. The draft lives only in this toast's closure — it's never
 * stored. The read-only demo and "offline" already have their own global toast, so they're skipped.
 */
import { toast } from "sonner";
import { isNotifiedGlobally } from "@/data/errors";
import { openCreate, type CreateDialog } from "@/store/ui";

export function notifySaveFailed(
  error: unknown,
  dialog: CreateDialog,
  messages: { failed: string; retry: string },
): void {
  if (isNotifiedGlobally(error)) return;
  toast.error(messages.failed, {
    duration: 10_000,
    action: { label: messages.retry, onClick: () => openCreate(dialog) },
  });
}
