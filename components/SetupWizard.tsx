import React, { useState } from 'react';
import { UserConfig, SalaryType } from '../types';
import { saveConfig, calculateNetSalary } from '../services/finance';
import { Check, DollarSign, Calendar, ChevronRight, Calculator } from 'lucide-react';

interface Props {
  onComplete: (config: UserConfig) => void;
  initialConfig?: UserConfig;
}

const SetupWizard: React.FC<Props> = ({ onComplete, initialConfig }) => {
  const [step, setStep] = useState(1);
  const [salaryType, setSalaryType] = useState<SalaryType>(initialConfig?.salaryType || SalaryType.SINGLE);
  const [grossIncome, setGrossIncome] = useState(initialConfig?.grossIncome?.toString() || '');
  const [netIncome, setNetIncome] = useState(initialConfig?.totalIncome?.toString() || '');
  const [valePct, setValePct] = useState(initialConfig?.valePercentage || 40);
  const [valeDay, setValeDay] = useState(initialConfig?.valeDay || 20);
  const [salaryDay, setSalaryDay] = useState(initialConfig?.salaryDay || 5);

  const handleGrossChange = (val: string) => {
    setGrossIncome(val);
    const gross = parseFloat(val);
    if (!isNaN(gross)) {
      setNetIncome(calculateNetSalary(gross).toFixed(2));
    } else {
      setNetIncome('');
    }
  };

  const handleFinish = () => {
    const gross = parseFloat(grossIncome) || 0;
    const net = parseFloat(netIncome) || 0;
    const config: UserConfig = {
      salaryType,
      grossIncome: gross,
      totalIncome: net,
      valePercentage: salaryType === SalaryType.SPLIT ? valePct : undefined,
      valeDay: salaryType === SalaryType.SPLIT ? valeDay : undefined,
      salaryDay,
      setupComplete: true
    };
    saveConfig(config);
    onComplete(config);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1b1e] p-6 justify-between animate-fade-in transition-colors">
      <div className="mt-8">
        <h1 className="text-3xl font-bold text-dark dark:text-white mb-2">Bem-vindo</h1>
        <p className="text-medium text-gray-600 dark:text-gray-400 mb-8">Vamos configurar seu fluxo de caixa inteligente.</p>

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Como você recebe?</label>
            <div 
              onClick={() => setSalaryType(SalaryType.SINGLE)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${salaryType === SalaryType.SINGLE ? 'border-primary bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 dark:bg-[#2c2d30]'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-dark dark:text-white">1x por Mês</span>
                {salaryType === SalaryType.SINGLE && <Check className="text-primary w-5 h-5" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Salário integral em uma única data.</p>
            </div>

            <div 
              onClick={() => setSalaryType(SalaryType.SPLIT)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${salaryType === SalaryType.SPLIT ? 'border-primary bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 dark:bg-[#2c2d30]'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-dark dark:text-white">2x por Mês (Vale)</span>
                {salaryType === SalaryType.SPLIT && <Check className="text-primary w-5 h-5" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adiantamento (Vale) + Restante do Salário.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Salário Bruto Mensal</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input 
                  type="number" 
                  value={grossIncome}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2d30] dark:text-white focus:border-primary focus:ring-2 focus:ring-blue-100 outline-none transition-all text-lg"
                />
              </div>
            </div>

            <div className="animate-fade-in">
               <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Líquido a Receber <span className="text-xs font-normal text-gray-400">(Editável)</span></label>
               <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-green-600 dark:text-green-400 w-5 h-5" />
                  <input 
                    type="number" 
                    value={netIncome}
                    onChange={(e) => setNetIncome(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-green-100 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 text-green-800 dark:text-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all text-lg font-bold"
                  />
               </div>
               {grossIncome && (
                 <p className="text-xs text-gray-400 mt-2 ml-1 flex items-center gap-1">
                    <Calculator size={12} />
                    Valor calculado automaticamente. Ajuste se necessário para bater com seu holerite.
                 </p>
               )}
            </div>

            {salaryType === SalaryType.SPLIT && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Porcentagem do Vale ({valePct}%)</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="80" 
                    step="5"
                    value={valePct}
                    onChange={(e) => setValePct(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>10%</span>
                    <span>{valePct}%</span>
                    <span>80%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Dia do Vale</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                      <input 
                        type="number" 
                        min="1" max="31"
                        value={valeDay}
                        onChange={(e) => setValeDay(Number(e.target.value))}
                        className="w-full pl-9 pr-2 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2d30] dark:text-white focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Dia do Salário</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                      <input 
                        type="number" 
                        min="1" max="31"
                        value={salaryDay}
                        onChange={(e) => setSalaryDay(Number(e.target.value))}
                        className="w-full pl-9 pr-2 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2d30] dark:text-white focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
             {salaryType === SalaryType.SINGLE && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Dia do Recebimento</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                      <input 
                        type="number" 
                        min="1" max="31"
                        value={salaryDay}
                        onChange={(e) => setSalaryDay(Number(e.target.value))}
                        className="w-full pl-9 pr-2 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2c2d30] dark:text-white focus:border-primary outline-none"
                      />
                    </div>
                  </div>
             )}
          </div>
        )}
      </div>

      <div className="mb-6">
        {step === 1 ? (
          <button 
            onClick={() => setStep(2)}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            Próximo <ChevronRight size={20}/>
          </button>
        ) : (
          <div className="flex gap-4">
            <button 
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-4 rounded-xl font-bold active:scale-95 transition-transform"
            >
              Voltar
            </button>
            <button 
              onClick={handleFinish}
              disabled={!netIncome}
              className={`flex-1 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform ${!netIncome ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary shadow-blue-200'}`}
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;