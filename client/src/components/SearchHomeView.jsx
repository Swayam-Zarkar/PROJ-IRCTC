import React from 'react';
import { 
  Zap, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Award,
  Utensils,
  Clock,
  CheckCircle2,
  Train
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import SearchWidget from './SearchWidget';
import { INITIAL_TRAINS } from '../data/trainsData';

export default function SearchHomeView() {
  const { 
    setSearchParams, 
    setActiveView 
  } = useBooking();

  const popularRoutes = [
    {
      title: 'New Delhi ➔ Mumbai Central',
      train: '12952 Mumbai Rajdhani',
      type: 'RAJDHANI',
      duration: '15h 40m',
      from: 'NDLS',
      to: 'MMCT',
      fare: '₹2,040',
      tag: 'Most Popular',
    },
    {
      title: 'New Delhi ➔ Varanasi Junction',
      train: '22436 Vande Bharat Express',
      type: 'VANDE_BHARAT',
      duration: '08h 00m',
      from: 'NDLS',
      to: 'BSB',
      fare: '₹1,750',
      tag: 'Semi-High Speed',
    },
    {
      title: 'New Delhi ➔ Bhopal Junction',
      train: '12002 Bhopal Shatabdi',
      type: 'SHATABDI',
      duration: '08h 25m',
      from: 'NDLS',
      to: 'BPL',
      fare: '₹1,490',
      tag: 'Day Express',
    },
    {
      title: 'New Delhi ➔ Howrah Junction',
      train: '12302 Howrah Rajdhani',
      type: 'RAJDHANI',
      duration: '17h 05m',
      from: 'NDLS',
      to: 'HWH',
      fare: '₹2,150',
      tag: 'Superfast Overnight',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Section with Search Widget */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f2c59]/10 via-orange-500/5 to-[#0f2c59]/10 rounded-3xl -z-10 blur-xl"></div>
        
        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider mb-2 border border-orange-200">
            <Zap className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
            <span>Next-Gen Tatkal & General Railway Booking Portal</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#0f2c59] tracking-tight">
            Safety, Security & Punctuality
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium">
            Search trains across India, book Tatkal berths with live quota inventory, and check real-time PNR confirmation.
          </p>
        </div>

        {/* Embedded Search Widget */}
        <SearchWidget isCompact={false} />
      </div>

      {/* Featured Vande Bharat & Tatkal Spotlight Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tatkal Booking Guide Card */}
        <div className="bg-gradient-to-br from-[#0f2c59] to-[#1e3a8a] text-white p-6 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 bottom-0 w-36 bg-orange-500/10 skew-x-12 -z-0"></div>
          <div>
            <div className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3">
              <Zap className="w-3 h-3 fill-white" /> Fast-Track Tatkal
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-1">
              Tatkal Reservation Opens Daily
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              <strong>10:00 AM IST</strong> for AC Classes (1A, 2A, 3A, CC, EC) & <strong>11:00 AM IST</strong> for Non-AC Classes (Sleeper, Second Sitting). Complete profile details beforehand for 1-click booking!
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchParams(prev => ({ ...prev, quota: 'TQ' }));
              setActiveView('results');
            }}
            className="self-start px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Book Tatkal Quota</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Vande Bharat Express Banner */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1 bg-purple-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3">
              <Sparkles className="w-3 h-3" /> Premium Travel
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-1">
              Vande Bharat 2.0 Fleet
            </h3>
            <p className="text-xs text-purple-200 leading-relaxed mb-4">
              Experience world-class indigenous semi-high speed trains with 180-degree rotating seats, Kavach collision avoidance system, bio-vacuum toilets, and onboard Wi-Fi infotainment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchParams(prev => ({ ...prev, fromStation: 'NDLS', toStation: 'BSB' }));
              setActiveView('results');
            }}
            className="self-start px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Vande Bharat Routes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Popular Train Routes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[#0f2c59] flex items-center gap-2">
              <span className="w-2 h-5 bg-[#0f2c59] rounded-xs"></span>
              Popular High-Demand Routes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Top searched daily Indian Railways trains with high seat availability</p>
          </div>
          <button
            onClick={() => setActiveView('results')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularRoutes.map((route, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSearchParams(prev => ({ ...prev, fromStation: route.from, toStation: route.to }));
                setActiveView('results');
              }}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-[#0f2c59] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                    {route.tag}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">{route.duration}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#0f2c59] transition-colors leading-snug">
                  {route.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">{route.train}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Starts from <strong className="text-emerald-700 font-bold">{route.fare}</strong></span>
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">➔</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Official IRCTC Key Passenger Services */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-center text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">
          Official Indian Railways Digital Passenger Services
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white rounded-xl shadow-2xs border border-slate-200">
            <ShieldCheck className="w-7 h-7 text-[#0f2c59] mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">Aadhaar Verified</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Up to 24 tickets / month</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-2xs border border-slate-200">
            <Utensils className="w-7 h-7 text-orange-600 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">e-Catering</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Fresh food at seat</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-2xs border border-slate-200">
            <CreditCard className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">IRCTC iPay</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Zero payment failure gateway</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-2xs border border-slate-200">
            <Award className="w-7 h-7 text-purple-600 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800">Travel Insurance</div>
            <div className="text-[11px] text-slate-500 mt-0.5">₹10 Lakh cover at ₹0.45</div>
          </div>
        </div>
      </div>
    </div>
  );
}
