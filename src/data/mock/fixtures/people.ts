/** Fictitious debtors for the demo (T039). */
import type { Debtor } from "@/domain/types";
import { demoId } from "./catalog";

export const DEBTOR_IDS = {
  ana: demoId(0x4001),
  carlos: demoId(0x4002),
} as const;

export const DEBTORS: readonly Debtor[] = [
  { id: DEBTOR_IDS.ana, name: "Ana" },
  { id: DEBTOR_IDS.carlos, name: "Carlos" },
];
