import { UserConfig, Expense, Goal, CashFlowSource, SalaryType, MonthlyData } from '../types';

const STORAGE_KEYS = {
  CONFIG: 'flowcash_config',
  EXPENSES: 'flowcash_expenses',
  GOALS: 'flowcash_goals',
};

// --- Storage Helpers ---

export const getStoredConfig = (): UserConfig | null => {
  const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
  return data ? JSON.parse(data) : null;
};

export const saveConfig = (config: UserConfig): void => {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
};

export const getStoredExpenses = (): Expense[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
  return data ? JSON.parse(data) : [];
};

export const saveExpenses = (expenses: Expense[]): void => {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
};

export const getStoredGoals = (): Goal[] => {
  const data = localStorage.getItem(STORAGE_KEYS.GOALS);
  return data ? JSON.parse(data) : [];
};

export const saveGoals = (goals: Goal[]): void => {
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
};

// --- Calculation Logic ---

export const calculateIncomeParts = (config: UserConfig): CashFlowSource[] => {
  const overrides = config.manualOverrides || {};

  if (config.salaryType === SalaryType.SINGLE) {
    return [{
      name: 'Salário Completo',
      amount: overrides.salaryAmount ?? config.totalIncome,
      receiveDay: overrides.salaryDay ?? (config.salaryDay || 1),
      color: 'bg-green-500',
      type: 'SALARY'
    }];
  }

  // Split Salary (Vale)
  // If manual override exists for Vale, use it. Else calculate pct.
  const valeAmount = overrides.valeAmount ?? (config.totalIncome * ((config.valePercentage || 40) / 100));
  
  // Salary is Total - Vale (unless Salary is also overridden manually, which we allow for total flexibility)
  // If user manually set Both, Total derived from Setup might mismatch sum, but we trust the parts for display.
  // Actually, let's treat "Restante" as remainder normally, unless overridden.
  let remainderAmount = config.totalIncome - valeAmount;
  
  if (overrides.salaryAmount !== undefined) {
    remainderAmount = overrides.salaryAmount;
  }

  return [
    {
      name: 'Vale (Adiantamento)',
      amount: valeAmount,
      receiveDay: overrides.valeDay ?? (config.valeDay || 15),
      color: 'bg-amber-500',
      type: 'VALE'
    },
    {
      name: 'Restante Salário',
      amount: remainderAmount,
      receiveDay: overrides.salaryDay ?? (config.salaryDay || 5),
      color: 'bg-green-500',
      type: 'SALARY'
    }
  ];
};

/**
 * Determines which income source covers an expense based on days.
 * 
 * Logic:
 * If we have a Vale on day V and Salary on day S.
 * Interval 1 (Vale Window): From V to S.
 * Interval 2 (Salary Window): From S to V.
 */
export const determineSourceForExpense = (expenseDay: number, config: UserConfig, expense?: Expense, mode: 'PROJECTED' | 'REALIZED' = 'REALIZED'): 'VALE' | 'SALARY' => {
  if (mode === 'REALIZED' && expense?.manualSource) return expense.manualSource;
  if (config.salaryType === SalaryType.SINGLE) return 'SALARY';

  const vDay = config.valeDay || 15;
  const sDay = config.salaryDay || 5;

  // Case 1: Normal crossover (e.g., Vale 15th, Salary 5th of next month)
  // Vale covers: 15, 16 ... 30, 1, 2, 3, 4.
  if (vDay > sDay) {
    if (expenseDay >= vDay || expenseDay < sDay) {
      return 'VALE';
    } else {
      return 'SALARY';
    }
  } 
  // Case 2: Same month split (e.g., Salary 1st, Vale 15th - rare but possible config)
  else {
    if (expenseDay >= vDay && expenseDay < sDay) {
      return 'VALE'; 
    }
    return 'SALARY';
  }
};

// Update calculateBudgetHealth signature
export const calculateBudgetHealth = (config: UserConfig, expenses: Expense[], mode: 'PROJECTED' | 'REALIZED' = 'REALIZED') => {
  const sources = calculateIncomeParts(config);
  const totalIncome = config.totalIncome;
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const remaining = totalIncome - totalExpenses;

  // Split calculations
  let valeTotal = 0;
  let salaryTotal = 0;
  
  if (config.salaryType === SalaryType.SPLIT) {
    expenses.forEach(exp => {
      const source = determineSourceForExpense(exp.dueDay, config, exp, mode);
      if (source === 'VALE') valeTotal += exp.amount;
      else salaryTotal += exp.amount;
    });
  }

  const valeSource = sources.find(s => s.type === 'VALE');
  const salarySource = sources.find(s => s.type === 'SALARY');

  const valeFree = valeSource ? valeSource.amount - valeTotal : 0;
  const salaryFree = salarySource ? salarySource.amount - salaryTotal : totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    remaining,
    breakdown: {
      valeUsed: valeTotal,
      valeFree: valeFree,
      salaryUsed: salaryTotal,
      salaryFree: salaryFree
    }
  };
};

// --- Salary Calculation (INSS + IRRF 2024 Estimate) ---

// --- Salary Calculation (INSS 2025 + IRRF 2026 Rules) ---

export const calculateNetSalary = (gross: number): number => {
  let inss = 0;
  
  // INSS 2025 (Teto 8157.41)
  // Faixas: 1518.00 | 2793.88 | 4190.83 | 8157.41
  if (gross <= 1518.00) {
    inss = gross * 0.075;
  } else if (gross <= 2793.88) {
    inss = (1518.00 * 0.075) + ((gross - 1518.00) * 0.09);
  } else if (gross <= 4190.83) {
    inss = (1518.00 * 0.075) + ((2793.88 - 1518.00) * 0.09) + ((gross - 2793.88) * 0.12);
  } else if (gross <= 8157.41) {
    inss = (1518.00 * 0.075) + ((2793.88 - 1518.00) * 0.09) + ((4190.83 - 2793.88) * 0.12) + ((gross - 4190.83) * 0.14);
  } else {
    // Teto Máximo
    inss = (1518.00 * 0.075) + ((2793.88 - 1518.00) * 0.09) + ((4190.83 - 2793.88) * 0.12) + ((8157.41 - 4190.83) * 0.14);
  }

  const baseIRRF = gross - inss;
  
  // IRRF 2026 Rules (Exemption up to 5000 base)
  if (baseIRRF <= 5000.00) {
    return gross - inss; // Isento
  }

  // Calculate "Standard" Tax first (Tabela Progressiva Tradicional)
  let standardTax = 0;
  if (baseIRRF <= 2259.20) standardTax = 0;
  else if (baseIRRF <= 2826.65) standardTax = (baseIRRF * 0.075) - 169.44;
  else if (baseIRRF <= 3751.05) standardTax = (baseIRRF * 0.150) - 381.44;
  else if (baseIRRF <= 4664.68) standardTax = (baseIRRF * 0.225) - 662.77;
  else standardTax = (baseIRRF * 0.275) - 896.00;

  let finalTax = standardTax;

  // Apply "Redutor Adicional" for range 5000 - 7350
  if (baseIRRF > 5000.00 && baseIRRF <= 7350.00) {
    const reducer = 978.62 - (0.133145 * baseIRRF);
    if (reducer > 0) {
      finalTax = Math.max(0, standardTax - reducer);
    }
  }

  return gross - inss - finalTax;
};

// --- Smart Analysis ---

// --- Smart Analysis ---

export const analyzeFinances = (config: UserConfig, expenses: Expense[], goals: Goal[]): string[] => {
  const suggestions: string[] = [];
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const income = config.totalIncome;
  const ratio = totalExpenses / income;
  const remaining = income - totalExpenses;

  // 1. Overall Health
  if (ratio > 0.9) {
    suggestions.push("🚨 **Alerta Vermelho**: Seus gastos ocupam mais de 90% da sua renda. Urgente: Corte gastos supérfluos.");
  } else if (ratio > 0.7) {
    suggestions.push("⚠️ **Atenção**: Seus gastos estão acima de 70%. Tente reduzir contas fixas para sobrar mais para investimentos.");
  } else {
    suggestions.push("✅ **Ótimo**: Seus gastos estão sob controle (< 70%). Aproveite para investir a diferença.");
  }

  // 2. Detailed Category Analysis
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach(e => {
    const cat = e.category || 'Outros';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + e.amount;
  });

  const highImpactCategories = ['Lazer', 'Restaurante', 'Compras', 'Outros'];
  highImpactCategories.forEach(cat => {
    const amount = expensesByCategory[cat] || 0;
    if (amount > income * 0.15) { // Warning if category > 15% of income
         suggestions.push(`📉 **Corte de Gastos**: Você está gastando R$ ${amount.toFixed(2)} em '${cat}' (${((amount/income)*100).toFixed(0)}% da renda). Tente reduzir este valor.`);
    }
  });

  // 3. Goal Feasibility & Emergency Planning
  const hasEmergencyGoal = goals.some(g => g.name.toLowerCase().includes('emerg') || g.name.toLowerCase().includes('reserva'));

  if (goals.length > 0) {
    
    if (remaining <= 0) {
        suggestions.push("🚫 **Metas em Risco**: Seu orçamento mensal está negativo ou zerado. Tentar atingir metas de consumo agora pode gerar dívidas.");
        suggestions.push("🆘 **Plano de Resgate (Passo a Passo)**:");
        suggestions.push("1. **Estancar Sangramento**: Suspenda temporariamente aportes em metas não-essenciais (viagens, eletrônicos).");
        suggestions.push("2. **Micro-Reserva**: Tente juntar apenas R$ 50,00 esta semana. Corte um delivery ou venda algo parado. O objetivo é criar o hábito de guardar.");
        suggestions.push("3. **Blindagem**: Se ocorrer uma emergência hoje, não use o cheque especial. Priorize criar uma 'Reserva de Emergência' mínima antes de qualquer outra meta.");
    } else {
        const totalGoalValue = goals.reduce((acc, g) => acc + g.targetAmount, 0);
        const months = totalGoalValue / remaining;
        const savingsRate = remaining / income;

        if (savingsRate < 0.10) {
             suggestions.push("⚠️ **Zona de Fragilidade**: Você está guardando menos de 10% da renda. Qualquer imprevisto pode desestabilizar suas metas.");
             suggestions.push(`🛡️ **Estratégia de Defesa**: Pague-se primeiro! Assim que o salário cair, transfira R$ ${(income * 0.05).toFixed(2)} (5%) para uma conta separada. Trate isso como uma conta obrigatória.`);
             
             if (!hasEmergencyGoal) {
                 suggestions.push("💡 **Recomendação**: Crie uma meta específica 'Reserva de Emergência' e direcione 100% desse valor para ela até ter pelo menos 1 mês de custos garantidos.");
             }
        }

        if (months > 24) {
             suggestions.push(`📅 **Planejamento Longo**: No ritmo atual (R$ ${remaining.toFixed(2)}/mês), levará ${months.toFixed(0)} meses para atingir tudo.`);
             suggestions.push(`💡 **Sugestão**: Foque em uma meta por vez ou aumente seus aportes cortando gastos variáveis.`);
        } else {
             suggestions.push(`🚀 **Caminho Livre**: Com R$ ${remaining.toFixed(2)} livres por mês, você tem um ótimo potencial para atingir suas metas em ${months.toFixed(0)} meses.`);
        }
        
        suggestions.push(`💰 **Dica de Ouro**: Considere automatizar a aplicação de R$ ${remaining.toFixed(2)} no dia do pagamento para não gastar por impulso.`);
    }
  } else {
    suggestions.push("🎯 **Sem Metas**: Você não definiu nenhuma meta. Que tal criar uma meta para 'Reserva de Emergência'?");
  }

  return suggestions;
};

// --- Monthly Data Logic ---

export const getMonthlyData = (monthKey: string): MonthlyData => {
  const allData = localStorage.getItem('flowcash_monthly_data');
  if (!allData) return { monthKey, extraIncomes: [] };
  
  const parsed = JSON.parse(allData);
  const data = parsed[monthKey] || { monthKey };
  if (!data.extraIncomes) data.extraIncomes = [];
  return data;
};

export const saveMonthlyData = (data: MonthlyData): void => {
  const allDataSrc = localStorage.getItem('flowcash_monthly_data');
  const allData = allDataSrc ? JSON.parse(allDataSrc) : {};
  
  allData[data.monthKey] = data;
  localStorage.setItem('flowcash_monthly_data', JSON.stringify(allData));
};

export const calculateMonthlyBudgetHealth = (config: UserConfig, expenses: Expense[], monthlyData: MonthlyData, mode: 'PROJECTED' | 'REALIZED' = 'REALIZED') => {
  // Base Income
  const baseHealth = calculateBudgetHealth(config, expenses, mode);
  
  // Add Extra Income
  const extras = monthlyData.extraIncomes || [];
  const extraTotal = extras.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Re-calculate totals
  const totalIncome = baseHealth.totalIncome + extraTotal;
  const totalExpenses = baseHealth.totalExpenses; // For now assuming fixed expenses are constant, can be improved later
  const remaining = totalIncome - totalExpenses;

  // Adjust Breakdown - Extra Income usually acts as "Free" money or "Salary" bucket
  // Let's add it to salaryFree/SalaryUsed pool conceptually, or just separate it.
  // For simplicity, we add to "Remaining" and "SalarySource" amount effectively.
  
  return {
    ...baseHealth,
    totalIncome,
    remaining,
    extraIncomeTotal: extraTotal,
    breakdown: {
        ...baseHealth.breakdown,
        salaryFree: baseHealth.breakdown.salaryFree + extraTotal // Attribution
    }
  };
};

// --- History & Rollover Logic ---

/**
 * Checks if we have moved to a new month since the last app usage.
 * If so, archives the previous month and resets the "current" view for the new month.
 */
export const checkAndHandleMonthRollover = (currentExpenses: Expense[], config: UserConfig): { didRollover: boolean, newExpenses: Expense[] } => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const lastActiveMonth = localStorage.getItem('flowcash_last_active_month');
  
  // First run or same month
  if (!lastActiveMonth || lastActiveMonth === currentMonthKey) {
    if (!lastActiveMonth) localStorage.setItem('flowcash_last_active_month', currentMonthKey);
    return { didRollover: false, newExpenses: currentExpenses };
  }
  
  // Rollover detected (Last active month is different/older than current actual month)
  // 1. Archive previous month data
  const historyKey = `flowcash_history_${lastActiveMonth}`;
  const monthlyData = getMonthlyData(lastActiveMonth);
  const health = calculateMonthlyBudgetHealth(config, currentExpenses, monthlyData, 'REALIZED'); // Snapshot as realized
  
  const historyItem: any = { // using any to bypass strict type for now or define proper type
      monthKey: lastActiveMonth,
      totalIncome: health.totalIncome,
      totalExpenses: health.totalExpenses,
      remaining: health.remaining,
      expensesSnapshot: currentExpenses,
      extraIncomesSnapshot: monthlyData.extraIncomes
  };
  
  localStorage.setItem(historyKey, JSON.stringify(historyItem));
  
  // 2. Add to history index
  const historyIndex = JSON.parse(localStorage.getItem('flowcash_history_index') || '[]');
  if (!historyIndex.includes(lastActiveMonth)) {
      historyIndex.push(lastActiveMonth);
      localStorage.setItem('flowcash_history_index', JSON.stringify(historyIndex));
  }
  
  // 3. Reset for New Month
  // Keep fixed expenses (reset paid status), BUT REMOVE variable expenses (they stay in history only)
  const newExpenses = currentExpenses
    .filter(e => e.type !== 'VARIABLE')
    .map(e => ({
      ...e,
      isPaid: false, // Reset paid status
      manualSource: undefined // Reset manual source overrides
  }));
  
  // 4. Update pointer
  localStorage.setItem('flowcash_last_active_month', currentMonthKey);
  
  return { didRollover: true, newExpenses };
};

// --- Smart Clipboard Parsing ---

export const parseTransactionText = (text: string): { amount?: number; description?: string; category?: string } | null => {
  // Common patterns for Brazilian banks
  const patterns = [
    // Nubank: "Compra de R$ 50,00 no iFood"
    { regex: /Compra de R\$\s*([\d,.]+)\s*(?:no|na)\s*(.*)/i, amountIdx: 1, descIdx: 2 },
    // Nubank Transfer: "Transferência de R$ 100,00 enviada para João"
    { regex: /Transferência de R\$\s*([\d,.]+)\s*(?:enviada para)\s*(.*)/i, amountIdx: 1, descIdx: 2 },
    
    // Santander: "Compra aprovada cartao final 1234 valor R$ 50,00 IFOOD"
    { regex: /Compra aprovada.*?valor R\$\s*([\d,.]+)\s*(.*)/i, amountIdx: 1, descIdx: 2 },
    
    // Itaú: "Compra aprovada no cartão final 1234: R$ 50,00 em LOJA TESTE"
    { regex: /Compra aprovada.*?R\$\s*([\d,.]+)\s*em\s*(.*)/i, amountIdx: 1, descIdx: 2 },
    
    // Generic Match: "R$ 50,00 em/no/na Loja"
    { regex: /R\$\s*([\d,.]+)\s*(?:em|no|na)\s*(.*)/i, amountIdx: 1, descIdx: 2 },

    // Simple Amount + Text fallback if line starts with money
    { regex: /^R\$\s*([\d,.]+)\s*-?\s*(.*)/i, amountIdx: 1, descIdx: 2 }
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const rawAmount = match[pattern.amountIdx].replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(rawAmount);
      let description = match[pattern.descIdx].trim();
      
      // Clean up description common prefixes/suffixes
      description = description.replace(/^\d{2}\/\d{2}\s*/, ''); // Remove dates like "05/01" at start
      
      if (!isNaN(amount)) {
        return { amount, description, category: 'Outros' };
      }
    }
  }

  return null;
};


// --- Debt Logic ---

export const getStoredDebts = (): Debt[] => {
  const data = localStorage.getItem('flowcash_debts');
  return data ? JSON.parse(data) : [];
};

export const saveDebts = (debts: Debt[]): void => {
  localStorage.setItem('flowcash_debts', JSON.stringify(debts));
};

export const analyzeDebtPlan = (availableBalance: number, debts: Debt[]): string[] => {
    const plan: string[] = [];
    const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);

    if (debts.length === 0) return ["✅ Você não possui dívidas cadastradas."];
    if (totalDebt <= 0) return ["🎉 Parabéns! Todas as suas dívidas estão quitadas."];

    plan.push(`📉 **Total em Dívidas**: R$ ${totalDebt.toFixed(2)}`);
    
    // Sort by Highest Interest Rate (Avalanche Method)
    // If interest is same, sort by lowest balance (Snowball secondary)
    const sortedDebts = [...debts].sort((a, b) => {
        if (b.interestRate !== a.interestRate) return b.interestRate - a.interestRate;
        return a.remainingAmount - b.remainingAmount;
    });

    if (availableBalance <= 0) {
        plan.push("🚨 **Alerta**: Você não possui saldo disponível este mês para abater dívidas além do mínimo.");
        plan.push("💡 **Dica**: Tente renegociar as taxas de juros ou vender algo para gerar caixa.");
        return plan;
    }

    plan.push(`💰 **Saldo Disponível para Quitação**: R$ ${availableBalance.toFixed(2)}`);
    plan.push("📋 **Plano de Ação Sugerido**:");

    let currentBalance = availableBalance;
    
    sortedDebts.forEach((debt, index) => {
        if (currentBalance <= 0) return;
        if (debt.remainingAmount <= 0) return;

        const payment = Math.min(currentBalance, debt.remainingAmount);
        currentBalance -= payment;

        const balanceAfterPayment = currentBalance;
        
        let stepText = `${index + 1}. Destine **R$ ${payment.toFixed(2)}** para **${debt.description}**`;
        
        if (payment >= debt.remainingAmount) {
             stepText += ` (Quitar Dívida).`;
        } else {
             const newRemaining = debt.remainingAmount - payment;
             stepText += ` (Abater). Restará da Dívida: R$ ${newRemaining.toFixed(2)}.`;
        }
        
        stepText += `<br/><span class="text-xs text-gray-500 italic">Saldo livre após este pagamento: R$ ${balanceAfterPayment.toFixed(2)}</span>`;
        
        plan.push(stepText);
    });

    if (currentBalance > 0) {
        plan.push(`✨ **Sobra Final**: Ainda restarão R$ ${currentBalance.toFixed(2)} livres após seguir o plano.`);
    }

    return plan;
};

import { Debt } from '../types';