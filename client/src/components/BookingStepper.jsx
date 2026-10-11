import React from 'react';
import { Search, Train, UserCheck, CreditCard, Ticket, Check } from 'lucide-react';
import { useBooking } from '../context/BookingContext';

export default function BookingStepper() {
  const { activeView, selectedTrain, selectedClass, currentBooking } = useBooking();

  // Hide stepper on Login, Charts, or PNR Status lookup
  if (['login', 'pnr-status', 'charts'].includes(activeView)) {
    return null;
  }

  const steps = [
    { id: 'search', label: '1. Search Trains', icon: Search },
    { id: 'results', label: '2. Select Class', icon: Train },
    { id: 'passenger', label: '3. Passenger Details', icon: UserCheck },
    { id: 'payment', label: '4. Payment Review', icon: CreditCard },
    { id: 'pnr', label: '5. Confirmation (ERS)', icon: Ticket },
  ];

  const getStepIndex = (view) => {
    switch (view) {
      case 'search': return 0;
      case 'results': return 1;
      case 'passenger': return 2;
      case 'payment': return 3;
      case 'pnr': return 4;
      default: return 0;
    }
  };

  const currentIdx = getStepIndex(activeView);

  return (
    <div className="w-full bg-white border-b border-slate-200 py-3 px-4 shadow-2xs">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Connector progress bar background */}
          <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-slate-200 z-0">
            <div 
              className="h-full bg-gradient-to-r from-[#0f2c59] to-orange-500 transition-all duration-300"
              style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>

          {/* Stepper items */}
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 shadow-sm ${
                    isCurrent
                      ? 'bg-orange-600 text-white ring-4 ring-orange-100 scale-110'
                      : isCompleted
                      ? 'bg-[#0f2c59] text-white'
                      : 'bg-white text-slate-400 border-2 border-slate-300'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                </div>
                <span 
                  className={`mt-1.5 text-[11px] font-bold tracking-tight hidden sm:block whitespace-nowrap ${
                    isCurrent ? 'text-orange-700' : isCompleted ? 'text-[#0f2c59]' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
