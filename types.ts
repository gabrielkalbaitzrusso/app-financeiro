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
  type?: 'FIXED' | 'VARIABLE';
  createdAt?: string; // ISO Date for Variable expenses
  exclusions?: string[]; // List of YYYY-MM where this recurring expense is excluded
  endDate?: string; // YYYY-MM Last valid month for this expense
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

export interface Debt {
    id: string;
    description: string;
    totalAmount: number;
    remainingAmount: number;
    interestRate: number; // Monthly %
    dueDate: number; // Day of month
    minPayment?: number;
}