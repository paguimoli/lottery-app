import type { LedgerTransaction } from "./ledger.types";

export function getAccountingTransactionImpact(
  transaction: LedgerTransaction,
  transactions: LedgerTransaction[] = []
): number {
  if (transaction.transactionType === "reversal") {
    const parentTransaction = transactions.find(
      (createdTransaction) => createdTransaction.id === transaction.parentTransactionId
    );

    return parentTransaction
      ? -getAccountingTransactionImpact(parentTransaction, transactions)
      : 0;
  }

  if (
    [
      "deposit",
      "zero_balance_credit",
      "transfer_in",
      "manual_adjustment",
    ].includes(transaction.transactionType)
  ) {
    return transaction.amount;
  }

  if (
    ["withdrawal", "zero_balance_debit", "transfer_out"].includes(
      transaction.transactionType
    )
  ) {
    return -transaction.amount;
  }

  return 0;
}

export function getOperationalTransactionImpact(
  transaction: LedgerTransaction,
  transactions: LedgerTransaction[] = []
): number {
  if (transaction.transactionType === "reversal") {
    const parentTransaction = transactions.find(
      (createdTransaction) => createdTransaction.id === transaction.parentTransactionId
    );

    return parentTransaction
      ? -getOperationalTransactionImpact(parentTransaction, transactions)
      : 0;
  }

  if (["win", "loss"].includes(transaction.transactionType)) {
    return transaction.transactionType === "win"
      ? transaction.amount
      : -transaction.amount;
  }

  if (
    [
      "bet_stake",
      "bet_win",
      "freeplay_win",
      "credit_adjustment",
      "settlement_reversal",
    ].includes(transaction.transactionType)
  ) {
    return transaction.amount;
  }

  if (transaction.transactionType === "debit_adjustment") {
    return transaction.amount < 0 ? transaction.amount : -transaction.amount;
  }

  return 0;
}

export function getFreeplayTransactionImpact(
  transaction: LedgerTransaction,
  transactions: LedgerTransaction[] = []
): number {
  if (transaction.transactionType === "reversal") {
    const parentTransaction = transactions.find(
      (createdTransaction) => createdTransaction.id === transaction.parentTransactionId
    );

    return parentTransaction
      ? -getFreeplayTransactionImpact(parentTransaction, transactions)
      : 0;
  }

  if (
    ["freeplay_grant", "freeplay_adjustment", "freeplay_reversal"].includes(
      transaction.transactionType
    )
  ) {
    return transaction.amount;
  }

  if (
    ["freeplay_wager", "freeplay_expiration"].includes(
      transaction.transactionType
    )
  ) {
    return -transaction.amount;
  }

  return 0;
}
