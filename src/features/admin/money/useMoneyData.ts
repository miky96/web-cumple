import { useEffect, useMemo, useState } from 'react';
import type { Repo } from '../../../data/repo';
import { DEFAULT_PRICING } from '../../../domain/money/defaults';
import { computeMoney } from '../../../domain/money/engine';
import type { Adjustment, BudgetLine, Expense, MoneySummary, Payment, Pricing } from '../../../domain/money/types';
import type { Participant } from '../../../domain/types';

export interface MoneyData {
  ready: boolean;
  lines: BudgetLine[];
  expenses: Expense[];
  payments: Payment[];
  adjustments: Adjustment[];
  pricing: Pricing;
  summary: MoneySummary;
}

const byDateDesc = <T extends { date: string; id: string }>(a: T, b: T) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

export function useMoneyData(repo: Repo, editionId: string, participants: Participant[]): MoneyData {
  const [lines, setLines] = useState<BudgetLine[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[] | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    const unsubs = [
      repo.watchMoney(editionId, 'budgetLines', (ls) => setLines([...ls].sort((a, b) => a.order - b.order))),
      repo.watchMoney(editionId, 'expenses', (es) => setExpenses([...es].sort(byDateDesc))),
      repo.watchMoney(editionId, 'payments', (ps) => setPayments([...ps].sort(byDateDesc))),
      repo.watchMoney(editionId, 'adjustments', setAdjustments),
      repo.watchPricing(editionId, setPricing),
    ];
    return () => unsubs.forEach((u) => u());
  }, [repo, editionId]);

  const summary = useMemo(
    () =>
      computeMoney({
        people: participants,
        lines: lines ?? [],
        expenses: expenses ?? [],
        payments: payments ?? [],
        adjustments: adjustments ?? [],
        pricing: pricing ?? DEFAULT_PRICING,
      }),
    [participants, lines, expenses, payments, adjustments, pricing],
  );

  return {
    ready: lines !== null && expenses !== null && payments !== null && adjustments !== null && pricing !== null,
    lines: lines ?? [],
    expenses: expenses ?? [],
    payments: payments ?? [],
    adjustments: adjustments ?? [],
    pricing: pricing ?? DEFAULT_PRICING,
    summary,
  };
}
