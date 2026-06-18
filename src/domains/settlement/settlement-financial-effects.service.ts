import {
  postLedgerEntry,
  type CreateLedgerEntryInput,
  type LedgerEntry,
} from "../ledger/ledger.entrypoints";
import type { SettlementRecord } from "./settlement.types";

export type SettlementLedgerEffectCommand = CreateLedgerEntryInput;

export type SettlementLedgerEffectResult = {
  settlementRecords: SettlementRecord[];
  ledgerEntries: LedgerEntry[];
  legacyLedgerTransactions: never[];
};

export async function applySettlementLedgerEffects({
  settlementRecords,
  ledgerEntryCommands = [],
}: {
  settlementRecords: SettlementRecord[];
  ledgerEntryCommands?: SettlementLedgerEffectCommand[];
}): Promise<SettlementLedgerEffectResult> {
  const ledgerEntries: LedgerEntry[] = [];

  for (const command of ledgerEntryCommands) {
    ledgerEntries.push(await postLedgerEntry(command));
  }

  return {
    settlementRecords,
    ledgerEntries,
    legacyLedgerTransactions: [],
  };
}
