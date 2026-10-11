import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBooking } from '../context/BookingContext';
import CoachRow from './CoachRow';
import TimelineDrawer from './TimelineDrawer';
import { Train, Calendar, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Reactive hook to read and update URL search parameters without external router dependencies
 */
export function useSearchParams() {
  const [params, setParams] = useState(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  );

  useEffect(() => {
    const handlePopState = () => {
      setParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateParams = useCallback((newParamsObj) => {
    const current = new URLSearchParams(window.location.search);
    Object.entries(newParamsObj).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    });
    const newRelativePathQuery = window.location.pathname + (current.toString() ? `?${current.toString()}` : '');
    window.history.replaceState(null, '', newRelativePathQuery);
    setParams(new URLSearchParams(current));
  }, []);

  return [params, updateParams];
}

/**
 * Bidirectional Coach Alias Resolver
 */
export function getCoachAliases(coachStr) {
  if (!coachStr) return [];
  const s = String(coachStr).trim().toUpperCase();
  const numMatch = s.match(/\d+$/);
  const num = numMatch ? numMatch[0] : '1';
  const prefix = s.replace(/\d+$/, '');

  const map = {
    '1A': ['1A', 'H'],
    'H': ['1A', 'H'],
    '2A': ['2A', 'A'],
    'A': ['2A', 'A'],
    '3A': ['3A', 'B'],
    'B': ['3A', 'B'],
    'SL': ['SL', 'S'],
    'S': ['SL', 'S'],
    'CC': ['CC', 'C'],
    'C': ['CC', 'C'],
    'EC': ['EC', 'E'],
    'E': ['EC', 'E'],
    '3E': ['3E', 'M'],
    'M': ['3E', 'M'],
  };

  const letters = map[prefix] || [prefix];
  const set = new Set([s]);
  letters.forEach((l) => {
    set.add(`${l}${num}`);
    set.add(l);
  });
  return Array.from(set);
}

export default function CoachLayout({
  trainNumber: propTrainNumber,
  journeyDate: propJourneyDate,
  defaultCoach: propDefaultCoach,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    selectedTrain, 
    searchParams: contextSearchParams, 
    currentBooking, 
    pnrHistory,
    seatMapVersion, 
    refreshSeatMap 
  } = useBooking();

  // Dynamic parameter extraction with fallback cascade:
  // 1. Explicit props passed to component
  // 2. URL search parameters (?train=12951&date=2026-10-15&coach=B1)
  // 3. Current active booking context (post-booking inspection)
  // 4. Selected train from search results context
  const urlTrain = searchParams.get('train') || searchParams.get('trainNumber');
  const urlDate = searchParams.get('date') || searchParams.get('journeyDate');
  const urlCoach = searchParams.get('coach') || searchParams.get('coachNumber');

  const bookingTrain = currentBooking?.trainNumber || (typeof currentBooking?.train === 'object' ? currentBooking?.train?.trainNumber : null);
  const bookingDate = currentBooking?.journeyDate ? new Date(currentBooking.journeyDate).toISOString().split('T')[0] : null;
  const bookingCoach =
    currentBooking?.passengers?.find((p) => p.allocatedCoach || p.coachNumber)?.allocatedCoach ||
    currentBooking?.passengers?.find((p) => p.allocatedCoach || p.coachNumber)?.coachNumber;

  const resolvedTrain = propTrainNumber || urlTrain || bookingTrain || selectedTrain?.trainNumber || '12951';
  const resolvedDate = propJourneyDate || urlDate || bookingDate || contextSearchParams?.journeyDate || new Date().toISOString().split('T')[0];
  const resolvedCoach = propDefaultCoach || urlCoach || bookingCoach || 'B1';

  // Active state parameters for live API query
  const [trainNumber, setTrainNumber] = useState(resolvedTrain);
  const [journeyDate, setJourneyDate] = useState(resolvedDate);
  const [selectedCoach, setSelectedCoach] = useState(resolvedCoach);

  // API data & loading state
  const [coachData, setCoachData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);

  // Sync state if URL search parameters or context change
  useEffect(() => {
    const t = searchParams.get('train') || searchParams.get('trainNumber');
    const d = searchParams.get('date') || searchParams.get('journeyDate');
    const c = searchParams.get('coach') || searchParams.get('coachNumber');

    if (t && t !== trainNumber) setTrainNumber(t);
    else if (!t && selectedTrain?.trainNumber && selectedTrain.trainNumber !== trainNumber) {
      setTrainNumber(selectedTrain.trainNumber);
    }

    if (d && d !== journeyDate) setJourneyDate(d);
    if (c && c !== selectedCoach) setSelectedCoach(c);
  }, [searchParams, selectedTrain]);

  // Synchronize URL search params when user interacts with inputs
  const handleTrainChange = (newTrain) => {
    setTrainNumber(newTrain);
    setSearchParams({ train: newTrain, date: journeyDate, coach: selectedCoach, view: 'coach-map' });
  };

  const handleDateChange = (newDate) => {
    setJourneyDate(newDate);
    setSearchParams({ train: trainNumber, date: newDate, coach: selectedCoach, view: 'coach-map' });
  };

  const handleCoachChange = (newCoach) => {
    setSelectedCoach(newCoach);
    setSearchParams({ train: trainNumber, date: journeyDate, coach: newCoach, view: 'coach-map' });
  };

  // Fetch real-time seat inventory whenever train, date, coach, or seatMapVersion changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveSeats() {
      if (!trainNumber) {
        setError('Please enter or select a train number to view the coach seat map.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          train: String(trainNumber).trim(),
          date: journeyDate,
          ...(selectedCoach ? { coach: selectedCoach } : {}),
          _t: String(Date.now()), // Cache-buster: force fresh real-time fetch on mount
        });

        const res = await fetch(`/api/inventory/seats?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to load live seat layout');
        }

        if (!isCancelled) {
          // Explicitly overwrite state from live API response (prevents doubling / duplication)
          setCoachData(data);
          if (!selectedCoach && data.selectedCoach) {
            setSelectedCoach(data.selectedCoach);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Error connecting to inventory service');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchLiveSeats();

    return () => {
      isCancelled = true;
    };
  }, [trainNumber, journeyDate, selectedCoach, seatMapVersion]);

  // Strictly rely on fresh JSON response from backend API (eradicate localStorage ghost caching)
  const processedSeats = useMemo(() => {
    return Array.isArray(coachData?.seats) ? coachData.seats : [];
  }, [coachData]);

  // Transform 1D array of seats into 10 visual rows for the exploded train coach layout
  const rows = useMemo(() => {
    if (!processedSeats || processedSeats.length === 0) return [];
    return Array.from({ length: 10 }, (_, rowIndex) =>
      Object.fromEntries(
        processedSeats.map((seat) => [
          seat.berthType,
          processedSeats.find(
            (candidate) =>
              candidate.berthType === seat.berthType &&
              (candidate.seatNumber - 1) % 10 === rowIndex
          ),
        ])
      )
    );
  }, [processedSeats]);

  const availableCoaches = coachData?.availableCoaches || [
    { coachNumber: 'B1', coachType: '3A' },
    { coachNumber: 'B2', coachType: '3A' },
    { coachNumber: 'A1', coachType: '2A' },
    { coachNumber: 'S1', coachType: 'SL' },
  ];

  const bookedCountDisplay = useMemo(() => {
    return coachData?.bookedCount ?? (processedSeats.length > 0 ? processedSeats.filter((s) => s.status === 'BOOKED' || s.status === 'TQ').length : '--');
  }, [processedSeats, coachData]);

  const availableCountDisplay = useMemo(() => {
    return coachData?.availableCount ?? (processedSeats.length > 0 ? processedSeats.filter((s) => s.status === 'AVAILABLE').length : '--');
  }, [processedSeats, coachData]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* Top Header & Live Inventory Controls */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Live Real-Time Seat Map
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              Train #{coachData?.trainNumber || trainNumber}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mt-1">
            {coachData?.trainName || `Express ${trainNumber}`} Coach View
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time physical berth occupancy for journey date{' '}
            <strong className="text-slate-900">{journeyDate}</strong>.
          </p>
        </div>

        {/* Live Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={journeyDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm">
            <Train className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Train Number"
              value={trainNumber}
              onChange={(e) => handleTrainChange(e.target.value)}
              className="w-20 text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={() => refreshSeatMap && refreshSeatMap()}
            title="Refresh Live Seat Inventory"
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh Map</span>
          </button>
        </div>
      </div>

      {/* Live Capacity Indicators & Dynamic Redis Quotas */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Total Available (Green) */}
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500 ring-2 ring-emerald-200" />
            <span className="text-slate-700">Available:</span>
            <span className="font-mono text-emerald-700 font-black text-sm">
              {availableCountDisplay}
            </span>
          </span>

          {/* GN Quota */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200" title="General Quota">
            <span className="text-slate-600 font-semibold">GN:</span>
            <span className="font-mono text-emerald-700 font-black">
              {coachData?.quotas?.GN?.available ?? '--'}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">/{coachData?.quotas?.GN?.total ?? coachData?.quotas?.GN?.max ?? 60}</span>
          </span>

          {/* Ladies Quota (LD) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-pink-50 border border-pink-200" title="Ladies Quota">
            <span className="text-pink-700 font-semibold">LD:</span>
            <span className="font-mono text-pink-700 font-black">
              {coachData?.quotas?.LD?.available ?? '--'}
            </span>
            <span className="text-[10px] text-pink-400 font-normal">/{coachData?.quotas?.LD?.total ?? coachData?.quotas?.LD?.max ?? 10}</span>
          </span>

          {/* Divyangjan Quota (HP) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-teal-50 border border-teal-200" title="Divyangjan Quota">
            <span className="text-teal-700 font-semibold">HP:</span>
            <span className="font-mono text-teal-700 font-black">
              {coachData?.quotas?.HP?.available ?? '--'}
            </span>
            <span className="text-[10px] text-teal-400 font-normal">/{coachData?.quotas?.HP?.total ?? coachData?.quotas?.HP?.max ?? 5}</span>
          </span>

          {/* Senior Citizen Quota (SS) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 border border-sky-200" title="Senior Citizen Quota">
            <span className="text-sky-700 font-semibold">SS:</span>
            <span className="font-mono text-sky-700 font-black">
              {coachData?.quotas?.SS?.available ?? '--'}
            </span>
            <span className="text-[10px] text-sky-400 font-normal">/{coachData?.quotas?.SS?.total ?? coachData?.quotas?.SS?.max ?? 5}</span>
          </span>

          {/* Tatkal TQ (Purple) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 border border-purple-200" title="Tatkal Quota">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
            <span className="text-purple-900 font-semibold">TQ:</span>
            <span className="font-mono text-purple-700 font-black">
              {coachData?.quotas?.TQ?.available ?? '--'}
            </span>
            <span className="text-[10px] text-purple-400 font-normal">/{coachData?.quotas?.TQ?.total ?? coachData?.quotas?.TQ?.max ?? 10}</span>
          </span>

          {/* Premium Tatkal PT (Indigo/Purple) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 border border-indigo-200" title="Premium Tatkal Quota">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
            <span className="text-indigo-900 font-semibold">PT:</span>
            <span className="font-mono text-indigo-700 font-black">
              {coachData?.quotas?.PT?.available ?? '--'}
            </span>
            <span className="text-[10px] text-indigo-400 font-normal">/{coachData?.quotas?.PT?.total ?? coachData?.quotas?.PT?.max ?? 10}</span>
          </span>

          {/* RAC (Orange) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200" title="Reservation Against Cancellation">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-amber-900 font-semibold">RAC:</span>
            <span className="font-mono text-amber-700 font-black">
              {coachData?.quotas?.RAC?.available ?? coachData?.racCount ?? '--'}
            </span>
            <span className="text-[10px] text-amber-400 font-normal">/{coachData?.quotas?.RAC?.total ?? coachData?.quotas?.RAC?.max ?? 25}</span>
          </span>

          {/* WL (Yellow) */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-50 border border-yellow-200" title="Waitlist">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="text-yellow-900 font-semibold">WL:</span>
            <span className="font-mono text-yellow-700 font-black">
              {coachData?.quotas?.WL?.available ?? coachData?.wlCount ?? '--'}
            </span>
            <span className="text-[10px] text-yellow-500 font-normal">/{coachData?.quotas?.WL?.total ?? coachData?.quotas?.WL?.max ?? coachData?.quotas?.WL?.limit ?? 70}</span>
          </span>

          {/* Booked (Red) */}
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-rose-600 ring-2 ring-rose-200" />
            <span className="text-slate-700">Booked:</span>
            <span className="font-mono text-rose-700 font-extrabold">
              {bookedCountDisplay}
            </span>
          </span>
        </div>

        {isLoading && (
          <span className="inline-flex items-center gap-1.5 text-blue-600 animate-pulse text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Syncing inventory...
          </span>
        )}
      </div>

      {/* Coach Selector Tabs */}
      <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3" aria-label="Coach selector">
        {availableCoaches.map((item) => {
          const isSelected =
            item.coachNumber === selectedCoach ||
            getCoachAliases(item.coachNumber).some((a) => getCoachAliases(selectedCoach).includes(a));

          return (
            <button
              key={item.coachNumber}
              onClick={() => handleCoachChange(item.coachNumber)}
              className={`shrink-0 rounded-lg px-5 py-2 text-sm font-black transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.coachNumber}{' '}
              <span className="ml-1 opacity-70 text-xs font-semibold">{item.coachType}</span>
            </button>
          );
        })}
      </nav>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Seat Map Bay Layout */}
      <div className="overflow-x-auto rounded-2xl bg-slate-100 p-4 border border-slate-200">
        <div className="mb-3 grid min-w-[760px] grid-cols-[3fr_0.45fr_5fr_0.45fr_2fr] px-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Sleeper / Standard Bays</span>
          <span>Aisle</span>
          <span>Chair / Main Berths</span>
          <span>Aisle</span>
          <span>Side Berths</span>
        </div>

        {isLoading && !coachData ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-700 mb-2" />
            <p className="text-sm font-bold text-slate-600">Loading coach layout...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-6 text-xs font-black text-slate-400 text-center font-mono">
                  {index + 1}
                </span>
                <CoachRow row={row} onSelect={setSelectedSeat} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Drawer for Station-by-Station View */}
      <TimelineDrawer seat={selectedSeat} onClose={() => setSelectedSeat(null)} />
    </section>
  );
}
