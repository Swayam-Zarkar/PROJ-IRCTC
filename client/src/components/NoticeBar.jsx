import React from 'react';
import { AlertTriangle, Bell, Zap, ShieldAlert } from 'lucide-react';

export default function NoticeBar() {
  const notices = [
    {
      id: 1,
      badge: 'TATKAL TIMINGS',
      text: 'AC Tatkal (1A/2A/3A/CC/EC) opens at 10:00 AM IST. Non-AC Tatkal (SL/2S) opens at 11:00 AM IST daily.',
      isAlert: true,
    },
    {
      id: 2,
      badge: 'AADHAAR VERIFICATION',
      text: 'Users with Aadhaar-linked IRCTC profiles can book up to 24 tickets per month.',
      isAlert: false,
    },
    {
      id: 3,
      badge: 'SAFETY ADVISORY',
      text: 'Never share OTP, MPIN, or IRCTC password with anyone. CRIS & IRCTC never request passwords via SMS or call.',
      isAlert: false,
    },
  ];

  return (
    <div className="bg-amber-50 border-b border-amber-200 py-1.5 px-4 text-xs text-amber-950 overflow-hidden select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {/* Ticker Icon Tag */}
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded shrink-0">
          <Bell className="w-3.5 h-3.5 text-orange-600 animate-bounce" />
          <span className="hidden sm:inline">Official Advisories</span>
        </div>

        {/* Marquee ticker stream */}
        <div className="flex-1 overflow-x-auto no-scrollbar flex items-center space-x-6 whitespace-nowrap text-xs py-0.5">
          {notices.map((n) => (
            <div key={n.id} className="inline-flex items-center space-x-2 shrink-0">
              <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                n.isAlert ? 'bg-orange-600 text-white' : 'bg-slate-700 text-white'
              }`}>
                {n.badge}
              </span>
              <span className="font-medium text-slate-800">{n.text}</span>
              <span className="text-amber-400 font-bold ml-2">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
