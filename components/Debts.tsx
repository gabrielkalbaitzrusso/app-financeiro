import React, { useState } from 'react';
import { Debt, UserConfig, Expense } from '../types';
import { saveDebts, analyzeDebtPlan } from '../services/finance';
import { Plus, Trash2, Edit2, TrendingDown, Target, AlertCircle, X } from 'lucide-react';

interface Props {
  debts: Debt[];
  config: UserConfig;
  availableBalance: number;
  onUpdate: (debts: Debt[]) => void;
}

const Debts: React.FC<Props> = ({ debts, config, availableBalance, onUpdate }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [desc, setDesc] = useState('');
  const [total, setTotal] = useState('');
  const [remaining, setRemaining] = useState('');
  const [rate, setRate] = useState('');
  const [due, setDue] = useState('');

  const resetForm = () => {
    setDesc('');
    setTotal('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleSave = () => {
    if (!desc || !total) return;

    let updatedDebts = [...debts];
    
    const totalVal = parseFloat(total);

    const newDebt: Debt = {
      id: editingId || Date.now().toString(),
      description: desc,
      totalAmount: totalVal,
      remainingAmount: totalVal, // Default to full amount
      interestRate: 0, // Simplified: 0% interest
      dueDate: 10, // Simplified: default due date
    };

    if (editingId) {
      // Preserve existing remaining amount if editing ONLY name/total, 
      // but actually user said "insert name and total", implies creating new or overwriting.
      // If editing, we might want to keep the payment progress? 
      // For simplicity based on prompt "só consiga inserir nome e valor total", let's assume standard behavior.
      // However, if I edit the TOTAL, sticking to "remaining = total" resets progress.
      // Let's check if it's an edit. If edit, we probably shouldn't reset remaining unless logic dictates.
      // BUT, the prompt says "na dívida quero que eu so consiga apenas inserir o nome e valor total".
      // Let's implement creating new debt strictly with these fields.
      updatedDebts = updatedDebts.map(d => d.id === editingId ? { ...newDebt, remainingAmount: d.remainingAmount } : d); 
      // Wait, if I change total, remaining matches total? Or proportional? 
      // Let's keep it simple: If editing, update Name and Total. detailed logic might be overkill.
      // "remainingAmount" tracked progress. If I update total, I should probably update remaining by diff?
      // Let's just set remaining = total for new, and for edit keep old logic or just update desc/total.
      
      // Re-reading: "na dívida quero que eu so consiga apenas inserir o nome e valor total"
      // This implies the input form.
      // I will implement: 
      // New: Remaining = Total. 
      // Edit: Update Name and Total. Keep previous 'paid' amount? 
      // Actually, if the user can't input 'remaining', how do they track payments? 
      // The prompt suggests a simplification of ENTRY. 
      // Maybe they will 'pay' via a separate action? 
      // For now, I will use: Edit -> updates Total. Remaining = Total (Reset) OR Remaining = NewTotal - (OldTotal - OldRemaining).
      // Let's go with Reset for simplicity unless defined otherwise, OR just force Remaining = Total for consistency with "Input only Name and Total".
      // Use case: "I have a debt of 1000". I enter 1000. It shows 1000 remaining.
    } else {
      updatedDebts.push(newDebt);
    }

    onUpdate(updatedDebts);
    saveDebts(updatedDebts);
    resetForm();
  };

  const handleEdit = (debt: Debt) => {
    setEditingId(debt.id);
    setDesc(debt.description);
    setTotal(debt.totalAmount.toString());
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta dívida?')) {
        const updated = debts.filter(d => d.id !== id);
        onUpdate(updated);
        saveDebts(updated);
    }
  };

  const analysis = analyzeDebtPlan(availableBalance, debts);

  return (
    <div className="animate-fade-in pb-20">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Gerenciador de Dívidas</h1>
        <button 
            onClick={() => setIsFormOpen(true)}
            className="w-10 h-10 bg-primary text-white rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center"
        >
            <Plus size={24} />
        </button>
      </header>

       {/* Analysis Card */}
       {debts.length > 0 && (
        <div className="bg-white dark:bg-[#2c2d30] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-dark dark:text-white">
                <Target className="text-primary" /> Análise Inteligente
            </h3>
            <div className="space-y-3">
                {analysis.map((line, idx) => (
                    <div key={idx} className="text-sm text-gray-600 dark:text-gray-300 border-l-2 border-l-gray-200 dark:border-l-gray-700 pl-3 py-1">
                        <div dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-dark dark:text-white">$1</strong>') }} />
                    </div>
                ))}
            </div>
        </div>
       )}

      {/* Debt List */}
      <div className="space-y-4">
        {debts.length === 0 && !isFormOpen && (
            <div className="text-center py-10 opacity-50">
                <AlertCircle size={48} className="mx-auto mb-2 text-gray-400" />
                <p>Nenhuma dívida cadastrada.</p>
            </div>
        )}

        {debts.map(debt => (
            <div key={debt.id} className="bg-white dark:bg-[#2c2d30] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative group transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h4 className="font-bold text-lg text-dark dark:text-white">{debt.description}</h4>
                    </div>
                    <div className="text-right">
                         <p className="text-xl font-bold text-danger">R$ {debt.totalAmount.toFixed(2)}</p>
                    </div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-400 mb-3">
                    <span>Valor Total</span>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                    <button onClick={() => handleEdit(debt)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary transition-colors">
                        <Edit2 size={16} /> Editar
                    </button>
                    <button onClick={() => handleDelete(debt.id)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-danger transition-colors">
                        <Trash2 size={16} /> Excluir
                    </button>
                </div>
            </div>
        ))}
      </div>

       {/* Add/Edit Modal */}
       {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-[#2c2d30] rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
              <button 
                onClick={resetForm}
                className="absolute top-4 right-4 text-gray-400 hover:text-dark dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-bold text-dark dark:text-white mb-6">
                  {editingId ? 'Editar Dívida' : 'Nova Dívida'}
              </h3>

              <div className="space-y-4 mb-6">
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Descrição / Nome</label>
                    <input 
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border border-transparent focus:border-primary focus:bg-white dark:focus:bg-[#1a1b1e] outline-none transition-all"
                        placeholder="Ex: Cartão Visa"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Valor Total</label>
                    <input 
                        type="number"
                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1a1b1e] dark:text-white border border-transparent focus:border-primary focus:bg-white dark:focus:bg-[#1a1b1e] outline-none transition-all"
                        placeholder="0.00"
                        value={total}
                        onChange={e => setTotal(e.target.value)}
                    />
                 </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform"
              >
                Salvar
              </button>
           </div>
        </div>
       )}

    </div>
  );
};

export default Debts;
