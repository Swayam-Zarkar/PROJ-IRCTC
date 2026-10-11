import React, { useState } from 'react';
import { useBooking } from '../context/BookingContext';
import PNRConfirmation from './PNRConfirmation';
import {
  Search,
  Train,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  FileText,
  ShieldCheck,
  History
} from 'lucide-react';

export default function PNRStatusView() {
  const { lookupPNR, pnrHistory, setActiveView } = useBooking();
  const [pnrInput, setPnrInput] = useState('');
  const [searchedBooking, setSearchedBooking] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setError('');

    const clean = pnrInput.trim().replace(/[^0-9]/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit Indian Railways PNR number.');
      setSearchedBooking(null);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = lookupPNR(clean);
      setIsLoading(false);
      if (res && res.success) {
        setSearchedBooking(res.booking);
      } else {
        setError(res?.message || 'PNR not found in system or flushed from PRS servers.');
        setSearchedBooking(null);
      }
    }, 450);
  };

  const handleSampleClick = (samplePnr) => {
    setPnrInput(samplePnr);
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      const res = lookupPNR(samplePnr);
      setIsLoading(false);
      if (res && res.success) {
        setSearchedBooking(res.booking);
      }
    }, 300);
  };

  const handleReset = () => {
    setPnrInput('');
    setSearchedBooking(null);
    setError('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-800/80 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-700">
            <Train className="w-3.5 h-3.5" />
            <span>Passenger Reservation System (PRS) Enquiry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Check Current PNR Status
          </h1>
          <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
            Enter your 10-digit Passenger Name Record (PNR) number to inspect live berth allocation, coach status, and charting preparation.
          </p>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearch} className="relative z-10 mt-6 max-w-xl">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 bg-white p-2 rounded-2xl shadow-lg border border-slate-200">
            <div className="relative flex-1 flex items-center pl-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                maxLength={10}
                value={pnrInput}
                onChange={(e) => {
                  setPnrInput(e.target.value.replace(/[^0-9]/g, ''));
                  if (error) setError('');
                }}
                placeholder="Enter 10-Digit PNR (e.g. 2489104821)"
                className="w-full pl-3 pr-2 py-2.5 text-base sm:text-lg font-mono font-bold text-blue-950 placeholder-slate-400 focus:outline-none"
              />
              {pnrInput && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Get Status</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-rose-300 text-xs font-semibold bg-rose-950/40 px-3 py-2 rounded-lg border border-rose-500/40">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Quick Sample PNR Chips */}
        <div className="relative z-10 mt-6 pt-4 border-t border-blue-800/80">
          <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-orange-400" />
            <span>Recent & Sample Test PNRs (Click to inspect):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pnrHistory.slice(0, 4).map((pnrObj) => (
              <button
                key={pnrObj.pnr}
                onClick={() => handleSampleClick(pnrObj.pnr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  pnrInput === pnrObj.pnr
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-blue-800/60 hover:bg-blue-800 text-slate-200 border border-blue-700'
                }`}
              >
                {pnrObj.pnr} • {pnrObj.trainNumber} ({pnrObj.bookingStatus})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Render Confirmation / Status Slip If Found */}
      {searchedBooking ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Record Found in Central Railway PRS Server</span>
            </div>
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Search Another PNR</span>
            </button>
          </div>
          <PNRConfirmation bookingOverride={searchedBooking} />
        </div>
      ) : (
        /* Explanatory Cards When Idle */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Where do I find my PNR?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your 10-digit PNR is printed on the top-left corner of your printed ticket or sent via SMS/Email confirmation immediately after payment.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">When is Chart Prepared?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              First chart is prepared 4 hours before scheduled departure. A second chart is finalized 30 minutes prior to departure for any last-minute cancellations.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Valid Identity Proof</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Any one of the passengers must carry an original photo ID (Aadhaar, Passport, PAN Card, Driving Licence, or Student ID) during the journey.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
