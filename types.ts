export enum SalaryType {
  SINGLE = 'SINGLE',
  SPLIT = 'SPLIT',
}

export interface UserConfig {
  salaryType: SalaryType;
  grossIncome: number;
  totalIncome: number; // Net income
  valePercentage?: number; // 0-100
  valeDay?: number; // 1-31
  salaryDay?: number; // 1-31
  setupComplete: boolean;
  manualOverrides?: {
    valeAmount?: number;
    salaryAmount?: number;
    valeDay?: number;
    salaryDay?: number;
  };
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  dueDay: number; // 1-31 (Recurring monthly for simplicity in this MVP)
  isPaid: boolean;
  category?: string;
  manualSource?: 'VALE' | 'SALARY';
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO Date string
}

export interface CashFlowSource {
  name: string;
  amount: number;
  receiveDay: number;
  color: string;
  type: 'VALE' | 'SALARY';
}

export interface ExtraIncome {
  id: string;
  description: string;
  amount: number;
  receiveDay: number;
}

export interface MonthlyData {
  monthKey: string; // "YYYY-MM"
  extraIncomes: ExtraIncome[];
  // Future: realizedExpenses, notes, etc.
}

export interface MonthHistory {
    monthKey: string; // "YYYY-MM"
    totalIncome: number;
    totalExpenses: number;
    remaining: number;
    expensesSnapshot: Expense[]; // Snapshot of expenses as they were paying (including isPaid status)
    extraIncomesSnapshot: ExtraIncome[];
}