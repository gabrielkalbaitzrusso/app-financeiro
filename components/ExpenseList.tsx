import React, { useState } from 'react';
import { Expense, UserConfig, SalaryType } from '../types';
import { determineSourceForExpense } from '../services/finance';
import { parseTransactionText } from '../services/finance';
import { Clipboard, List, Trash2, Plus, Edit2, CheckCircle2, Circle, Calendar, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  expenses: Expense[];
  onAdd: (expense: Expense) => void;
  onTogglePaid: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
  config: UserConfig;
}

const ExpenseList: React.FC<Props> = ({ expenses, onAdd, onTogglePaid, onDelete, onEdit, config }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [category, setCategory] = useState('Outros');
  const [manualSource, setManualSource] = useState<'VALE' | 'SALARY' | undefined>(undefined);
  const [expenseType, setExpenseType] = useState<'FIXED' | 'VARIABLE'>('FIXED');

  // Month & History Logic
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [displayedExpenses, setDisplayedExpenses] = useState<Expense[]>(expenses);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [isFutureView, setIsFutureView] = useState(false);

  React.useEffect(() => {
     const currentMonthKey = new Date().toISOString().slice(0, 7);
     const lastActiveMonth = localStorage.getItem('flowcash_last_active_month') || currentMonthKey;

     if (selectedMonth === lastActiveMonth) {
        setDisplayedExpenses(expenses);
        setIsHistoryView(false);
        setIsFutureView(false);
     } else if (selectedMonth > lastActiveMonth) {
         // Future
         setIsHistoryView(false);
         setIsFutureView(true);
         // Filter out exclusions or ENDED expenses
         // Logic: Show if (not excluded specific month) AND (no end date OR end date >= select month)
         const projected = expenses
            .filter(e => {
                if (e.type === 'VARIABLE') return false;
                if (e.exclusions && e.exclusions.includes(selectedMonth)) return false;
                if (e.endDate && selectedMonth > e.endDate) return false;
                return true;
            })
            .map(e => ({
             ...e,
             isPaid: false, // Future is always unpaid visually
             manualSource: undefined
         }));
         setDisplayedExpenses(projected);
     } else {
        // Past
        const historyKey = `flowcash_history_${selectedMonth}`;
        const historyData = localStorage.getItem(historyKey);
        setIsHistoryView(true);
        setIsFutureView(false);
        if (historyData) {
            const parsed = JSON.parse(historyData);
            setDisplayedExpenses(parsed.expensesSnapshot || []);
        } else {
            setDisplayedExpenses([]);
        }
     }
  }, [selectedMonth, expenses]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    
    if (direction === 'prev') date.setMonth(date.getMonth() - 1);
    else date.setMonth(date.getMonth() + 1);
    
    const newKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newKey);
  };

  const formatMonthDisplay = (key: string) => {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const openAddForm = () => {
    setEditingId(null);
    setDesc('');
    setAmount('');
    setDay(new Date().getDate().toString()); 
    setCategory('Outros');
    setManualSource(undefined);
    setExpenseType('FIXED');
    setIsFormOpen(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
    setDesc(expense.description);
    setAmount(expense.amount.toString());
    setDay(expense.dueDay.toString());
    setManualSource(expense.manualSource);
    setExpenseType(expense.type || 'FIXED');
    setIsFormOpen(true);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseTransactionText(text);
      if (parsed) {
        setDesc(parsed.description || '');
        setAmount(parsed.amount?.toString() || '');
        setCategory(parsed.category || 'Outros');
        const now = new Date();
        setDay(now.getDate().toString());
        setExpenseType('VARIABLE'); // Generated from notification -> Varied
        setIsFormOpen(true);
      } else {
        alert("Não consegui identificar uma transação válida no texto copiado. Tente copiar a notificação inteira do app do banco.");
      }
    } catch (err) {
      console.error("Paste error:", err);
      alert("Para usar este recurso, preciso de permissão para ler a área de transferência.");
    }
  };

  const handleSave = () => {
    if (!desc || !amount || !day) return;
    
    const expenseData: Expense = {
      id: editingId || Date.now().toString(),
      description: desc,
      amount: parseFloat(amount),
      dueDay: parseInt(day),
      isPaid: expenseType === 'VARIABLE', // Auto-mark varied expenses as paid
      category: category,
      manualSource: manualSource,
      type: expenseType,
      createdAt: expenseType === 'VARIABLE' && !editingId ? new Date().toISOString() : undefined
    };

    if (editingId) {
       const existing = expenses.find(e => e.id === editingId);
       if (existing) {
          expenseData.isPaid = existing.isPaid;
          expenseData.createdAt = existing.createdAt;
       }
       onEdit(expenseData);
    } else {
       onAdd(expenseData);
    }
    
    setIsFormOpen(false);
  };



  const handleDeleteClick = (expense: Expense) => {
      if (isFutureView) {
          // Stop recurring expense from this month onwards
          if (confirm(`Atenção: Isso encerrará a recorrência deste gasto.\n\nEle deixará de existir a partir de ${formatMonthDisplay(selectedMonth)} (inclusive), mas o histórico dos meses anteriores será MANTIDO.\n\nDeseja continuar?`)) {
              // Calculate previous month
              const [year, month] = selectedMonth.split('-').map(Number);
              const date = new Date(year, month - 1);
              date.setMonth(date.getMonth() - 1);
              const prevMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              
              onEdit({ ...expense, endDate: prevMonthKey });
          }
      } else {
          // Hard delete (Current month = Master delete)
          if (expense.type === 'VARIABLE') {
              // Simple delete for variable expenses (no future impact)
               if (confirm("Excluir este gasto avulso?")) {
                   onDelete(expense.id);
               }
          } else {
               // Warning for fixed expenses (recurrence impact)
               if (confirm("Você está no mês ATUAL. Excluir aqui removerá este gasto fixo de TODOS os meses futuros também. Deseja continuar?")) {
                   onDelete(expense.id);
               }
          }
      }
  };

  const getSourceStyle = (day: number, expense?: Expense) => {
    const source = determineSourceForExpense(day, config, expense);
    if (config.salaryType === SalaryType.SINGLE) return { label: 'Salário', color: 'text-green-600 bg-green-100' };
    
    return source === 'VALE' 
      ? { label: 'Vale', color: 'text-amber-600 bg-amber-100' }
      : { label: 'Salário', color: 'text-green-600 bg-green-100' };
  };

  const sortedExpenses = [...displayedExpenses].sort((a, b) => a.dueDay - b.dueDay);
  const fixedExpenses = sortedExpenses.filter(e => !e.type || e.type === 'FIXED');
  const variableExpenses = sortedExpenses.filter(e => {
      if (e.type !== 'VARIABLE') return false;
      if (isHistoryView) return true; // Show all variable expenses in history view (snapshot)
      if (!e.createdAt) return true; // Legacy fallback
      const date = new Date(e.createdAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const renderExpenseCard = (expense: Expense) => {
      const suggestedSystem = getSourceStyle(expense.dueDay); 
      return (
        <div key={expense.id} className="group relative bg-white dark:bg-[#2c2d30] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:shadow-md mb-3">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
              <button 
                  onClick={() => !isHistoryView && !isFutureView && onTogglePaid(expense.id)} 
                  className={`transition-colors ${isHistoryView || isFutureView ? 'cursor-default opacity-50' : ''}`}
                  title={isFutureView ? "Não é possível pagar meses futuros" : ""}
              >
                {expense.isPaid ? (
                  <CheckCircle2 className="text-success w-6 h-6" />
                ) : (
                  <Circle className="text-gray-300 dark:text-gray-600 w-6 h-6" />
                )}
              </button>
              <div>
                <h3 className={`font-semibold text-dark dark:text-white ${expense.isPaid ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                  {expense.description}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar size={12}/> Dia {expense.dueDay}
                  </span>
                  
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${suggestedSystem.color} opacity-70`}>
                    Sug: {suggestedSystem.label}
                  </span>

                  <select                           
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-none outline-none appearance-none cursor-pointer hover:opacity-80 transition-opacity ${expense.manualSource ? (expense.manualSource === 'VALE' ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500' : 'bg-green-100 text-green-900 ring-2 ring-green-500') : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}
                    value={expense.manualSource || ""}
                    onChange={(e) => {
                        const val = e.target.value as 'VALE' | 'SALARY' | "";
                        onEdit({ ...expense, manualSource: val === "" ? undefined : val });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                     <option value="">Auto</option>
                     <option value="VALE">Vale</option>
                     <option value="SALARY">Salário</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end">
              <p className={`font-bold ${expense.isPaid ? 'text-gray-400 dark:text-gray-600' : 'text-dark dark:text-white'}`}>
                R$ {expense.amount.toFixed(2)}
              </p>
              {!isHistoryView && (
              <div className="flex gap-2 mt-2">
                 <button 
                    onClick={() => openEditForm(expense)}
                    className="p-1 text-gray-300 hover:text-primary transition-colors"
                  >
                     <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(expense)}
                    className="p-1 text-gray-300 hover:text-danger transition-colors"
                  >
                     <Trash2 size={16} />
                  </button>
              </div>
              )}
            </div>
          </div>
        </div>
      );
  };

  return (
    <div className="pb-24">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-dark dark:text-white">Meus Gastos</h2>
         {!isHistoryView && !isFutureView && (
        <div className="flex gap-2">
            <button 
              onClick={handlePaste}
              className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-full active:scale-90 transition-transform"
              title="Colar Notificação"
            >
              <Clipboard size={24} />
            </button>
            <button 
              onClick={openAddForm}
              className="bg-primary text-white p-2 rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform"
            >
              <Plus size={24} />
            </button>
        </div>
        )}
      </div>

       {/* Month Selector */}
       <div className="flex items-center justify-between bg-white dark:bg-[#2c2d30] rounded-xl p-2 mb-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <button onClick={() => handleMonthChange('prev')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-dark dark:text-white capitalize">{formatMonthDisplay(selectedMonth)}</span>
            <button onClick={() => handleMonthChange('next')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                <ChevronRight size={20} />
            </button>
        </div>

      {isFormOpen && (
        <div className="mb-6 p-4 bg-white dark:bg-[#2c2d30] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-fade-in">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">{editingId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
          
          {/* Type Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setExpenseType('FIXED')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${expenseType === 'FIXED' ? 'bg-white dark:bg-[#2c2d30] shadow-sm text-primary' : 'text-gray-400'}`}
              >
                Fixo (Mensal)
              </button>
              <button 
                onClick={() => setExpenseType('VARIABLE')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${expenseType === 'VARIABLE' ? 'bg-white dark:bg-[#2c2d30] shadow-sm text-primary' : 'text-gray-400'}`}
              >
                Variável (Avulso)
              </button>
          </div>

          <div className="mb-3">
             <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Descrição</label>
                {!editingId && <span className="text-xs text-indigo-500 font-medium cursor-pointer" onClick={handlePaste}>Colar do Banco</span>}
             </div>
             <input 
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder={expenseType === 'FIXED' ? "Ex: Aluguel" : "Ex: iFood, Uber..."}
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
          </div>

          <div className="flex gap-3 mb-4">
             <div className="relative flex-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Valor</label>
                <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-sm">R$</span>
                    <input 
                      type="number"
                      className="w-full p-3 pl-8 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="0,00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                </div>
             </div>
             {expenseType === 'FIXED' && (
             <div className="relative w-24">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Dia Venc.</label>
                <input 
                  type="number"
                  min="1" max="31"
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none text-center"
                  placeholder="DD"
                  value={day}
                  onChange={e => setDay(e.target.value)}
                />
             </div>
             )}
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Origem do Recurso</label>
            <div className="flex gap-2">
                <button 
                onClick={() => setManualSource(undefined)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${!manualSource ? 'border-primary text-primary bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}
                >
                Auto <span className="text-[10px] text-gray-400 block font-normal">({parseInt(day) ? (determineSourceForExpense(parseInt(day), config) === 'VALE' ? 'Vale' : 'Salário') : '...'})</span>
                </button>
                <button 
                onClick={() => setManualSource('VALE')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${manualSource === 'VALE' ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}
                >
                Vale
                </button>
                <button 
                onClick={() => setManualSource('SALARY')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${manualSource === 'SALARY' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}
                >
                Salário
                </button>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-semibold bg-gray-100 dark:bg-gray-800 rounded-xl">Cancelar</button>
             <button onClick={handleSave} className="flex-1 py-3 text-white font-semibold bg-primary rounded-xl shadow-lg shadow-blue-200">Salvar</button>
          </div>
        </div>
      )}

      {/* Varied Expenses Section */}
      {variableExpenses.length > 0 && (
         <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 pl-1 uppercase tracking-wider">Variados / Avulsos</h3>
            <div className="space-y-0">
               {variableExpenses.map(renderExpenseCard)}
            </div>
         </div>
      )}

      {/* Fixed Expenses Section */}
      <div>
         <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 pl-1 uppercase tracking-wider">Fixos / Mensais</h3>
         <div className="space-y-0">
            {fixedExpenses.length === 0 && variableExpenses.length === 0 && !isFormOpen && (
                <div className="text-center py-10 opacity-50">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar size={32} className="text-gray-400 dark:text-gray-500"/>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">Nenhum gasto cadastrado.</p>
                </div>
            )}
            {fixedExpenses.map(renderExpenseCard)}
         </div>
      </div>
    </div>
  );
};

export default ExpenseList;