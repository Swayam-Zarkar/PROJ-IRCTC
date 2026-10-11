import React, { useState, useEffect, useRef } from 'react';
import { useBooking } from '../context/BookingContext';
import {
  Lock,
  User,
  Phone,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Train,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const { loginUser, setActiveView } = useBooking();

  // Mode: 'PASSWORD' or 'OTP'
  const [authMode, setAuthMode] = useState('PASSWORD');

  // Input states - strictly empty initial state (no hardcoded credentials)
  const [identifier, setIdentifier] = useState(''); // Username, Mobile, or Email
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Errors
  const [captchaCode, setCaptchaCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const canvasRef = useRef(null);

  // Generate random 5-character alphanumeric CAPTCHA
  const generateCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setCaptchaInput('');
    drawCaptchaCanvas(code);
  };

  // Draw authentic government noisy CAPTCHA on HTML5 canvas
  const drawCaptchaCanvas = (code) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Random noise lines
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 50%, 65%)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.bezierCurveTo(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * canvas.width,
        Math.random() * canvas.height
      );
      ctx.stroke();
    }

    // Random noise dots
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 150)}, ${Math.floor(Math.random() * 150)}, 0.4)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render characters with distortion & color variety
    const fonts = ['bold 22px monospace', 'bold 24px sans-serif', 'bold 20px serif'];
    const colors = ['#1e3a8a', '#b45309', '#047857', '#6d28d9', '#be123c'];

    for (let i = 0; i < code.length; i++) {
      ctx.save();
      const char = code[i];
      const x = 20 + i * 22;
      const y = 28 + (Math.random() * 6 - 3);
      const angle = (Math.random() * 24 - 12) * (Math.PI / 180);

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = fonts[i % fonts.length];
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Timer countdown for OTP
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const handleSendOtp = () => {
    if (!identifier.trim()) {
      setError('Please enter your Mobile Number or IRCTC User ID.');
      return;
    }
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      setOtpCountdown(30);
      setOtp('482910'); // Simulated OTP auto-hint for convenience
    }, 600);
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your User ID or Mobile Number.');
      return;
    }

    // Verify Captcha (case-insensitive for user comfort)
    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setError('Incorrect CAPTCHA entered. Please try again.');
      generateCaptcha();
      return;
    }

    if (authMode === 'PASSWORD') {
      if (!password) {
        setError('Please enter your account password.');
        return;
      }
    } else {
      if (!otp) {
        setError('Please enter the OTP sent to your registered mobile.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: cleanId,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        loginUser(
          data.data,
          data.token
        );
        return;
      }
      setError(data.message || 'Unable to sign in with those credentials.');
    } catch (err) {
      setError('The authentication service is unavailable. Please try again shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* IRCTC Crest */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900 text-white shadow-lg mb-4 ring-4 ring-blue-100">
          <Train className="w-8 h-8 text-orange-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">
          IRCTC Next Generation eTicketing
        </h1>
        <p className="mt-1.5 text-xs text-slate-500 font-medium">
          CRIS Passenger Reservation System (PRS) • Government of India
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200/80 sm:px-8 relative overflow-hidden">
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-900 via-orange-500 to-emerald-600"></div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('PASSWORD');
                setError('');
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                authMode === 'PASSWORD'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => setActiveView('register')}
              className="py-2 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-slate-900"
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* User ID / Mobile Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                User Name / Registered Mobile
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  {authMode === 'OTP' ? (
                    <Phone className="h-4 w-4 text-slate-400" />
                  ) : (
                    <User className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={authMode === 'OTP' ? 'Enter 10-Digit Mobile Number' : 'Enter IRCTC User ID / Mobile'}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Field (for Password Mode) */}
            {authMode === 'PASSWORD' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('To reset password on official IRCTC portal, use registered mobile OTP.');
                    }}
                    className="text-[11px] font-semibold text-blue-800 hover:underline"
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter account password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* OTP Field (for OTP Mode) */}
            {authMode === 'OTP' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    One-Time Password (OTP)
                  </label>
                  {otpSent && otpCountdown > 0 && (
                    <span className="text-xs text-slate-500 font-mono">Resend in {otpCountdown}s</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1 rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/[^0-9]/g, ''));
                        if (error) setError('');
                      }}
                      placeholder="6-Digit OTP"
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-bold tracking-wider placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || (otpSent && otpCountdown > 0)}
                    onClick={handleSendOtp}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-blue-900 text-xs font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer border border-slate-300"
                  >
                    {otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>
                {otpSent && (
                  <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                    ✓ Simulated OTP auto-filled: <strong>482910</strong>
                  </p>
                )}
              </div>
            )}

            {/* Government Portal Captcha Box */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Security Captcha Verification
              </label>
              <div className="flex items-center gap-3">
                {/* Canvas Captcha Box */}
                <div className="relative bg-slate-100 border border-slate-300 rounded-xl p-1 flex items-center justify-center shadow-inner overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={140}
                    height={40}
                    className="rounded-lg select-none"
                  />
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    title="Refresh Captcha"
                    className="ml-2 p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Input */}
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={captchaInput}
                  onChange={(e) => {
                    setCaptchaInput(e.target.value.toUpperCase());
                    if (error) setError('');
                  }}
                  placeholder="Enter Captcha"
                  className="flex-1 py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-bold tracking-widest uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-center"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm tracking-wide cursor-pointer disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>SIGN IN SECURELY</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Security & Aadhaar Note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Aadhaar-authenticated booking allows up to 24 tickets per month</span>
        </div>
      </div>
    </div>
  );
}
