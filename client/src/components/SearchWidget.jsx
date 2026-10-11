import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftRight, 
  MapPin, 
  Search, 
  Zap,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { STATIONS, QUOTAS } from '../data/trainsData';
import { useBooking } from '../context/BookingContext';

export default function SearchWidget({ isCompact = false }) {
  const { 
    searchParams, 
    setSearchParams, 
    swapStations, 
    setActiveView,
    performTrainSearch,
    isSearching
  } = useBooking();

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [stations, setStations] = useState(STATIONS);
  const [isLoadingStations, setIsLoadingStations] = useState(true);

  const fromRef = useRef(null);
  const toRef = useRef(null);

  // Load the complete active-station list from MongoDB through the API.
  useEffect(() => {
    let isMounted = true;

    const loadStations = async () => {
      try {
        const response = await fetch('/api/stations');
        const data = await response.json();

        if (response.ok && data.success && Array.isArray(data.stations)) {
          const validStations = data.stations.filter(
            (station) => station.name && station.code && station.city && station.state
          );

          if (isMounted && validStations.length > 0) {
            setStations(validStations);
          }
        }
      } catch (error) {
        console.warn('Unable to load stations from the API:', error);
      } finally {
        if (isMounted) {
          setIsLoadingStations(false);
        }
      }
    };

    loadStations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Outside-click dismissal for station dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (fromRef.current && !fromRef.current.contains(e.target)) {
        setShowFromDropdown(false);
      }
      if (toRef.current && !toRef.current.contains(e.target)) {
        setShowToDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Selected station objects
  const currentFrom = stations.find(s => s.code === searchParams.fromStation) || STATIONS.find(s => s.code === searchParams.fromStation) || stations[0] || STATIONS[0];
  const currentTo = stations.find(s => s.code === searchParams.toStation) || STATIONS.find(s => s.code === searchParams.toStation) || stations[1] || STATIONS[1];

  // Filtered station suggestions
  const filteredFromStations = stations.filter(s => 
    s.name.toLowerCase().includes(fromQuery.toLowerCase()) || 
    s.code.toLowerCase().includes(fromQuery.toLowerCase()) ||
    s.city.toLowerCase().includes(fromQuery.toLowerCase())
  );

  const filteredToStations = stations.filter(s => 
    s.name.toLowerCase().includes(toQuery.toLowerCase()) || 
    s.code.toLowerCase().includes(toQuery.toLowerCase()) ||
    s.city.toLowerCase().includes(toQuery.toLowerCase())
  );

  const setRelativeDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toISOString().split('T')[0];
    setSearchParams(prev => ({ ...prev, journeyDate: dateStr }));
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchParams.fromStation === searchParams.toStation) {
      alert('Origin and Destination stations cannot be the same. Please choose different stations.');
      return;
    }

    performTrainSearch({
      fromStation: searchParams.fromStation,
      toStation: searchParams.toStation,
      journeyDate: searchParams.journeyDate,
      quota: searchParams.quota,
    });

    setActiveView('results');
  };

  const quickRoutes = [
    { from: 'NDLS', to: 'MMCT', label: 'Delhi ⇄ Mumbai' },
    { from: 'NDLS', to: 'BSB', label: 'Delhi ⇄ Varanasi' },
    { from: 'NDLS', to: 'HWH', label: 'Delhi ⇄ Kolkata' },
    { from: 'NDLS', to: 'MAS', label: 'Delhi ⇄ Chennai' },
  ];

  return (
    <div className={`w-full bg-white rounded-xl shadow-lg border border-slate-200 relative z-30 overflow-visible ${isCompact ? 'p-4' : 'p-6'}`}>
      {/* Search Header */}
      {!isCompact && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-6 bg-[#0f2c59] rounded-xs inline-block"></span>
            <h2 className="text-lg md:text-xl font-bold text-[#0f2c59]">Book Train Journey Ticket</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Quick Routes:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickRoutes.map((route, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSearchParams(prev => ({
                      ...prev,
                      fromStation: route.from,
                      toStation: route.to,
                    }));
                    performTrainSearch({
                      fromStation: route.from,
                      toStation: route.to,
                      journeyDate: searchParams.journeyDate,
                      quota: searchParams.quota,
                    });
                    setActiveView('results');
                  }}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 border border-slate-200 rounded-full font-medium transition-colors cursor-pointer"
                >
                  {route.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* FROM STATION (Col 1-4) */}
          <div ref={fromRef} className={`md:col-span-4 relative ${showFromDropdown ? 'z-50' : 'z-20'}`}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              From Station
            </label>
            <div 
              onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
              className="flex items-center border border-slate-300 rounded-lg p-2.5 bg-slate-50 hover:bg-white hover:border-[#0f2c59] cursor-pointer transition-all shadow-2xs"
            >
              <MapPin className="w-5 h-5 text-orange-600 mr-2 shrink-0" />
              <div className="flex-1 truncate">
                <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>{currentFrom.name}</span>
                  <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {currentFrom.code}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{currentFrom.city}, {currentFrom.state}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-1.5" />
            </div>

            {/* Dropdown Station Selector */}
            {showFromDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-[100] p-2.5 max-h-72 overflow-y-auto">
                <div className="sticky top-0 bg-white pb-2 z-10">
                  <input
                    type="text"
                    placeholder="Search city, station, or code..."
                    value={fromQuery}
                    onChange={(e) => setFromQuery(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                  />
                </div>
                <div className="space-y-1">
                  {isLoadingStations && (
                    <div className="p-3 text-center text-xs text-slate-400">Loading stations...</div>
                  )}
                  {filteredFromStations.length > 0 ? (
                    filteredFromStations.map(stn => (
                      <div
                        key={stn.code}
                        onClick={() => {
                          setSearchParams(prev => ({ ...prev, fromStation: stn.code }));
                          setShowFromDropdown(false);
                          setFromQuery('');
                        }}
                        className={`px-3 py-2 hover:bg-orange-50 hover:text-orange-900 rounded-lg cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          searchParams.fromStation === stn.code ? 'bg-slate-100 font-bold' : ''
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{stn.name}</span>
                          <span className="text-slate-500 ml-1">({stn.city}, {stn.state})</span>
                        </div>
                        <span className="font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                          {stn.code}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">No matching stations found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SWAP STATIONS BUTTON (Col 5) */}
          <div className="md:col-span-1 flex justify-center -my-2 md:my-0 relative z-10">
            <button
              type="button"
              onClick={swapStations}
              title="Swap Origin and Destination Stations"
              className="p-2.5 rounded-full bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 border border-slate-200 hover:border-orange-300 transition-all transform hover:rotate-180 duration-200 shadow-2xs cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* TO STATION (Col 6-9) */}
          <div ref={toRef} className={`md:col-span-4 relative ${showToDropdown ? 'z-50' : 'z-20'}`}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              To Station
            </label>
            <div 
              onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
              className="flex items-center border border-slate-300 rounded-lg p-2.5 bg-slate-50 hover:bg-white hover:border-[#0f2c59] cursor-pointer transition-all shadow-2xs"
            >
              <MapPin className="w-5 h-5 text-emerald-600 mr-2 shrink-0" />
              <div className="flex-1 truncate">
                <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>{currentTo.name}</span>
                  <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {currentTo.code}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{currentTo.city}, {currentTo.state}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-1.5" />
            </div>

            {/* Dropdown Station Selector */}
            {showToDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-[100] p-2.5 max-h-72 overflow-y-auto">
                <div className="sticky top-0 bg-white pb-2 z-10">
                  <input
                    type="text"
                    placeholder="Search city, station, or code..."
                    value={toQuery}
                    onChange={(e) => setToQuery(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59]"
                  />
                </div>
                <div className="space-y-1">
                  {isLoadingStations && (
                    <div className="p-3 text-center text-xs text-slate-400">Loading stations...</div>
                  )}
                  {filteredToStations.length > 0 ? (
                    filteredToStations.map(stn => (
                      <div
                        key={stn.code}
                        onClick={() => {
                          setSearchParams(prev => ({ ...prev, toStation: stn.code }));
                          setShowToDropdown(false);
                          setToQuery('');
                        }}
                        className={`px-3 py-2 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          searchParams.toStation === stn.code ? 'bg-slate-100 font-bold' : ''
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{stn.name}</span>
                          <span className="text-slate-500 ml-1">({stn.city}, {stn.state})</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {stn.code}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">No matching stations found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DATE SELECTOR (Col 10-12) */}
          <div className="md:col-span-3 relative z-10">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Journey Date
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setRelativeDate(0)}
                  className="text-[10px] font-semibold text-slate-600 hover:text-orange-600 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setRelativeDate(1)}
                  className="text-[10px] font-semibold text-slate-600 hover:text-orange-600 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setRelativeDate(2)}
                  className="text-[10px] font-semibold text-slate-600 hover:text-orange-600 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  +2 Days
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="date"
                value={searchParams.journeyDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSearchParams(prev => ({ ...prev, journeyDate: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59] cursor-pointer"
                required
              />
            </div>
          </div>
        </div>

        {/* SECOND ROW: QUOTA + SUBMIT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 relative z-10">
          {/* Quota Selector */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center justify-between">
              <span>Quota Category</span>
              {searchParams.quota === 'TQ' && (
                <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 rounded flex items-center gap-0.5">
                  <Zap className="w-3 h-3 fill-orange-500" /> Tatkal Applied
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={searchParams.quota}
                onChange={(e) => setSearchParams(prev => ({ ...prev, quota: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm font-semibold border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2c59] cursor-pointer appearance-none ${
                  searchParams.quota === 'TQ'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-900 font-bold'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400'
                }`}
              >
                {QUOTAS.map(q => (
                  <option key={q.code} value={q.code} className="bg-white text-slate-800 py-1">
                    {q.code} - {q.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Quick Filter Info */}
          <div className="md:col-span-4 flex items-center gap-4 text-xs font-medium text-slate-600 pt-3 md:pt-0">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Direct Trains Only</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-orange-600 focus:ring-orange-500" />
              <span>Trains with Available Berth</span>
            </label>
          </div>

          {/* Search CTA Button */}
          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={isSearching}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white py-3 px-6 rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SEARCHING TRAINS...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>SEARCH TRAINS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
