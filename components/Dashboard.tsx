import React, { useState, useEffect } from 'react';
import { UserConfig, Expense, Goal, CashFlowSource, MonthlyData } from '../types';
import { calculateMonthlyBudgetHealth, calculateIncomeParts, analyzeFinances, saveConfig, getMonthlyData, saveMonthlyData } from '../services/finance';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Lightbulb, X, Edit2, Calendar, DollarSign, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface Props {
  config: UserConfig;
  expenses: Expense[];
  goals: Goal[];
}

const Dashboard: React.FC<Props> = ({ config, expenses, goals }) => {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [editingSource, setEditingSource] = useState<CashFlowSource | null>(null);
  
  // Month Selection
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [monthlyData, setMonthlyData] = useState<MonthlyData>({ monthKey: selectedMonth, extraIncomes: [] });
  const [isExtraIncomeFormOpen, setIsExtraIncomeFormOpen] = useState(false);
  
  // Extra Income Form
  const [extraDesc, setExtraDesc] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraDay, setExtraDay] = useState('');
  
  // Extra Income Edit State
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);

  // Edit Form State (Fixed Sources)
  const [editAmount, setEditAmount] = useState('');
  const [editDay, setEditDay] = useState('');

  // View State
  const [viewMode, setViewMode] = useState<'PROJECTED' | 'REALIZED'>('PROJECTED');

  useEffect(() => {
    setMonthlyData(getMonthlyData(selectedMonth));
  }, [selectedMonth]);

  const baseHealth = calculateMonthlyBudgetHealth(config, expenses, monthlyData, 'PROJECTED');
  
  // Realized Logic
  const paidExpenses = expenses.filter(e => e.isPaid);
  const realizedHealth = calculateMonthlyBudgetHealth(config, paidExpenses, monthlyData, 'REALIZED');
  
  const health = viewMode === 'PROJECTED' ? baseHealth : realizedHealth;

  const sources = calculateIncomeParts(config);
  const suggestions = analyzeFinances(config, expenses, goals);

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

  const addExtraIncome = () => {
    if (!extraDesc || !extraAmount || !extraDay) return;
    
    // Create new list
    let newIncomes = [...(monthlyData.extraIncomes || [])];

    if (editingExtraId) {
        // Edit existing
        newIncomes = newIncomes.map(item => item.id === editingExtraId ? {
            ...item,
            description: extraDesc,
            amount: parseFloat(extraAmount),
            receiveDay: parseInt(extraDay)
        } : item);
    } else {
        // Add new
        const newRecord = {
            id: Date.now().toString(),
            description: extraDesc,
            amount: parseFloat(extraAmount),
            receiveDay: parseInt(extraDay)
        };
        newIncomes.push(newRecord);
    }
    
    const newData = {
        ...monthlyData,
        monthKey: monthlyData.monthKey || selectedMonth, 
        extraIncomes: newIncomes
    };
    
    setMonthlyData(newData);
    saveMonthlyData(newData);
    
    setExtraDesc('');
    setExtraAmount('');
    setExtraDay('');
    setEditingExtraId(null);
    setIsExtraIncomeFormOpen(false);
  };
    
  const openEditExtra = (item: any) => {
    setEditingExtraId(item.id);
    setExtraDesc(item.description);
    setExtraAmount(item.amount.toString());
    setExtraDay(item.receiveDay.toString());
    setIsExtraIncomeFormOpen(true);
  };

  const removeExtraIncome = (id: string) => {
    const newData = {
        ...monthlyData,
        extraIncomes: monthlyData.extraIncomes.filter(i => i.id !== id)
    };
    setMonthlyData(newData);
    saveMonthlyData(newData);
  };

  const openEdit = (source: CashFlowSource) => {
    setEditingSource(source);
    setEditAmount(source.amount.toString());
    setEditDay(source.receiveDay.toString());
  };

  const saveEdit = () => {
    if (!editingSource || !editAmount || !editDay) return;
    
    const newAmount = parseFloat(editAmount);
    const newDay = parseInt(editDay);
    
    const overrides = config.manualOverrides || {};
    
    if (editingSource.type === 'VALE') {
        overrides.valeAmount = newAmount;
        overrides.valeDay = newDay;
    } else {
        // Salary
        overrides.salaryAmount = newAmount;
        overrides.salaryDay = newDay;
    }
    
    const newConfig = { ...config, manualOverrides: overrides };
    saveConfig(newConfig);
    setEditingSource(null);
    window.location.reload(); // Simple reload to refresh top-level state or use callback if refined. 
    // Since props come from parent, ideally we should call a callback to update strict state, 
    // but a reload is a robust quick-fix for this MVP architecture to ensure App.tsx re-reads storage.
  };

  const data = [
    { name: 'Gastos', value: health.totalExpenses, color: '#eb445a' }, // Danger color
    { name: 'Livre', value: Math.max(0, health.remaining), color: '#2dd36f' }, // Success color
  ];

  return (
    <div className="animate-fade-in pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Visão Geral</h1>
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-white dark:bg-[#2c2d30] rounded-xl p-2 mt-2 shadow-sm border border-gray-100 dark:border-gray-800">
            <button onClick={() => handleMonthChange('prev')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-dark dark:text-white capitalize">{formatMonthDisplay(selectedMonth)}</span>
            <button onClick={() => handleMonthChange('next')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                <ChevronRight size={20} />
            </button>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-gray-100 dark:bg-[#2c2d30] p-1 rounded-xl mt-4">
             <button 
               onClick={() => setViewMode('PROJECTED')}
               className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'PROJECTED' ? 'bg-white dark:bg-[#1a1b1e] shadow text-dark dark:text-white' : 'text-gray-500'}`}
             >
               Projetado
             </button>
             <button 
               onClick={() => setViewMode('REALIZED')}
               className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'REALIZED' ? 'bg-white dark:bg-[#1a1b1e] shadow text-dark dark:text-white' : 'text-gray-500'}`}
             >
               Pago (Realizado)
             </button>
        </div>
      </header>
    


      {/* Main Balance Card */}
      <div className={`rounded-3xl p-6 text-white shadow-xl mb-6 transition-colors ${health.remaining < 0 ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-200' : 'bg-gradient-to-br from-primary to-blue-600 shadow-blue-200'}`}>
        <p className="text-white/80 text-sm font-medium mb-1">Saldo {viewMode === 'REALIZED' ? 'Atual (Pago)' : 'Livre Projetado'}</p>
        <h2 className="text-4xl font-bold mb-4">R$ {health.remaining.toFixed(2)}</h2>
        
        <div className="flex gap-4">
            <div className="bg-white/20 p-2 rounded-xl flex-1 backdrop-blur-sm">
                <p className="text-xs text-blue-50 mb-1">Entradas</p>
                <p className="font-bold">R$ {health.totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-xl flex-1 backdrop-blur-sm">
                <p className="text-xs text-blue-50 mb-1">Saídas</p>
                <p className="font-bold">R$ {health.totalExpenses.toFixed(2)}</p>
            </div>
        </div>
      </div>



      {/* Analysis Button */}
      <button 
        onClick={() => setShowAnalysis(true)}
        className="w-full bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 mb-6 flex items-center justify-between group active:scale-95 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Lightbulb className="w-6 h-6 text-yellow-300" />
          </div>
          <div className="text-left">
             <p className="font-bold">Análise Inteligente</p>
             <p className="text-xs text-indigo-200">Toque para ver dicas de economia</p>
          </div>
        </div>
        <Lightbulb className="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors" />
      </button>

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-[#222428] rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowAnalysis(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-dark dark:hover:text-white"
              >
                <X size={24} />
              </button>
              
              <div className="mb-4">
                 <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
                    <Lightbulb size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-dark dark:text-white">Dicas para Você</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Baseado no seu perfil atual</p>
              </div>

              <div className="space-y-3 mb-6">
                 {suggestions.map((tip, idx) => (
                   <div key={idx} className="p-3 bg-gray-50 dark:bg-[#2c2d30] rounded-xl text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-700">
                      <div dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                   </div>
                 ))}
                 {suggestions.length === 0 && (
                    <p className="text-center text-gray-500">Tudo parece estar em ordem! 🎉</p>
                 )}
              </div>

              <button 
                onClick={() => setShowAnalysis(false)}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                Entendi
              </button>
           </div>
        </div>
      )}

      {/* Split Analysis */}
      <div className="mb-6">
        <h3 className="font-bold text-dark dark:text-white mb-4 text-lg">Distribuição do Dinheiro</h3>
        <div className="grid grid-cols-1 gap-4">
          {sources.map(source => {
            const isVale = source.type === 'VALE';
            const used = isVale ? health.breakdown.valeUsed : health.breakdown.salaryUsed;
            const free = isVale ? health.breakdown.valeFree : health.breakdown.salaryFree;
            const percentageUsed = source.amount > 0 ? Math.min(100, (used / source.amount) * 100) : 0;

            return (
              <div key={source.name} className="bg-white dark:bg-[#2c2d30] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 group relative">
                 <div className="flex justify-between items-start mb-3">
                    <div>
                       <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${source.color} uppercase tracking-wider`}>
                         Dia {source.receiveDay}
                       </span>
                       <h4 className="font-bold text-dark dark:text-white mt-2">{source.name}</h4>
                    </div>
                    <div className="text-right">
                       <div className="flex items-center justify-end gap-2 mb-0.5">
                           <p className="text-xs text-gray-500">Recebido</p>
                           <button 
                                onClick={() => openEdit(source)}
                                className="text-gray-300 hover:text-primary transition-colors"
                                title="Editar Valor"
                            >
                                <Edit2 size={12} />
                            </button>
                       </div>
                       <p className="font-bold text-dark dark:text-white">R$ {source.amount.toFixed(2)}</p>
                    </div>
                 </div>

                 <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${percentageUsed > 90 ? 'bg-danger' : source.color.replace('bg-', 'bg-')}`} 
                      style={{ width: `${percentageUsed}%` }}
                    />
                 </div>
                 
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Gasto: <span className="text-dark dark:text-white font-medium">R$ {used.toFixed(2)}</span></span>
                    <span className="text-gray-500 dark:text-gray-400">Sobra: <span className={`${free < 0 ? 'text-danger' : 'text-success'} font-bold`}>R$ {free.toFixed(2)}</span></span>
                 </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra Income Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-dark dark:text-white text-lg">Renda Extra (PJ/Outros)</h3>
            <button onClick={() => setIsExtraIncomeFormOpen(true)} className="text-primary hover:bg-blue-50 p-2 rounded-full transition-colors"><Plus size={20} /></button>
        </div>

        {isExtraIncomeFormOpen && (
            <div className="bg-white dark:bg-[#2c2d30] p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4 animate-fade-in">
                <input className="w-full mb-3 p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none outline-none" placeholder="Descrição (ex: Freela)" value={extraDesc} onChange={e => setExtraDesc(e.target.value)} />
                <div className="flex gap-3 mb-3">
                    <input type="number" className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none outline-none" placeholder="Valor" value={extraAmount} onChange={e => setExtraAmount(e.target.value)} />
                    <input type="number" min="1" max="31" className="w-20 p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none outline-none text-center" placeholder="Dia" value={extraDay} onChange={e => setExtraDay(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsExtraIncomeFormOpen(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold">Cancelar</button>
                    <button onClick={addExtraIncome} className="flex-1 py-3 text-white bg-primary rounded-xl font-bold shadow-lg shadow-blue-200">Adicionar</button>
                </div>
            </div>
        )}

        {monthlyData.extraIncomes && monthlyData.extraIncomes.length > 0 ? (
            <div className="space-y-3">
                {monthlyData.extraIncomes.map(item => (
                    <div key={item.id} className="bg-white dark:bg-[#2c2d30] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-dark dark:text-white">{item.description}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Dia {item.receiveDay} • {formatMonthDisplay(selectedMonth)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="font-bold text-success">+ R$ {item.amount.toFixed(2)}</p>
                             <div className="flex gap-2 justify-end mt-1">
                                <button onClick={() => openEditExtra(item)} className="text-gray-300 hover:text-primary p-1"><Edit2 size={14}/></button>
                                <button onClick={() => removeExtraIncome(item.id)} className="text-gray-300 hover:text-danger p-1"><Trash2 size={14}/></button>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-[#2c2d30] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 text-sm">Nenhuma renda extra neste mês.</p>
            </div>
        )}
      </div>

      {/* Edit Income Modal */}
      {editingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-[#2c2d30] rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
              <button 
                onClick={() => setEditingSource(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-dark dark:hover:text-white"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-bold text-dark dark:text-white mb-1">Editar Recebimento</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{editingSource.name}</p>

              <div className="space-y-4 mb-6">
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Valor Recebido</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input 
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1b1e] dark:text-white focus:border-primary outline-none"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dia do Recebimento</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input 
                            type="number"
                            min="1" max="31"
                            value={editDay}
                            onChange={(e) => setEditDay(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1b1e] dark:text-white focus:border-primary outline-none"
                        />
                    </div>
                 </div>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setEditingSource(null)}
                   className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl active:scale-95 transition-transform"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={saveEdit}
                   className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                 >
                   Salvar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white dark:bg-[#2c2d30] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
         <h3 className="font-bold text-dark dark:text-white mb-2">Proporção</h3>
         <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
               <p className="text-xs text-gray-400">Livre</p>
               <p className="font-bold text-dark dark:text-white text-lg">{Math.round((health.remaining / health.totalIncome) * 100)}%</p>
            </div>
         </div>
         <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-danger"></div>
               <span className="text-xs text-gray-500">Comprometido</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-success"></div>
               <span className="text-xs text-gray-500">Livre para Metas</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;