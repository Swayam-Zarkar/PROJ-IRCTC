import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpenCheck, CalendarDays, History, Mail, Phone, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useBooking } from '../context/BookingContext';

const blankPassenger = { name: '', age: '', gender: 'MALE', berthPreference: 'NO_PREFERENCE' };

export default function ProfilePage() {
  const { user, updateUser, pnrHistory, setActiveView } = useBooking();
  const [savedPassengers, setSavedPassengers] = useState(user?.savedPassengers || []);
  const [newPassenger, setNewPassenger] = useState(blankPassenger);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  useEffect(() => {
    if (!user?.token) return;
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include', headers: authHeaders });
        const data = await response.json();
        if (response.ok && data.success) {
          const nextSavedPassengers = data.data.savedPassengers || [];
          setSavedPassengers(nextSavedPassengers);
          updateUser({ ...data.data, savedPassengers: nextSavedPassengers });
        }
      } catch (_) {
        // The locally cached profile remains available while the API is offline.
      }
    };
    loadProfile();
  }, [user?.token]);

  const savePassenger = async (event) => {
    event.preventDefault();
    if (!newPassenger.name.trim() || !newPassenger.age) {
      setMessage('Enter the passenger name and age.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/passengers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...newPassenger, name: newPassenger.name.trim(), age: Number(newPassenger.age) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || 'Could not save this passenger.');
        return;
      }
      setSavedPassengers(data.savedPassengers);
      updateUser({ savedPassengers: data.savedPassengers });
      setNewPassenger(blankPassenger);
      setMessage('Passenger saved to your Master Passenger List.');
    } catch (_) {
      setMessage('The profile service is unavailable. Please try again shortly.');
    } finally {
      setIsSaving(false);
    }
  };

  const removePassenger = async (passengerId) => {
    try {
      const response = await fetch(`/api/auth/passengers/${passengerId}`, { method: 'DELETE', credentials: 'include', headers: authHeaders });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || 'Could not remove this passenger.');
        return;
      }
      setSavedPassengers(data.savedPassengers);
      updateUser({ savedPassengers: data.savedPassengers });
    } catch (_) {
      setMessage('The profile service is unavailable. Please try again shortly.');
    }
  };

  const currentUserId = user?.userId || user?._id || user?.username;
  const bookings = pnrHistory
    .filter((booking) => booking.userId === currentUserId)
    .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <button type="button" onClick={() => setActiveView('search')} className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold text-slate-600 hover:text-[#0f2c59] cursor-pointer"><ArrowLeft className="w-4 h-4" />Back to train search</button>

      <section className="bg-[#0f2c59] text-white p-5 rounded-xl shadow-md mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-black">{user?.name?.charAt(0) || 'U'}</div>
          <div className="min-w-0 flex-1"><h1 className="text-xl font-bold">{user?.name || 'IRCTC Passenger'}</h1><p className="text-sm text-slate-300">{user?.username} <span className="text-orange-400 mx-1">|</span> {user?.irctcId}</p></div>
          <div className="flex gap-5 text-xs"><div><div className="text-slate-400">Master Passengers</div><div className="font-bold text-amber-300 text-lg">{savedPassengers.length}</div></div><div><div className="text-slate-400">Bookings</div><div className="font-bold text-amber-300 text-lg">{bookings.length}</div></div></div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><UserRound className="w-4 h-4 text-orange-600" /><h2 className="font-bold text-slate-800 text-sm">Profile Details</h2></div>
            <dl className="p-5 space-y-4 text-sm"><Detail icon={Mail} label="Email" value={user?.email} /><Detail icon={Phone} label="Mobile" value={user?.mobile || user?.phone_no} /><Detail icon={CalendarDays} label="Age / Gender" value={[user?.age, user?.gender].filter(Boolean).join(' / ') || 'Not provided'} /><Detail icon={BookOpenCheck} label="IRCTC User ID" value={user?.username} /></dl>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><Plus className="w-4 h-4 text-orange-600" /><h2 className="font-bold text-slate-800 text-sm">Save a Passenger</h2></div>
            <form onSubmit={savePassenger} className="p-5 space-y-3"><ProfileInput placeholder="Full name" value={newPassenger.name} onChange={(value) => setNewPassenger((current) => ({ ...current, name: value }))} /><div className="grid grid-cols-2 gap-3"><ProfileInput placeholder="Age" type="number" min="1" max="120" value={newPassenger.age} onChange={(value) => setNewPassenger((current) => ({ ...current, age: value }))} /><select value={newPassenger.gender} onChange={(event) => setNewPassenger((current) => ({ ...current, gender: event.target.value }))} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50"><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div><select value={newPassenger.berthPreference} onChange={(event) => setNewPassenger((current) => ({ ...current, berthPreference: event.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50"><option value="NO_PREFERENCE">No berth preference</option><option value="LOWER">Lower berth</option><option value="MIDDLE">Middle berth</option><option value="UPPER">Upper berth</option><option value="SIDE_LOWER">Side lower berth</option><option value="SIDE_UPPER">Side upper berth</option><option value="WINDOW">Window seat</option></select><button disabled={isSaving} className="w-full py-2.5 rounded-lg text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 cursor-pointer">{isSaving ? 'SAVING...' : 'SAVE PASSENGER'}</button></form>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"><div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><Users className="w-4 h-4 text-orange-600" /><h2 className="font-bold text-slate-800 text-sm">Master Passenger List</h2></div><div className="divide-y divide-slate-100">{savedPassengers.length ? savedPassengers.map((passenger) => <div key={passenger._id} className="px-5 py-3 flex items-center justify-between gap-3"><div><div className="font-semibold text-sm text-slate-800">{passenger.name}</div><div className="text-xs text-slate-500">{passenger.age} years <span className="mx-1">|</span> {passenger.gender} <span className="mx-1">|</span> {passenger.berthPreference.replace(/_/g, ' ')}</div></div><button type="button" title="Remove saved passenger" onClick={() => removePassenger(passenger._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"><Trash2 className="w-4 h-4" /></button></div>) : <EmptyState text="Save frequent travelers here for faster ticket booking." />}</div></section>
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"><div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-orange-600" /><h2 className="font-bold text-slate-800 text-sm">Recent Travel History</h2></div><div className="divide-y divide-slate-100">{bookings.length ? bookings.slice(0, 8).map((booking) => <div key={booking.pnr} className="px-5 py-4 flex flex-wrap gap-3 items-center justify-between"><div><div className="font-semibold text-sm text-slate-800">{booking.trainName} <span className="font-mono text-slate-500">#{booking.trainNumber}</span></div><div className="text-xs text-slate-500 mt-1">{booking.fromStationName} ({booking.fromStation}) to {booking.toStationName} ({booking.toStation}) <span className="mx-1">|</span> {booking.journeyDate}</div></div><div className="text-right"><div className="text-xs font-bold text-emerald-700">{booking.bookingStatus}</div><div className="text-[11px] text-slate-500 font-mono">PNR {booking.pnr}</div></div></div>) : <EmptyState text="Your completed and upcoming bookings will appear here." />}</div></section>
        </div>
      </div>
      {message && <div className="fixed bottom-5 right-5 max-w-sm bg-slate-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg">{message}</div>}
    </div>
  );
}

function Detail({ icon: Icon, label, value }) { return <div className="flex gap-3"><Icon className="w-4 h-4 text-slate-400 mt-0.5" /><div><dt className="text-[11px] uppercase font-bold tracking-wide text-slate-500">{label}</dt><dd className="font-semibold text-slate-800 break-all">{value || 'Not provided'}</dd></div></div>; }
function ProfileInput({ value, onChange, ...props }) { return <input required value={value} onChange={(event) => onChange(event.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f2c59]" {...props} />; }
function EmptyState({ text }) { return <div className="px-5 py-8 text-center text-sm text-slate-500">{text}</div>; }
