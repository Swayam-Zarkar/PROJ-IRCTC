import React, { useState ,useEffect} from 'react';
import { useBooking } from '../context/BookingContext';
import {
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Share2,
  ArrowRight,
  Train,
  Clock,
  Calendar,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Download,
  RotateCcw,
  Search,
  User,
  CreditCard,
  Info,
  XCircle,
  LoaderCircle,
} from 'lucide-react';

export default function PNRConfirmation({ bookingOverride }) {
  const { currentBooking, setActiveView, setSelectedTrain, setSelectedClass, user, applyBookingCancellation } = useBooking();
  const [copied, setCopied] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [selectedPassengerIds, setSelectedPassengerIds] = useState([]);
  const [cancellationState, setCancellationState] = useState({ isSubmitting: false, error: '', result: null });

  // Allow passing in a viewed PNR (from PNR status enquiry) or default to the current newly booked one
  const booking = bookingOverride || currentBooking;

  const [liveChartStatus, setLiveChartStatus] = useState(booking?.chartStatus || 'CHART NOT PREPARED');

  // Poll backend for chart preparation background job completion
  useEffect(() => {
    if (!booking?.pnr) return;
    let isMounted = true;

    const checkLiveChartStatus = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/bookings/pnr/${booking.pnr}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (isMounted && json?.success && json?.data) {
          const status = json.data.chartStatus || (json.data.train?.chartPrepared ? 'CHART PREPARED' : null);
          if (status) {
            setLiveChartStatus(status);
          }
        }
      } catch (_) {}
    };

    checkLiveChartStatus();
    const interval = setInterval(checkLiveChartStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [booking?.pnr]);

  const handleViewSeatMap = () => {
    if (!booking) return;
    const trainNum = booking.trainNumber || (typeof booking.train === 'object' ? booking.train?.trainNumber : booking.train) || '12951';
    const jDate = booking.journeyDate ? new Date(booking.journeyDate).toISOString().split('T')[0] : '';
    const firstAssignedCoach =
      booking.passengers?.find((p) => p.allocatedCoach || p.coachNumber)?.allocatedCoach ||
      booking.passengers?.find((p) => p.allocatedCoach || p.coachNumber)?.coachNumber ||
      'B1';
    const query = new URLSearchParams({
      train: String(trainNum).trim(),
      date: jDate,
      coach: firstAssignedCoach,
      view: 'coach-map',
    }).toString();
    window.history.pushState({}, '', `?${query}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (typeof setActiveView === 'function') {
      setActiveView('coach-map');
    }
  };

  if (!booking) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Active Booking Found</h2>
        <p className="text-slate-600 mb-6">
          You don't have a newly confirmed ticket in the active session. You can search trains or look up any past 10-digit PNR.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => setActiveView('search')}
            className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Plan New Journey
          </button>
          <button
            onClick={() => setActiveView('pnr-status')}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Check PNR Status
          </button>
        </div>
      </div>
    );
  }

  const handleCopyPNR = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(booking.pnr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBookAnother = () => {
    setSelectedTrain(null);
    setSelectedClass(null);
    setActiveView('search');
  };

  const activePassengers = booking.passengers?.filter((passenger) => passenger.currentStatus !== 'CAN') || [];
  const canCancel = activePassengers.length > 0 && booking.bookingStatus !== 'CANCELLED' && !cancellationState.result;

  const openCancellation = () => {
    setSelectedPassengerIds(activePassengers.map((passenger) => String(passenger._id || passenger.id || passenger.name)));
    setCancellationState({ isSubmitting: false, error: '', result: null });
    setShowCancellation(true);
  };

  const togglePassenger = (passenger) => {
    const id = String(passenger._id || passenger.id || passenger.name);
    setSelectedPassengerIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const submitCancellation = async () => {
    if (!selectedPassengerIds.length) {
      setCancellationState((current) => ({ ...current, error: 'Select at least one passenger.' }));
      return;
    }
    setCancellationState({ isSubmitting: true, error: '', result: null });
    try {
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
      };

      // Ensure the booking is persisted in MongoDB (handles bookings created in localStorage before backend sync)
      let dbPassengers = booking.passengers || [];
      const hasDatabasePassengerIds = activePassengers.every((passenger) => passenger._id);
      if (!hasDatabasePassengerIds) {
        const syncRes = await fetch('/api/bookings/confirm', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders,
          body: JSON.stringify(booking),
        });
        const syncData = await syncRes.json().catch(() => null);
        if (syncData?.success && syncData?.data?.passengers) {
          dbPassengers = syncData.data.passengers;
        }
      }

      // Resolve selected passenger IDs to MongoDB _id or passenger name
      const resolvedPassengerIds = activePassengers
        .map((passenger, idx) => {
          const localKey = String(passenger._id || passenger.id || passenger.name);
          if (!selectedPassengerIds.includes(localKey)) return null;
          return String(passenger._id || dbPassengers[idx]?._id || passenger.name);
        })
        .filter(Boolean);

      const response = await fetch('/api/tickets/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders,
        body: JSON.stringify({
          ticketId: booking.pnr,
          passengerIds: resolvedPassengerIds,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Ticket cancellation could not be completed.');
      if (applyBookingCancellation) {
        applyBookingCancellation(booking.pnr, data.data || data);
      }
      setCancellationState({ isSubmitting: false, error: '', result: data });
    } catch (error) {
      setCancellationState({ isSubmitting: false, error: error.message, result: null });
    }
  };

  const isConfirmed = booking.bookingStatus === 'CONFIRMED';
  const isRAC = booking.bookingStatus === 'RAC';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top Banner with Confirmation Message (Hidden in Print) */}
      <div className="print:hidden mb-6 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-9 h-9 text-emerald-100" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold mb-1 border border-emerald-400/30">
              Transaction Successful • Indian Railways ERS
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Booking Confirmed!</h1>
            <p className="text-emerald-100 text-sm mt-0.5">
              SMS and email confirmation sent to {booking.contactDetails?.mobile || 'registered mobile'}.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={handleViewSeatMap}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950/80 hover:bg-blue-900 text-white font-semibold rounded-xl text-sm border border-blue-400/30 transition-colors cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-orange-400" />
            <span>Live Seat Map</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-800 hover:bg-slate-100 font-semibold rounded-xl text-sm shadow-md transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-900" />
            <span>Print ERS</span>
          </button>
          <button
            onClick={handleBookAnother}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800/80 hover:bg-emerald-900 text-white font-semibold rounded-xl text-sm border border-emerald-500/30 transition-colors cursor-pointer"
          >
            <Train className="w-4 h-4" />
            <span>Book Another</span>
          </button>
        </div>
      </div>

      {/* Official Electronic Reservation Slip (ERS) Printable Container */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden printable-area">
        {/* Ticket Header */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-900 text-white rounded-xl flex items-center justify-center font-black text-lg tracking-wider shadow-sm">
                IR
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    IRCTC e-Ticketing Service
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Electronic Reservation Slip (ERS)</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  INDIAN RAILWAYS PASSENGER RESERVATION SYSTEM
                </h2>
              </div>
            </div>

            {/* PNR & Barcode Badge */}
            <div className="bg-white border-2 border-blue-900 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  PNR Number
                </div>
                <div className="text-2xl font-black tracking-widest text-blue-950 font-mono">
                  {booking.pnr}
                </div>
              </div>
              <button
                onClick={handleCopyPNR}
                title="Copy PNR"
                className="print:hidden p-2 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Ticket Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3.5 bg-blue-50/70 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Transaction ID:</span>
            <span className="font-mono font-bold text-slate-800">{booking.paymentDetails?.transactionId || 'TXN882910481'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Quota:</span>
            <span className="font-bold text-slate-800">
              {booking.quota === 'TQ' ? 'Tatkal (TQ)' : booking.quota === 'PT' ? 'Premium Tatkal (PT)' : 'General (GN)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Booking Date:</span>
            <span className="font-semibold text-slate-800">{booking.bookedAt || 'Today'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Chart Status:</span>
            <span className={`font-bold transition-colors ${
              liveChartStatus === 'CHART PREPARED'
                ? 'text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300'
                : 'text-amber-700'
            }`}>
              {liveChartStatus}
            </span>
          </div>
        </div>

        {/* Journey Card */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50 rounded-xl p-5 border border-slate-200">
            {/* Train Info */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <Train className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-black text-blue-950">{booking.trainNumber}</span>
                  <span className="text-base font-bold text-slate-900">{booking.trainName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Class: {booking.classType}</span>
                  <span>•</span>
                  <span>Journey Date: <strong className="text-slate-800">{booking.journeyDate}</strong></span>
                  <span>•</span>
                  <span>Distance: <strong>{booking.duration || '15 hrs'}</strong></span>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <div className="text-right">
              <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase ${
                isConfirmed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isRAC
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                ● {booking.bookingStatus}
              </span>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">
                {isConfirmed ? 'Confirmed Berths Allocated' : 'Subject to charting'}
              </div>
            </div>
          </div>

          {/* Schedule Segment */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 items-center gap-4 py-4 px-2">
            {/* From */}
            <div>
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Boarding Station</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{booking.departureTime}</div>
              <div className="text-base font-bold text-blue-950 mt-0.5">
                {booking.fromStationName} ({booking.fromStation})
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{booking.journeyDate}</span>
              </div>
            </div>

            {/* Travel Line */}
            <div className="text-center px-4">
              <div className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1 mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{booking.duration}</span>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="h-0.5 w-full bg-slate-300"></div>
                <div className="absolute w-3 h-3 bg-blue-900 rounded-full border-2 border-white"></div>
                <Train className="absolute w-5 h-5 text-orange-500 -top-6" />
              </div>
              <div className="text-[11px] text-slate-400 mt-2">Direct Express Service</div>
            </div>

            {/* To */}
            <div className="md:text-right">
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Destination Station</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{booking.arrivalTime}</div>
              <div className="text-base font-bold text-blue-950 mt-0.5">
                {booking.toStationName} ({booking.toStation})
              </div>
              <div className="text-xs text-slate-500 flex items-center md:justify-end gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Destination</span>
              </div>
            </div>
          </div>
        </div>

        {/* Passenger Reservation Details Table */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-900" />
              <span>Passenger Details & Berth Allocation</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Total {booking.passengers?.length || 1} Passenger(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Passenger Name</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">Booking Status</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Coach</th>
                  <th className="py-3 px-4">Berth / Seat No</th>
                  <th className="py-3 px-4">Berth Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {booking.passengers?.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.name || `Passenger ${idx + 1}`}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {p.age} Yrs / {p.gender}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        {p.bookingStatus || 'CNF'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        p.currentStatus === 'CAN'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.currentStatus || 'CNF'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                      {p.allocatedCoach || (p.bookingStatus === 'CNF' ? 'B1' : '-')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-blue-950 text-base">
                      {p.allocatedSeatNumber || (p.waitingNumber ? `WL ${p.waitingNumber}` : '-')}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold uppercase text-slate-700">
                      {p.allocatedBerth || p.berthPreference || 'LOWER'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fare & Payment Breakdown */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Summary */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-900" />
                <span>Payment & Verification Summary</span>
              </h4>
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Gateway:</span>
                  <span className="font-semibold text-slate-800">IRCTC iPay (Verified)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-semibold text-slate-800">{booking.paymentDetails?.paymentMode || 'UPI / BHIM'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booked Mobile:</span>
                  <span className="font-semibold text-slate-800">{booking.contactDetails?.mobile || 'Not available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Travel Insurance:</span>
                  <span className="font-semibold text-emerald-700">Opted (Covered up to ₹10 Lakhs)</span>
                </div>
              </div>
            </div>

            {/* Total Fare Card */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Fare Breakdown</h4>
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Ticket Fare:</span>
                  <span className="font-semibold text-slate-800">₹{booking.fareDetails?.baseFare?.toFixed(2) || '0.00'}</span>
                </div>
                {booking.fareDetails?.tatkalCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-orange-700 font-medium">Tatkal Charges:</span>
                    <span className="font-semibold text-orange-700">₹{booking.fareDetails?.tatkalCharge?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">IRCTC Convenience Fee (Incl. GST):</span>
                  <span className="font-semibold text-slate-800">₹{booking.fareDetails?.convenienceFee?.toFixed(2) || '35.40'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Travel Insurance:</span>
                  <span className="font-semibold text-slate-800">₹{booking.fareDetails?.insurance?.toFixed(2) || '0.45'}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-900">Total Amount Paid:</span>
                  <span className="font-black text-lg text-emerald-700">
                    ₹{booking.fareDetails?.totalFare?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Passenger Instructions */}
        <div className="p-6 bg-amber-50/60 border-t border-amber-200/60">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1.5">
              <div className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
                Important Passenger Instructions
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-950/80">
                <li>One of the passengers must carry an original government-issued photo identity proof (Aadhaar, Voter ID, Driving Licence, Passport).</li>
                <li>Final chart will be prepared 4 hours prior to scheduled departure. Berths for RAC and Waitlist tickets will be finalized at chart preparation.</li>
                <li>Fully waitlisted passengers whose tickets remain waitlisted after chart preparation are not permitted to board the train.</li>
                <li>For any assistance during the journey, dial Railway Helpline <strong>139</strong> or use RailMadad app.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer (Print-hidden) */}
      <div className="print:hidden mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('pnr-status')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 text-blue-900" />
            <span>Look Up Another PNR</span>
          </button>
          <button
            onClick={handleViewSeatMap}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
            title="View exact physical berth layout for this booked train"
          >
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>View Live Seat Map</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {canCancel && <button
            onClick={openCancellation}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel Ticket</span>
          </button>}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Ticket PDF</span>
          </button>
        </div>
      </div>
      {showCancellation && <div className="print:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4" onClick={() => !cancellationState.isSubmitting && setShowCancellation(false)}>
        <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cancel-ticket-title" onClick={(event) => event.stopPropagation()}>
          {cancellationState.result ? <>
            <div className="flex items-center gap-3 text-emerald-700"><CheckCircle2 className="h-8 w-8" /><div><h2 id="cancel-ticket-title" className="text-lg font-black">Cancellation submitted</h2><p className="text-sm">PNR {booking.pnr} has been updated.</p></div></div>
            <div className="my-5 grid grid-cols-2 gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><div><p className="text-emerald-800">Refund amount</p><p className="text-xl font-black">₹{Number(cancellationState.result.refundAmount || 0).toFixed(2)}</p></div><div><p className="text-emerald-800">Deduction</p><p className="text-xl font-black">₹{Number(cancellationState.result.deduction || 0).toFixed(2)}</p></div></div>
            <button onClick={() => setShowCancellation(false)} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Done</button>
          </> : <>
            <div className="flex items-start gap-3"><div className="rounded-xl bg-rose-100 p-2 text-rose-700"><XCircle className="h-6 w-6" /></div><div><h2 id="cancel-ticket-title" className="text-lg font-black text-slate-900">Cancel ticket</h2><p className="mt-1 text-sm text-slate-600">Select the passengers to cancel. The final refund is calculated using the current cancellation rules.</p></div></div>
            <div className="my-5 space-y-2">{activePassengers.map((passenger, index) => { const id = String(passenger._id || passenger.id || passenger.name); return <label key={id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><span><span className="block text-sm font-bold text-slate-900">{passenger.name || `Passenger ${index + 1}`}</span><span className="text-xs text-slate-500">{passenger.currentStatus || passenger.bookingStatus || 'CNF'}</span></span><input type="checkbox" checked={selectedPassengerIds.includes(id)} onChange={() => togglePassenger(passenger)} className="h-4 w-4 accent-rose-600" /></label>; })}</div>
            {cancellationState.error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{cancellationState.error}</p>}
            <div className="flex gap-3"><button disabled={cancellationState.isSubmitting} onClick={() => setShowCancellation(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Keep ticket</button><button disabled={cancellationState.isSubmitting} onClick={submitCancellation} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{cancellationState.isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{cancellationState.isSubmitting ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
          </>}
        </section>
      </div>}
    </div>
  );
}
