import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, Train } from 'lucide-react';
import { useBooking } from '../context/BookingContext';

const initialForm = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  age: '',
  gender: 'MALE',
  phone_no: '',
};

export default function RegisterPage() {
  const { loginUser, setActiveView } = useBooking();
  const [form, setForm] = useState(initialForm);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(form.phone_no)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!Number.isInteger(Number(form.age)) || Number(form.age) < 18) {
      setError('You must be at least 18 years old to create an account.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, age: Number(form.age) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Could not create the account.');
        return;
      }

      // The current development API returns its generated OTP in the response.
      setOtp(data.OTP ? String(data.OTP) : '');
      setOtpSent(true);
    } catch (requestError) {
      setError('The registration service is unavailable. Please try again shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, age: Number(form.age), entered_otp: otp }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'OTP verification failed.');
        return;
      }
      loginUser(data.data, data.token);
    } catch (requestError) {
      setError('The verification service is unavailable. Please try again shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900 text-white shadow-lg mb-4 ring-4 ring-blue-100">
          <Train className="w-8 h-8 text-orange-400" />
        </div>
        <h1 className="text-2xl font-black text-blue-950 sm:text-3xl">Create Your IRCTC Account</h1>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200/80 sm:px-8">
        {!otpSent ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" value={form.fullName} onChange={(value) => updateField('fullName', value)} />
              <Field label="User Name" value={form.username} onChange={(value) => updateField('username', value.toLowerCase())} />
            </div>
            <Field label="Email Address" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
            <Field label="Password" type="password" value={form.password} onChange={(value) => updateField('password', value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" type="number" min="18" value={form.age} onChange={(value) => updateField('age', value)} />
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">Gender</label>
                <select value={form.gender} onChange={(event) => updateField('gender', event.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <Field label="Mobile Number" inputMode="numeric" maxLength="10" value={form.phone_no} onChange={(value) => updateField('phone_no', value.replace(/\D/g, ''))} />
            <AuthError error={error} />
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl disabled:opacity-50 flex justify-center items-center gap-2">
              <span>{isLoading ? 'SENDING OTP...' : 'CONTINUE TO VERIFY'}</span><ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div className="text-center text-sm text-slate-600"><CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />OTP sent for <strong>{form.phone_no}</strong>.</div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">One-Time Password</label>
              <div className="relative"><KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input autoFocus inputMode="numeric" maxLength="6" value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '')); setError(''); }} className="w-full pl-10 py-2.5 font-mono tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
            </div>
            <AuthError error={error} />
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl disabled:opacity-50 flex justify-center items-center gap-2"><ShieldCheck className="w-4 h-4" /><span>{isLoading ? 'VERIFYING...' : 'VERIFY & CREATE ACCOUNT'}</span></button>
          </form>
        )}
        <button type="button" onClick={() => setActiveView('login')} className="mt-5 w-full flex justify-center items-center gap-1.5 text-sm font-semibold text-blue-800 hover:underline"><ArrowLeft className="w-4 h-4" />Back to login</button>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, ...props }) {
  return <div><label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">{label}</label><input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600" {...props} /></div>;
}

function AuthError({ error }) {
  return error ? <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div> : null;
}
