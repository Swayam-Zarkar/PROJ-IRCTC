import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  ArrowUpDown, 
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeftRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { STATIONS } from '../data/trainsData';
import SearchWidget from './SearchWidget';
import TrainCard from './TrainCard';

export default function TrainResultsView() {
  const { 
    searchParams,
    searchResults,
    isSearching,
    searchError,
    performTrainSearch,
    swapStations
  } = useBooking();

  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEPARTURE_EARLY');

  // Trigger search on mount if results are not yet loaded
  useEffect(() => {
    if (!searchResults || searchResults.length === 0) {
      performTrainSearch();
    }
  }, [searchParams.fromStation, searchParams.toStation, searchParams.journeyDate, searchParams.quota]);

  const fromStn = STATIONS.find(s => s.code === searchParams.fromStation) || { 
    name: searchParams.fromStation, 
    code: searchParams.fromStation 
  };
  const toStn = STATIONS.find(s => s.code === searchParams.toStation) || { 
    name: searchParams.toStation, 
    code: searchParams.toStation 
  };

  const handleReverseSearch = () => {
    swapStations();
    performTrainSearch({
      fromStation: searchParams.toStation,
      toStation: searchParams.fromStation,
      journeyDate: searchParams.journeyDate,
      quota: searchParams.quota,
    });
  };

  const sourceTrains = Array.isArray(searchResults) ? searchResults : [];

  // Filter trains
  let filteredTrains = [...sourceTrains];

  // Apply Train Type filter
  if (selectedTypeFilter !== 'ALL') {
    filteredTrains = filteredTrains.filter(t => t.trainType === selectedTypeFilter);
  }

  // Apply Class Filter
  if (selectedClassFilter !== 'ALL') {
    filteredTrains = filteredTrains.filter(t => 
      t.classes && t.classes.some(c => c.classType === selectedClassFilter)
    );
  }

  // Sorting
  filteredTrains.sort((a, b) => {
    if (sortBy === 'DEPARTURE_EARLY') {
      return (a.departureTime || '').localeCompare(b.departureTime || '');
    }
    if (sortBy === 'DEPARTURE_LATE') {
      return (b.departureTime || '').localeCompare(a.departureTime || '');
    }
    if (sortBy === 'DURATION_FASTEST') {
      const getMinutes = (durStr) => {
        if (!durStr) return 9999;
        const hMatch = durStr.match(/(\d+)\s*h/);
        const mMatch = durStr.match(/(\d+)\s*m/);
        const hours = hMatch ? parseInt(hMatch[1]) : 0;
        const minutes = mMatch ? parseInt(mMatch[1]) : 0;
        return hours * 60 + minutes;
      };
      return getMinutes(a.duration) - getMinutes(b.duration);
    }
    return 0;
  });

  const trainTypes = [
    { id: 'ALL', label: 'All Trains' },
    { id: 'VANDE_BHARAT', label: 'Vande Bharat' },
    { id: 'RAJDHANI', label: 'Rajdhani' },
    { id: 'SHATABDI', label: 'Shatabdi' },
    { id: 'SUPERFAST', label: 'Superfast' },
    { id: 'MAIL', label: 'Mail / Express' },
  ];

  const travelClasses = ['ALL', '1A', '2A', '3A', '3E', 'SL', 'CC', 'EC'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Search Widget */}
      <SearchWidget isCompact={false} />

      {/* Results Header Banner */}
      <div className="bg-[#0f2c59] text-white p-4 md:p-5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Journey Date: {searchParams.journeyDate} • Quota: {searchParams.quota}</span>
            {searchParams.quota === 'TQ' && (
              <span className="bg-orange-500 text-white px-1.5 py-0.2 rounded text-[10px] font-bold">
                Tatkal PRS
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <span>{fromStn.name} ({fromStn.code})</span>
            <span className="text-orange-400">➔</span>
            <span>{toStn.name} ({toStn.code})</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {isSearching ? (
              <span className="flex items-center gap-1.5 text-amber-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting to Railway PRS Engine & fetching live seat availability...
              </span>
            ) : (
              <span>
                Showing <strong className="text-white font-bold">{filteredTrains.length}</strong> available trains for booking.
              </span>
            )}
          </p>
        </div>

        {/* Action Controls: Refresh & Sort Dropdown */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => performTrainSearch()}
            disabled={isSearching}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1a3d72] hover:bg-[#234e8f] text-slate-200 text-xs font-semibold rounded-lg border border-slate-600 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh train search"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-orange-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Sort:</span>
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#1a3d72] text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-600 focus:outline-hidden focus:ring-1 focus:ring-orange-400 cursor-pointer"
            >
              <option value="DEPARTURE_EARLY">Departure (Earliest First)</option>
              <option value="DEPARTURE_LATE">Departure (Latest First)</option>
              <option value="DURATION_FASTEST">Duration (Fastest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Train Types */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Type:
          </span>
          {trainTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedTypeFilter(type.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTypeFilter === type.id
                  ? 'bg-[#0f2c59] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Class Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-2">Class:</span>
          {travelClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClassFilter(cls)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedClassFilter === cls
                  ? 'bg-orange-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Train Results / Loading Skeletons / Empty State */}
      <div className="space-y-4">
        {isSearching ? (
          /* Loading Skeletons */
          <div className="space-y-4">
            {[1, 2, 3].map((skeletonId) => (
              <div
                key={skeletonId}
                className="bg-white rounded-xl shadow-md border border-slate-200 p-6 animate-pulse"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-44 bg-slate-200 rounded"></div>
                    <div className="h-5 w-16 bg-slate-200 rounded"></div>
                  </div>
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center mb-6">
                  <div className="md:col-span-8 flex items-center space-x-8">
                    <div>
                      <div className="h-7 w-20 bg-slate-200 rounded mb-1"></div>
                      <div className="h-4 w-28 bg-slate-200 rounded"></div>
                    </div>
                    <div className="flex-1 max-w-[180px] h-2 bg-slate-200 rounded"></div>
                    <div>
                      <div className="h-7 w-20 bg-slate-200 rounded mb-1"></div>
                      <div className="h-4 w-28 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map(c => (
                    <div key={c} className="h-20 bg-slate-100 rounded-lg border border-slate-200"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredTrains.length > 0 ? (
          filteredTrains.map((train) => (
            <TrainCard key={train.id || train.trainNumber} train={train} />
          ))
        ) : (
          /* Empty / No Trains Found State */
          <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>

            <h3 className="text-xl font-bold text-slate-800">
              {searchError ? 'No Direct Trains Available' : 'No Trains Match Selected Filters'}
            </h3>

            <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2 mb-6">
              {searchError || `No direct trains operating between ${fromStn.name} (${fromStn.code}) and ${toStn.name} (${toStn.code}) match your selected filters.`}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleReverseSearch}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Search Reverse Route ({toStn.code} ➔ {fromStn.code})</span>
              </button>

              {(selectedTypeFilter !== 'ALL' || selectedClassFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTypeFilter('ALL');
                    setSelectedClassFilter('ALL');
                  }}
                  className="px-5 py-2.5 bg-[#0f2c59] hover:bg-[#1a4484] text-white rounded-lg text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Reset Class & Type Filters
                </button>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 max-w-md mx-auto text-left text-xs text-slate-500 space-y-1.5">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Tips for finding trains:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Check popular junctions like <strong>NDLS</strong> (New Delhi) or <strong>CSMT</strong> (Mumbai).</li>
                <li>Verify your journey date is within the advance reservation period (120 days).</li>
                <li>Try searching with General (GN) quota if Tatkal seats are not yet released.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

