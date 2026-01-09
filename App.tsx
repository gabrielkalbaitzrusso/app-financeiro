import React, { useState, useEffect } from 'react';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import Debts from './components/Debts';
import Goals from './components/Goals';
import { UserConfig, Expense, Goal, Debt } from './types';
import * as finance from './services/finance';
import { LayoutDashboard, Receipt, Target, Settings, LogOut, CircleDollarSign, Moon, Sun, TrendingDown } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { IonPage, IonContent, IonHeader, IonFooter } from '@ionic/react';

const App: React.FC = () => {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'goals' | 'debts'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  
  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
     return localStorage.getItem('flowcash_theme') === 'dark';
  });

  useEffect(() => {
    // Apply theme
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('flowcash_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('flowcash_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    // Notification Permissions
    const checkPermissions = async () => {
        try {
            const status = await LocalNotifications.checkPermissions();
            if (status.display !== 'granted') {
                await LocalNotifications.requestPermissions();
            }
        } catch (e) {
            console.error("Notification permission error", e);
        }
    };
    checkPermissions();
  }, []);

  useEffect(() => {
    // Load data from local storage on mount
    const loadedConfig = finance.getStoredConfig();
    const loadedExpenses = finance.getStoredExpenses();
    const loadedGoals = finance.getStoredGoals();
    const loadedDebts = finance.getStoredDebts();

    if (loadedConfig && loadedExpenses.length > 0) {
        const { didRollover, newExpenses } = finance.checkAndHandleMonthRollover(loadedExpenses, loadedConfig);
        
        if (didRollover) {
            console.log("Month Rollover Detected! Resetting expenses.");
            setExpenses(newExpenses);
            finance.saveExpenses(newExpenses);
            alert("Bem-vindo a um novo mês! Seus dados do mês passado foram salvos no histórico e seus gastos foram reiniciados.");
        } else {
            setExpenses(loadedExpenses);
        }
    } else {
        setExpenses(loadedExpenses);
    }

    setConfig(loadedConfig);
    setGoals(loadedGoals);
    setDebts(loadedDebts);
    setLoading(false);
  }, []);

  const handleSetupComplete = (newConfig: UserConfig) => {
    setConfig(newConfig);
    setIsEditingConfig(false);
  };

  const handleReset = () => {
    if(confirm("Deseja realmente apagar todos os dados e reconfigurar?")) {
      localStorage.clear();
      setExpenses([]);
      setGoals([]);
      setDebts([]);
      setConfig(null);
      // Keep theme preference? Maybe no need to clear theme
    }
  };
  
  // ... (CRUD handlers kept same, implied via overwrite below or merged if I copy them, but to be safe I will just replace the top section and render)

  const addExpense = (expense: Expense) => {
    const updated = [...expenses, expense];
    setExpenses(updated);
    finance.saveExpenses(updated);
  };

  const deleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    finance.saveExpenses(updated);
  };

  const toggleExpensePaid = (id: string) => {
    const updated = expenses.map(e => e.id === id ? { ...e, isPaid: !e.isPaid } : e);
    setExpenses(updated);
    finance.saveExpenses(updated);
  };

  const addGoal = (goal: Goal) => {
    const updated = [...goals, goal];
    setGoals(updated);
    finance.saveGoals(updated);
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    finance.saveGoals(updated);
  };
  
  // Balance calculation for Debt Plan (Available is Projected Remaining)
  const availableBalance = config ? finance.calculateBudgetHealth(config, expenses, 'PROJECTED').remaining : 0;

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1a1b1e] text-primary">Carregando...</div>;

  if (!config || !config.setupComplete || isEditingConfig) {
    return <SetupWizard onComplete={handleSetupComplete} initialConfig={isEditingConfig ? config : undefined} />;
  }

  return (
    <IonPage className={`bg-[#f4f5f8] dark:bg-[#1a1b1e] font-sans text-slate-800 dark:text-gray-100 transition-colors`}>
      
      {/* Top Bar */}
      <IonHeader className="ion-no-border">
      <div className="bg-white dark:bg-[#222428] px-6 pt-12 pb-4 shadow-sm flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
                <CircleDollarSign size={20} />
            </div>
            <span className="font-bold text-lg text-dark dark:text-white tracking-tight">Gestão Pessoal</span>
        </div>
        <div className="flex gap-4">
             <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400 hover:text-warning transition-colors">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setIsEditingConfig(true)} className="text-gray-400 hover:text-primary transition-colors">
                <Settings size={20} />
            </button>
            <button onClick={handleReset} className="text-gray-400 hover:text-danger transition-colors">
              <LogOut size={20} />
            </button>
        </div>
      </div>
      </IonHeader>

      {/* Main Content Area */}
      <IonContent fullscreen>
      <main className="p-6 pb-24 h-full bg-[#f4f5f8] dark:bg-[#1a1b1e]">
        {activeTab === 'dashboard' && <Dashboard config={config} expenses={expenses} goals={goals} />}
        {activeTab === 'expenses' && (
          <ExpenseList 
            expenses={expenses} 
            config={config} 
            onAdd={addExpense} 
            onDelete={deleteExpense}
            onTogglePaid={toggleExpensePaid}
            onEdit={(updatedExpense) => {
                const updated = expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e);
                setExpenses(updated);
                finance.saveExpenses(updated);
            }}
          />
        )}
        {activeTab === 'debts' && (
            <Debts 
                debts={debts}
                config={config}
                availableBalance={availableBalance} // Pass available balance for analysis
                onUpdate={setDebts}
            />
        )}
        {activeTab === 'goals' && (
          <Goals 
            goals={goals} 
            config={config} 
            expenses={expenses}
            onAdd={addGoal}
            onDelete={deleteGoal}
          />
        )}
      </main>
      </IonContent>

      {/* Bottom Navigation */}
      <IonFooter className="ion-no-border">
      <nav className="w-full bg-white dark:bg-[#222428] border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-between items-center pb-8 transition-colors">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-medium">Resumo</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'expenses' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <Receipt size={24} />
          <span className="text-[10px] font-medium">Gastos</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('debts')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'debts' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <TrendingDown size={24} />
          <span className="text-[10px] font-medium">Dívidas</span>
        </button>

        <button 
          onClick={() => setActiveTab('goals')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'goals' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <Target size={24} />
          <span className="text-[10px] font-medium">Metas</span>
        </button>
      </nav>
      </IonFooter>
    </IonPage>
  );
};

export default App;