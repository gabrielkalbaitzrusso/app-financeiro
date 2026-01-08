import React, { useState } from 'react';
import { Goal, UserConfig, Expense } from '../types';
import { calculateBudgetHealth } from '../services/finance';
import { Target, Plus, Trash2, TrendingUp } from 'lucide-react';

interface Props {
  goals: Goal[];
  config: UserConfig;
  expenses: Expense[];
  onAdd: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

const Goals: React.FC<Props> = ({ goals, config, expenses, onAdd, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');

  const health = calculateBudgetHealth(config, expenses);
  const monthlySurplus = health.remaining;

  const handleAdd = () => {
    if (!name || !target || !date) return;
    onAdd({
      id: Date.now().toString(),
      name,
      targetAmount: parseFloat(target),
      currentAmount: 0, // Simplified for this MVP, usually users would add deposits
      deadline: date
    });
    setName('');
    setTarget('');
    setDate('');
    setIsAdding(false);
  };

  return (
    <div className="pb-24 animate-fade-in">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-dark dark:text-white">Metas (SMART)</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white p-2 rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="bg-purple-600 text-white p-5 rounded-2xl shadow-lg shadow-purple-200 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-purple-200" />
          <h3 className="font-bold">Potencial de Economia</h3>
        </div>
        <p className="text-purple-100 text-sm mb-1">Baseado nos seus gastos fixos atuais, você pode destinar até:</p>
        <p className="text-3xl font-bold">R$ {Math.max(0, monthlySurplus).toFixed(2)} <span className="text-sm font-normal text-purple-200">/mês</span></p>
      </div>

      {isAdding && (
        <div className="mb-6 p-4 bg-white dark:bg-[#2c2d30] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 animate-fade-in">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Nova Meta</h3>
          <input 
            className="w-full mb-3 p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Nome (ex: Viagem)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="flex gap-3 mb-4">
             <div className="relative flex-1">
                <span className="absolute left-3 top-3 text-gray-400 text-sm">R$</span>
                <input 
                  type="number"
                  className="w-full p-3 pl-8 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Alvo"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                />
             </div>
             <div className="relative flex-1">
                <input 
                  type="date"
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border-none focus:ring-2 focus:ring-primary/20 outline-none"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
             </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-gray-500 dark:text-gray-400 font-semibold bg-gray-100 dark:bg-gray-800 rounded-xl">Cancelar</button>
             <button onClick={handleAdd} className="flex-1 py-3 text-white font-semibold bg-primary rounded-xl shadow-lg shadow-blue-200">Criar Meta</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(goal => {
            const monthsToDeadline = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)));
            const requiredMonthly = goal.targetAmount / monthsToDeadline;
            const isFeasible = requiredMonthly <= monthlySurplus;

            return (
                <div key={goal.id} className="bg-white dark:bg-[#2c2d30] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-300">
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-dark dark:text-white">{goal.name}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Alvo: R$ {goal.targetAmount}</p>
                            </div>
                        </div>
                        <button onClick={() => onDelete(goal.id)} className="text-gray-300 hover:text-danger">
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-gray-500 dark:text-gray-400">Prazo: {new Date(goal.deadline).toLocaleDateString()}</span>
                            <span className="font-medium text-dark dark:text-white">{monthsToDeadline} meses</span>
                        </div>
                        <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${isFeasible ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                             <div className="mt-0.5 shrink-0">
                                {isFeasible ? (
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                )}
                             </div>
                             <div>
                                <p>Requer: <strong>R$ {requiredMonthly.toFixed(2)}/mês</strong></p>
                                {!isFeasible && <p className="text-xs mt-1 opacity-80">Atenção: Seu saldo livre atual (R$ {monthlySurplus.toFixed(2)}) é insuficiente.</p>}
                             </div>
                        </div>
                    </div>
                </div>
            )
        })}
        {goals.length === 0 && !isAdding && (
            <div className="text-center py-10 opacity-50">
                <Target size={48} className="mx-auto mb-2 text-gray-300 dark:text-gray-600"/>
                <p className="text-gray-500 dark:text-gray-400">Nenhuma meta definida.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Goals;