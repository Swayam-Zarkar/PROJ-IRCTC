import React from 'react';
import { useBooking } from '../context/BookingContext';
import {
  Train,
  Phone,
  ShieldCheck,
  ExternalLink,
  Award,
  Lock,
  Headphones,
  Info,
  HeartHandshake
} from 'lucide-react';

export default function Footer() {
  const { setActiveView } = useBooking();

  return (
    <footer className="print:hidden bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Badges & Helplines Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-8 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900/60 text-blue-400 flex items-center justify-center shrink-0 border border-blue-700/50">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Railway Inquiry (All India)</div>
              <div className="text-lg font-black text-white font-mono">139 (Toll Free)</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-950/60 text-orange-400 flex items-center justify-center shrink-0 border border-orange-700/50">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">IRCTC Customer Care</div>
              <div className="text-lg font-black text-white font-mono">14646 / 0755-6610661</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-700/50">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">256-Bit SSL Secured</div>
              <div className="text-sm font-bold text-slate-200">RBI Compliant Payment</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 text-purple-400 flex items-center justify-center shrink-0 border border-purple-700/50">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">CRIS Certified</div>
              <div className="text-sm font-bold text-slate-200">Centre for Railway Info</div>
            </div>
          </div>
        </div>

        {/* Links Navigation Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-b border-slate-800 text-xs">
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3 flex items-center gap-1.5">
              <Train className="w-3.5 h-3.5 text-orange-400" />
              <span>Rail Passenger Services</span>
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setActiveView('search')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Book Train Tickets
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveView('pnr-status')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  PNR Status & Coach Position
                </button>
              </li>
              <li>
                <a href="#trains" onClick={(e) => { e.preventDefault(); setActiveView('search'); }} className="hover:text-white transition-colors">
                  Vande Bharat & Rajdhani Schedules
                </a>
              </li>
              <li>
                <a href="#rules" onClick={(e) => { e.preventDefault(); alert('Tatkal AC opens at 10:00 AM IST; Non-AC opens at 11:00 AM IST one day in advance.'); }} className="hover:text-white transition-colors">
                  Tatkal Booking Rules & Timings
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Enquiries & Tools</h4>
            <ul className="space-y-2">
              <li>
                <a href="#fares" onClick={(e) => { e.preventDefault(); alert('Dynamic base fares conform to Indian Railways PRS rate chart.'); }} className="hover:text-white transition-colors">
                  Train Fare Calculator
                </a>
              </li>
              <li>
                <a href="#charts" onClick={(e) => { e.preventDefault(); alert('Reservation chart vacancy is displayed on IRCTC charts portal.'); }} className="hover:text-white transition-colors">
                  Reservation Chart / Vacancy
                </a>
              </li>
              <li>
                <a href="#catering" onClick={(e) => { e.preventDefault(); alert('e-Catering is available at major junction stations.'); }} className="hover:text-white transition-colors">
                  e-Catering Meals Booking
                </a>
              </li>
              <li>
                <a href="#insurance" onClick={(e) => { e.preventDefault(); alert('Optional travel insurance covers rail passenger accidents up to ₹10 Lakhs.'); }} className="hover:text-white transition-colors">
                  Travel Insurance Terms
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Important Portals</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://indianrailways.gov.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>Ministry of Railways</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://cris.org.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>CRIS - Centre for Railway Info</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://railmadad.indianrailways.gov.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>RailMadad Grievance Redressal</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="https://enquiry.indianrail.gov.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>National Train Enquiry (NTES)</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Security & Compliance</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              IRCTC uses 256-bit encryption for payment transactions. Never share your password, OTP, or UPI PIN with anyone claiming to represent IRCTC.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-[11px] text-emerald-400 font-semibold border border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ISO 27001:2013 Certified</span>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CRIS Production PRS Engine • Indian Railways</span>
          </div>

          <div className="text-center md:text-right">
            <div>
              Copyright © 2026 - Centre for Railway Information Systems (CRIS). All Rights Reserved.
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              Indian Railway Catering and Tourism Corporation Ltd. (A Govt. of India Enterprise)
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
