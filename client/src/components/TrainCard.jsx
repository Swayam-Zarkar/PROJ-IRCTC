import React, { useState } from 'react';
import { 
  Clock, 
  ArrowRight, 
  Utensils, 
  ChevronDown, 
  ChevronUp, 
  Info,
  CheckCircle2,
  AlertCircle,
  Zap,
  MapPin
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { CLASSES_INFO, STATIONS } from '../data/trainsData';

/**
 * IRCTC State-Machine Availability Logic:
 * 1. If available_seats > 0 -> "AVAILABLE - {available_seats}" (Hide RAC/WL)
 * 2. If available_seats === 0 AND rac_seats > 0 -> "RAC - {rac_seats}" (Hide Available/WL)
 * 3. If available_seats === 0 AND rac_seats === 0 AND wl_seats > 0 -> "WL - {wl_booked + 1}"
 * 4. If all are 0/full -> "REGRET"
 */
function getIRCTCStateAvailability(availData) {
  if (!availData) {
    return {
      status: 'AVAILABLE',
      displayText: 'AVAILABLE - 20',
      badgeClass: 'bg-emerald-600 text-white font-bold',
      bgClass: 'bg-emerald-50/70 border-emerald-300 text-emerald-900',
    };
  }

  // Parse availability fields supporting snake_case, camelCase, or basic seats/status
  const rawAvailable =
    availData.available_seats !== undefined
      ? availData.available_seats
      : availData.availableSeats !== undefined
      ? availData.availableSeats
      : (availData.status === 'AVAILABLE' || availData.status === 'CURR_AVBL') && availData.seats !== undefined
      ? availData.seats
      : 0;
  const available_seats = Number(rawAvailable) || 0;

  const rawRac =
    availData.rac_seats !== undefined
      ? availData.rac_seats
      : availData.racSeatsRemaining !== undefined
      ? availData.racSeatsRemaining
      : availData.racSeats !== undefined
      ? availData.racSeats
      : availData.status === 'RAC' && availData.seats !== undefined
      ? availData.seats
      : 0;
  const rac_seats = Number(rawRac) || 0;

  const rawWl =
    availData.wl_seats !== undefined
      ? availData.wl_seats
      : availData.wlSeatsRemaining !== undefined
      ? availData.wlSeatsRemaining
      : availData.wlSeats !== undefined
      ? availData.wlSeats
      : (availData.status === 'WL' || availData.status === 'WAITLIST') && availData.seats !== undefined
      ? availData.seats
      : 0;
  const wl_seats = Number(rawWl) || 0;

  const rawWlBooked =
    availData.wl_booked !== undefined
      ? availData.wl_booked
      : availData.wlBooked !== undefined
      ? availData.wlBooked
      : 0;
  const wl_booked = Number(rawWlBooked) || 0;

  // If status is explicitly REGRET
  if (availData.status === 'REGRET') {
    return {
      status: 'REGRET',
      displayText: 'REGRET',
      badgeClass: 'bg-rose-600 text-white font-bold',
      bgClass: 'bg-rose-50/70 border-rose-300 text-rose-900',
    };
  }

  // Rule 1: If available_seats > 0 -> return "AVAILABLE - {available_seats}" (Hide RAC/WL)
  if (available_seats > 0) {
    return {
      status: 'AVAILABLE',
      displayText: `AVAILABLE - ${available_seats}`,
      badgeClass: 'bg-emerald-600 text-white font-bold',
      bgClass: 'bg-emerald-50/70 border-emerald-300 text-emerald-900',
    };
  }

  // Rule 2: If available_seats === 0 AND rac_seats > 0 -> return "RAC - {rac_seats}" (Hide Available/WL)
  if (available_seats === 0 && rac_seats > 0) {
    return {
      status: 'RAC',
      displayText: `RAC - ${rac_seats}`,
      badgeClass: 'bg-amber-500 text-white font-bold',
      bgClass: 'bg-amber-50/70 border-amber-300 text-amber-900',
    };
  }

  // Rule 3: If available_seats === 0 AND rac_seats === 0 AND wl_seats > 0 -> return "WL - {wl_booked + 1}"
  if (available_seats === 0 && rac_seats === 0 && wl_seats > 0) {
    const nextWl = wl_booked + 1;
    return {
      status: 'WL',
      displayText: `WL - ${nextWl}`,
      badgeClass: 'bg-amber-600 text-white font-bold',
      bgClass: 'bg-amber-50/70 border-amber-300 text-amber-900',
    };
  }

  // Rule 4: If all are 0/full -> return "REGRET"
  return {
    status: 'REGRET',
    displayText: 'REGRET',
    badgeClass: 'bg-rose-600 text-white font-bold',
    bgClass: 'bg-rose-50/70 border-rose-300 text-rose-900',
  };
}

export default function TrainCard({ train }) {
  const { 
    searchParams, 
    setSelectedTrain, 
    setSelectedClass,
    setBookingContext,
    selectTrainForBooking,
    setActiveView,
    user 
  } = useBooking();

  const [expandedDetails, setExpandedDetails] = useState(false);
  const [selectedClassTile, setSelectedClassTile] = useState(null);

  const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // Resolve stations from searchParams or train data
  const fromCode = searchParams.fromStation;
  const toCode = searchParams.toStation;

  const originStationObj = STATIONS.find(s => s.code === fromCode) || {
    name: train.originStationName || (typeof train.originStation === 'object' ? train.originStation.name : train.originStation) || fromCode,
    code: fromCode,
  };

  const destStationObj = STATIONS.find(s => s.code === toCode) || {
    name: train.destinationStationName || (typeof train.destinationStation === 'object' ? train.destinationStation.name : train.destinationStation) || toCode,
    code: toCode,
  };

  // Badges per train type
  const getTypeBadge = (type) => {
    switch (type) {
      case 'VANDE_BHARAT':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RAJDHANI':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'SHATABDI':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SUPERFAST':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'MAIL':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Color-coded availability badges: Green for Available, Yellow for RAC/WL, Red for Regret
  const getStatusStyle = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'AVAILABLE' || s === 'CURR_AVBL' || s.startsWith('AVL')) {
      return {
        bg: 'bg-emerald-50/70 border-emerald-300 text-emerald-900',
        badge: 'bg-emerald-600 text-white font-bold',
        text: 'AVAILABLE',
      };
    }
    if (s === 'RAC') {
      return {
        bg: 'bg-amber-50/70 border-amber-300 text-amber-900',
        badge: 'bg-amber-500 text-white font-bold',
        text: 'RAC',
      };
    }
    if (s === 'WL' || s.includes('WL') || s === 'WAITLIST') {
      return {
        bg: 'bg-amber-50/70 border-amber-300 text-amber-900',
        badge: 'bg-amber-600 text-white font-bold',
        text: 'WAITLIST',
      };
    }
    // REGRET / NOT_AVAILABLE
    return {
      bg: 'bg-rose-50/70 border-rose-300 text-rose-900',
      badge: 'bg-rose-600 text-white font-bold',
      text: 'REGRET',
    };
  };

  // Requirement 3: "Book Now" Context Passing
  // Save complete context package (Train Number, Train Name, From Station, To Station, Journey Date, Class, and Quota) into BookingContext state
  const handleBookClass = (classItem) => {
    const quota = searchParams.quota || 'GN';
    const avail = classItem.availability?.[quota] || classItem.availability?.GN || { status: 'AVAILABLE', seats: 20 };

    const contextPackage = {
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      trainType: train.trainType,
      fromStation: searchParams.fromStation,
      fromStationName: originStationObj.name,
      toStation: searchParams.toStation,
      toStationName: destStationObj.name,
      journeyDate: searchParams.journeyDate,
      class: classItem.classType,
      quota: quota,
      fare: classItem.fare,
      availability: avail,
      departureTime: train.departureTime,
      arrivalTime: train.arrivalTime,
      duration: train.duration,
      train,
      classItem,
    };

    // Save complete context package into central BookingContext state
    if (typeof selectTrainForBooking === 'function') {
      selectTrainForBooking(train, classItem, searchParams);
    } else {
      setSelectedTrain({
        ...train,
        ...contextPackage,
      });
      setSelectedClass({
        ...classItem,
        quota,
        journeyDate: searchParams.journeyDate,
      });
    }

    if (typeof setBookingContext === 'function') {
      setBookingContext(contextPackage);
    }

    // Transition view to PassengerForm (or Login if not authenticated)
    if (!user) {
      setActiveView('login');
    } else {
      setActiveView('passenger');
    }
  };

  const runsDays = train.runsOn || train.runsOnDays || daysOfWeek;

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-200">
      {/* Train Header Strip */}
      <div className="bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Train Name & Number */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-base md:text-lg font-black tracking-tight text-[#0f2c59]">
              {train.trainName}
            </span>
            <span className="font-mono text-sm font-bold text-orange-600 bg-orange-100/70 px-2 py-0.5 rounded border border-orange-200">
              #{train.trainNumber}
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getTypeBadge(train.trainType)}`}>
            {train.trainType.replace('_', ' ')}
          </span>
        </div>

        {/* Runs On Days & Facilities */}
        <div className="flex items-center gap-4 text-xs">
          {/* Running Days Badges */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[10px] mr-1 hidden sm:inline">Runs On:</span>
            {daysOfWeek.map((day) => {
              const runs = runsDays.includes(day);
              return (
                <span
                  key={day}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    runs
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                  title={`${day}: ${runs ? 'Operating' : 'Not Scheduled'}`}
                >
                  {day.charAt(0)}
                </span>
              );
            })}
          </div>

          {/* Pantry Availability */}
          {train.pantry && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Utensils className="w-3 h-3 text-emerald-600" />
              <span>Pantry Car</span>
            </div>
          )}
        </div>
      </div>

      {/* Train Schedule Timings Bar: Departure from 'From' station ➔ Arrival at 'To' station */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Timing Display (Departure - Duration - Arrival) */}
        <div className="md:col-span-8 flex items-center justify-between sm:justify-start sm:space-x-8">
          {/* Departure */}
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
              {train.departureTime}
            </div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {originStationObj.name} ({originStationObj.code})
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Day 1 • Departure</div>
          </div>

          {/* Journey Line Graphic */}
          <div className="flex-1 max-w-[200px] flex flex-col items-center px-2">
            <span className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {train.duration}
            </span>
            <div className="w-full relative flex items-center justify-center">
              <div className="w-full h-0.5 bg-slate-300"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 absolute left-0"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 absolute"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#0f2c59] absolute right-0"></div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-mono">{train.distanceKm} km</span>
          </div>

          {/* Arrival */}
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
              {train.arrivalTime}
            </div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {destStationObj.name} ({destStationObj.code})
            </div>
            <div className="text-[11px] text-slate-400 font-medium">{train.arrivalDay || 'Day 2'} • Arrival</div>
          </div>
        </div>

        {/* Schedule & Stops Accordion Toggle & Live Seat Map */}
        <div className="md:col-span-4 flex justify-start md:justify-end items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTrain(train);
              const journeyDate = searchParams?.journeyDate || new Date().toISOString().split('T')[0];
              const query = new URLSearchParams({
                train: train.trainNumber || train._id,
                date: journeyDate,
                view: 'coach-map',
              }).toString();
              window.history.pushState({}, '', `?${query}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
              if (typeof setActiveView === 'function') {
                setActiveView('coach-map');
              }
            }}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1 transition-colors cursor-pointer"
            title="View live Coach Layout & physical seat map for this train"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Seat Map</span>
          </button>
          {Array.isArray(train.stops) && train.stops.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedDetails(!expandedDetails)}
              className="text-xs font-semibold text-[#0f2c59] hover:text-orange-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{expandedDetails ? 'Hide Route & Halts' : `View Halts (${train.stops.length})`}</span>
              {expandedDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Class Availability Tiles Grid (1A, 2A, 3A, SL, CC, etc.) */}
      <div className="px-5 pb-5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span>Select Travel Class & Availability ({searchParams.quota} Quota)</span>
            {searchParams.quota === 'TQ' && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 rounded flex items-center gap-0.5">
                <Zap className="w-3 h-3 fill-orange-500" /> Tatkal
              </span>
            )}
          </span>
          <span className="text-[10px] text-slate-400 normal-case hidden sm:inline">Official PRS Fares with GST</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {train.classes.map((cls) => {
            const avail = cls.availability?.[searchParams.quota] || cls.availability?.GN || { status: 'AVAILABLE', seats: 20 };
            const stateAvail = getIRCTCStateAvailability(avail);
            const isSelected = selectedClassTile?.classType === cls.classType;

            return (
              <div
                key={cls.classType}
                onClick={() => setSelectedClassTile(cls)}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-[#0f2c59] bg-[#0f2c59]/5 shadow-sm'
                    : `${stateAvail.bgClass} hover:border-slate-400`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">{cls.classType}</span>
                    <span className="text-xs font-bold text-slate-900">₹{cls.fare}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate">
                    {CLASSES_INFO[cls.classType]?.name || cls.classType}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/80">
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center ${stateAvail.badgeClass}`}>
                    {stateAvail.displayText}
                  </div>
                  <div className="text-[9px] text-slate-400 text-center mt-1 truncate">
                    {avail.updateTime || 'Live PRS Status'}
                  </div>
                </div>

                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookClass(cls);
                    }}
                    className="mt-2 w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Book Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Route Halts Accordion */}
      {expandedDetails && Array.isArray(train.stops) && train.stops.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-200 p-5">
          <div className="max-w-3xl">
            <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0f2c59]" />
              <span>Official Scheduled Route, Intermediate Halts & Distance</span>
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs bg-white">
                <thead className="bg-[#0f2c59] text-white">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Station Name</th>
                    <th className="py-2 px-3 font-semibold">Code</th>
                    <th className="py-2 px-3 font-semibold">Arr.</th>
                    <th className="py-2 px-3 font-semibold">Dep.</th>
                    <th className="py-2 px-3 font-semibold">Halt</th>
                    <th className="py-2 px-3 font-semibold">Day</th>
                    <th className="py-2 px-3 font-semibold">Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {train.stops.map((stop, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-800">{stop.name}</td>
                      <td className="py-2 px-3 font-mono font-bold text-orange-600">{stop.code}</td>
                      <td className="py-2 px-3 text-slate-600">{stop.arr}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{stop.dep}</td>
                      <td className="py-2 px-3 text-slate-500">{stop.halt}</td>
                      <td className="py-2 px-3 text-slate-600">{stop.day}</td>
                      <td className="py-2 px-3 text-slate-600">{stop.dist} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
