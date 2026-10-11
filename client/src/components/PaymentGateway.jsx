import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  QrCode, 
  Landmark, 
  Wallet, 
  Lock, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Smartphone, 
  ChevronRight, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';

export default function PaymentGateway() {
  const { 
    user,
    selectedTrain, 
    selectedClass, 
    searchParams, 
    passengers, 
    calculateFare, 
    paymentMethod, 
    confirmBooking, 
    setActiveView 
  } = useBooking();

  const fare = calculateFare();

  // Active payment tab: 'UPI' | 'CARDS' | 'NET_BANKING' | 'WALLET'
  const [activeTab, setActiveTab] = useState('UPI');

  // Form states dynamically derived from authenticated user / primary passenger
  const defaultUpi = user?.username 
    ? `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@okaxis` 
    : (passengers?.[0]?.name ? `${passengers[0].name.toLowerCase().replace(/[^a-z0-9]/g, '')}@okaxis` : 'passenger@okaxis');

  const defaultCardName = (user?.name || passengers?.[0]?.name || 'IRCTC CARDHOLDER').toUpperCase();

  const [upiId, setUpiId] = useState(defaultUpi);
  const [selectedBank, setSelectedBank] = useState('SBI');
  const [cardData, setCardData] = useState({
    number: '4532 8921 4452 7819',
    name: defaultCardName,
    expiry: '08/29',
    cvv: '842',
  });

  // Session timer countdown (starts at 5 mins: 300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);

  // Transaction processing modal states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(''); // 'CONNECTING' | 'OTP' | 'CONFIRMING' | 'SUCCESS'
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCardNumberChange = (val) => {
    const clean = val.replace(/\D/g, '').substring(0, 16);
    const parts = clean.match(/.{1,4}/g) || [];
    setCardData(prev => ({ ...prev, number: parts.join(' ') }));
  };

  const handleExpiryChange = (val) => {
    const clean = val.replace(/\D/g, '').substring(0, 4);
    if (clean.length >= 2) {
      setCardData(prev => ({ ...prev, expiry: `${clean.substring(0, 2)}/${clean.substring(2)}` }));
    } else {
      setCardData(prev => ({ ...prev, expiry: clean }));
    }
  };

  const startPaymentFlow = () => {
    setIsProcessing(true);
    setProcessingStage('CONNECTING');

    setTimeout(() => {
      setProcessingStage('OTP');
      setOtpInput('');
    }, 1200);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.length < 4) {
      setOtpError('Please enter the 6-digit bank verification OTP.');
      return;
    }

    setOtpError('');
    setProcessingStage('CONFIRMING');

    setTimeout(() => {
      setProcessingStage('SUCCESS');
      setTimeout(() => {
        setIsProcessing(false);
        confirmBooking({
          mode: activeTab === 'UPI' 
            ? 'UPI (BHIM / GPay)' 
            : activeTab === 'CARDS' 
            ? 'Card Payment (RuPay/Visa)' 
            : activeTab === 'NET_BANKING' 
            ? `Net Banking (${selectedBank})` 
            : 'IRCTC e-Wallet',
        });
      }, 1000);
    }, 1400);
  };

  const popularBanks = [
    { code: 'SBI', name: 'State Bank of India', color: 'bg-blue-600' },
    { code: 'HDFC', name: 'HDFC Bank', color: 'bg-indigo-900' },
    { code: 'ICICI', name: 'ICICI Bank', color: 'bg-orange-600' },
    { code: 'AXIS', name: 'Axis Bank', color: 'bg-rose-900' },
    { code: 'PNB', name: 'Punjab National Bank', color: 'bg-amber-800' },
    { code: 'BOB', name: 'Bank of Baroda', color: 'bg-orange-500' },
  ];

  if (!selectedTrain || !selectedClass) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-xl shadow-md border text-center">
        <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No Booking Active</h3>
        <p className="text-xs text-slate-500 mb-4">Please select a train and passenger details first.</p>
        <button
          onClick={() => setActiveView('search')}
          className="bg-[#0f2c59] text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-[#1a4484] cursor-pointer"
        >
          Go to Train Search
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setActiveView('passenger')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0f2c59] mb-4 group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Return to Passenger Details</span>
      </button>

      {/* Gateway Top Status Strip */}
      <div className="bg-[#0f2c59] text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
            <Lock className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span>IRCTC iPay Secure Payment Gateway</span>
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wide">
                256-BIT ENCRYPTED
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Transaction ID: <span className="font-mono text-amber-300">TXN{Math.floor(10000000 + Math.random() * 90000000)}</span>
            </p>
          </div>
        </div>

        {/* Timer Box */}
        <div className="flex items-center gap-2 bg-[#1a3d72] px-3.5 py-2 rounded-lg border border-slate-700">
          <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-300 font-medium">Session Expires In</div>
            <div className="font-mono font-black text-amber-300 text-sm">
              {formatTimer(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Payment Mode Selection & Details (Col 1-8) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          {/* Channel Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('UPI')}
              className={`flex-1 py-3 px-3 text-center border-b-2 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'UPI'
                  ? 'border-orange-500 text-orange-600 bg-white font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>UPI / QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CARDS')}
              className={`flex-1 py-3 px-3 text-center border-b-2 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'CARDS'
                  ? 'border-orange-500 text-orange-600 bg-white font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Debit / Credit / RuPay</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('NET_BANKING')}
              className={`flex-1 py-3 px-3 text-center border-b-2 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'NET_BANKING'
                  ? 'border-orange-500 text-orange-600 bg-white font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Net Banking</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WALLET')}
              className={`flex-1 py-3 px-3 text-center border-b-2 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'WALLET'
                  ? 'border-orange-500 text-orange-600 bg-white font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>IRCTC e-Wallet</span>
            </button>
          </div>

          <div className="p-6">
            {/* TAB 1: UPI & QR CODE */}
            {activeTab === 'UPI' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  {/* Left: Dynamic QR Code Box */}
                  <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-xs border border-slate-200">
                    <div className="w-40 h-40 bg-slate-900 p-2 rounded-lg flex items-center justify-center relative group">
                      {/* Realistic SVG QR Pattern */}
                      <svg className="w-full h-full text-white" viewBox="0 0 100 100" fill="currentColor">
                        {/* Position Markers */}
                        <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5"/>
                        <rect x="10" y="10" width="15" height="15"/>
                        <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5"/>
                        <rect x="75" y="10" width="15" height="15"/>
                        <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5"/>
                        <rect x="10" y="75" width="15" height="15"/>
                        {/* Data matrix dots simulation */}
                        <circle cx="45" cy="15" r="3"/>
                        <circle cx="55" cy="20" r="3"/>
                        <circle cx="40" cy="35" r="3"/>
                        <circle cx="60" cy="40" r="3"/>
                        <circle cx="50" cy="50" r="4"/>
                        <circle cx="35" cy="65" r="3"/>
                        <circle cx="65" cy="65" r="3"/>
                        <circle cx="80" cy="45" r="3"/>
                        <circle cx="20" cy="45" r="3"/>
                        <circle cx="45" cy="80" r="3"/>
                        <circle cx="55" cy="85" r="3"/>
                      </svg>
                      {/* Center Brand Icon */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-9 h-9 rounded-full bg-orange-600 border-2 border-white flex items-center justify-center shadow-md">
                          <span className="text-[9px] font-black text-white">iPay</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-xs font-bold text-slate-800">Scan & Pay ₹{fare.totalFare}</span>
                      <p className="text-[10px] text-slate-500">BHIM, GPay, PhonePe, Paytm</p>
                    </div>
                  </div>

                  {/* Right: Enter UPI ID */}
                  <div className="flex-1 w-full space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Or Enter Virtual Payment Address (UPI ID)
                    </h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okaxis"
                        className="w-full px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      A payment request notification will be sent directly to your UPI mobile app.
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['@okaxis', '@okhdfcbank', '@paytm', '@ybl', '@ibl'].map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          onClick={() => {
                            const prefix = upiId.split('@')[0] || (user?.username || 'passenger');
                            setUpiId(`${prefix}${handle}`);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono cursor-pointer"
                        >
                          {handle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Instant Pay button */}
                <button
                  type="button"
                  onClick={startPaymentFlow}
                  className="w-full py-3 bg-[#0f2c59] hover:bg-[#1a4484] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-orange-400" />
                  <span>PAY ₹{fare.totalFare} VIA UPI / QR CODE</span>
                </button>
              </div>
            )}

            {/* TAB 2: DEBIT / CREDIT / RUPAY CARDS */}
            {activeTab === 'CARDS' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-md max-w-sm mx-auto space-y-4">
                  <div className="flex justify-between items-center text-xs text-slate-300">
                    <span>IRCTC RuPay / Visa / Mastercard</span>
                    <span className="font-mono font-bold text-orange-400">DEBIT / CREDIT</span>
                  </div>
                  <div className="font-mono tracking-widest text-lg font-bold">
                    {cardData.number || '•••• •••• •••• ••••'}
                  </div>
                  <div className="flex justify-between items-end text-xs">
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Cardholder</div>
                      <div className="font-bold tracking-wide truncate max-w-[160px]">{cardData.name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Expires</div>
                      <div className="font-mono font-bold">{cardData.expiry || 'MM/YY'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardData.number}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      placeholder="4532 8921 4452 7819"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardData.name}
                      onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                      placeholder="NAME AS PRINTED ON CARD"
                      className="w-full px-3 py-2 text-xs uppercase border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Valid Thru (MM/YY)
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={cardData.expiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      CVV / Security Code
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardData.cvv}
                      onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                      placeholder="3 digits"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startPaymentFlow}
                  className="w-full mt-3 py-3 bg-[#0f2c59] hover:bg-[#1a4484] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-orange-400" />
                  <span>PAY ₹{fare.totalFare} WITH CARD</span>
                </button>
              </div>
            )}

            {/* TAB 3: NET BANKING */}
            {activeTab === 'NET_BANKING' && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Select Popular Bank
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {popularBanks.map((b) => (
                    <div
                      key={b.code}
                      onClick={() => setSelectedBank(b.code)}
                      className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                        selectedBank === b.code
                          ? 'border-[#0f2c59] bg-[#0f2c59]/5 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full ${b.color} shrink-0`}></div>
                      <span className="text-xs text-slate-800">{b.name}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Or Choose from Other Indian Banks
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59] cursor-pointer"
                  >
                    <option value="SBI">State Bank of India</option>
                    <option value="HDFC">HDFC Bank Ltd</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="AXIS">Axis Bank</option>
                    <option value="KOTAK">Kotak Mahindra Bank</option>
                    <option value="IDBI">IDBI Bank</option>
                    <option value="CANARA">Canara Bank</option>
                    <option value="UNION">Union Bank of India</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={startPaymentFlow}
                  className="w-full mt-3 py-3 bg-[#0f2c59] hover:bg-[#1a4484] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Landmark className="w-4 h-4 text-orange-400" />
                  <span>PROCEED WITH {selectedBank} NET BANKING</span>
                </button>
              </div>
            )}

            {/* TAB 4: IRCTC e-WALLET */}
            {activeTab === 'WALLET' && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-orange-950">IRCTC Registered e-Wallet</div>
                    <div className="text-[11px] text-orange-700 mt-0.5">Linked to {user?.username || 'IRCTC Passenger'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Available Balance</div>
                    <div className="text-base font-black text-emerald-700">₹8,450.00</div>
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  Direct debit from your registered IRCTC wallet with zero transaction charges and instant 1-click tatkal checkout.
                </p>

                <button
                  type="button"
                  onClick={startPaymentFlow}
                  className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  <span>PAY ₹{fare.totalFare} FROM e-WALLET</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Journey & Fare Snapshot (Col 9-12) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">
              Booking Review Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900 text-sm">{selectedTrain.trainName}</div>
              <div className="text-slate-500 font-mono">#{selectedTrain.trainNumber} • {selectedClass.classType} • {searchParams.quota} Quota</div>
              
              <div className="flex justify-between py-2 border-y border-slate-100 text-slate-700 font-semibold">
                <span>{searchParams.fromStation} ➔ {searchParams.toStation}</span>
                <span>{searchParams.journeyDate}</span>
              </div>

              <div className="text-slate-600">
                <span className="font-semibold">{passengers.length} Passenger(s):</span>
                <ul className="mt-1 space-y-0.5 text-[11px] list-disc list-inside text-slate-500">
                  {passengers.map((p, i) => (
                    <li key={p.id || i}>{p.name || `Passenger ${i + 1}`} ({p.age || '30'}y, {p.gender})</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-700">Total Payable:</span>
              <span className="text-xl font-black text-[#0f2c59]">₹{fare.totalFare}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA BANK OTP MODAL SIMULATION */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-[#0f2c59] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold">RBI 2-Factor Bank Authentication</span>
              </div>
              <span className="font-mono text-xs text-amber-300">₹{fare.totalFare}</span>
            </div>

            <div className="p-6 text-center space-y-4">
              {processingStage === 'CONNECTING' && (
                <div className="py-8 space-y-3">
                  <div className="w-12 h-12 border-4 border-[#0f2c59] border-t-orange-500 rounded-full animate-spin mx-auto"></div>
                  <h4 className="text-sm font-bold text-slate-800">Connecting to Bank Gateway...</h4>
                  <p className="text-xs text-slate-500">Establishing 256-bit encrypted handshake with issuing bank.</p>
                </div>
              )}

              {processingStage === 'OTP' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Enter Bank One Time Password (OTP)</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      A 6-digit OTP has been dispatched to mobile registered with your bank.
                    </p>
                  </div>

                  <div className="max-w-[200px] mx-auto">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      autoFocus
                      className="w-full text-center tracking-[0.5em] font-mono text-lg font-bold py-2 border-2 border-slate-300 rounded-lg focus:outline-hidden focus:border-[#0f2c59]"
                    />
                  </div>

                  {otpError && (
                    <div className="text-xs text-red-600 font-semibold flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpInput('729104')}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer"
                    >
                      Fill Demo OTP (729104)
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer"
                    >
                      VERIFY & CONFIRM
                    </button>
                  </div>
                </form>
              )}

              {processingStage === 'CONFIRMING' && (
                <div className="py-8 space-y-3">
                  <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <h4 className="text-sm font-bold text-slate-800">Verifying Bank Authorization...</h4>
                  <p className="text-xs text-slate-500">Allocating PNR berth inventory from CRIS PRS reservation engine.</p>
                </div>
              )}

              {processingStage === 'SUCCESS' && (
                <div className="py-8 space-y-3">
                  <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto animate-bounce" />
                  <h4 className="text-base font-bold text-slate-900">Payment Authorized Successfully!</h4>
                  <p className="text-xs text-slate-500">Generating Indian Railways Electronic Reservation Slip (ERS)...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
