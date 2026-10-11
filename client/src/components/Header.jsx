import React, { useState, useEffect } from 'react';
import { 
  Train, 
  Search, 
  FileText, 
  Clock, 
  User, 
  LogOut, 
  ShieldCheck, 
  PhoneCall, 
  Globe, 
  Menu, 
  X,
  Zap
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';

export default function Header() {
  const { activeView, setActiveView, user, logoutUser } = useBooking();
  const [currentTime, setCurrentTime] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real-time IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const formatted = new Intl.DateTimeFormat('en-IN', options).format(now);
      setCurrentTime(`${formatted} [IST]`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'search', label: 'Book Ticket', icon: Train },
    { id: 'pnr-status', label: 'PNR Status', icon: Search },
    { id: 'charts', label: 'Charts / Vacancy', icon: FileText },
  ];

  return (
    <header className="w-full bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      {/* Top Utility Bar (Govt of India / Railway Ministry standard) */}
      <div className="bg-[#0f2c59] text-slate-200 text-xs px-4 py-1.5 border-b border-[#0a1e3f]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Govt Affiliation */}
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-amber-300 tracking-wide flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              भारत सरकार | Government of India
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline text-slate-300">रेल मंत्रालय | Ministry of Railways</span>
          </div>

          {/* Right: Helpline & IST Clock */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-1.5 text-slate-300">
              <PhoneCall className="w-3.5 h-3.5 text-orange-400" />
              <span>RailMadad: <strong className="text-white">139</strong> / IRCTC Care: <strong className="text-white">14646</strong></span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-200 font-mono text-[11px] bg-[#1a3d72] px-2 py-0.5 rounded">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>{currentTime || '02-Oct-2026 [12:30:00 IST]'}</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1 text-slate-300 hover:text-white cursor-pointer text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>हिंदी / English</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main IRCTC Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setActiveView(user ? 'search' : 'login')} 
          className="flex items-center space-x-3 cursor-pointer select-none group"
        >
          {/* Logo Badge */}
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#1e3a8a] to-[#0f2c59] flex items-center justify-center shadow-md border-2 border-orange-500/80 group-hover:scale-105 transition-transform">
            <Train className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-wider text-[#0f2c59]">IRCTC</span>
              <span className="text-xs font-bold uppercase bg-gradient-to-r from-orange-500 to-amber-500 text-white px-1.5 py-0.5 rounded shadow-xs">
                eTicketing
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 tracking-tight">
              Indian Railway Catering and Tourism Corporation
            </p>
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'charts') {
                    alert('Charts & Vacancy is refreshed 4 hours before train departure.');
                  } else {
                    setActiveView(item.id);
                  }
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-md font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#0f2c59] text-white shadow-sm font-semibold'
                    : 'text-slate-700 hover:text-[#0f2c59] hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Quick Tatkal Highlight Button */}
          <button
            onClick={() => {
              setActiveView('search');
            }}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md border border-orange-200 transition-colors ml-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
            <span>Tatkal Booking</span>
          </button>
        </nav>

        {/* User Profile / Auth Actions */}
        <div className="hidden md:flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setActiveView('profile')}
                title="Open your profile"
                className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user.name ? user.name.charAt(0) : 'U'}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-800 leading-none flex items-center gap-1">
                    {user.name}
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{user.irctcId}</div>
                </div>
              </button>

              <button
                onClick={logoutUser}
                title="Log out of IRCTC"
                className="flex items-center space-x-1 p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200 transition-colors text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveView('login')}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>LOGIN</span>
            </button>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (item.id === 'charts') {
                    alert('Charts & Vacancy is refreshed 4 hours before train departure.');
                  } else {
                    setActiveView(item.id);
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-medium text-sm cursor-pointer ${
                  isActive
                    ? 'bg-[#0f2c59] text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-200">
            {user ? (
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <button type="button" onClick={() => { setActiveView('profile'); setMobileMenuOpen(false); }} className="text-left cursor-pointer">
                  <div className="text-xs font-bold text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{user.irctcId}</div>
                </button>
                <button
                  onClick={() => {
                    logoutUser();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveView('login');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-bold text-sm text-center cursor-pointer"
              >
                LOGIN TO BOOK
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
