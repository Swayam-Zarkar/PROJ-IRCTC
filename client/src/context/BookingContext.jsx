import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { INITIAL_TRAINS, SAMPLE_PNRS, STATIONS } from '../data/trainsData';

const BookingContext = createContext(null);

export const BookingProvider = ({ children }) => {
  // Authenticated User State: strictly null by default unless valid session in localStorage
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('irctc_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isLoggedIn) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved user from localStorage:', e);
    }
    return null;
  });

  // New visitors begin with account creation; existing users can switch to login.
  const [activeView, setActiveViewRaw] = useState('register');

  // Guarded view setter: redirects to 'login' if trying to access protected views without authentication
  const setActiveView = useCallback((view) => {
    const protectedViews = ['search', 'results', 'passenger', 'payment', 'profile'];
    if (!user && protectedViews.includes(view)) {
      setActiveViewRaw('login');
      return;
    }
    setActiveViewRaw(view);
  }, [user]);

  // Search parameters
  const [searchParams, setSearchParams] = useState({
    fromStation: 'NDLS',
    toStation: 'MMCT',
    journeyDate: getTomorrowDateString(),
    quota: 'GN', // 'GN' | 'TQ' | 'PT' | 'LD' | 'SS' | 'HP'
    classCategory: 'ALL',
  });

  // Backend Train Search API State
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Filter criteria on results view
  const [resultsFilters, setResultsFilters] = useState({
    trainTypes: ['ALL'], // 'VANDE_BHARAT', 'RAJDHANI', 'SHATABDI', 'SUPERFAST'
    classType: 'ALL',
    sortBy: 'DEPARTURE_EARLIEST',
  });

  // Active Selection for Booking
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null); // { classType: '3A', fare: 2040, availability: ... }
  const [bookingContext, setBookingContext] = useState(null); // Complete context package (trainNumber, trainName, from, to, date, class, quota)

  // Passenger roster for the active booking (clean initial template without hardcoded mock user)
  const [passengers, setPassengers] = useState([
    {
      id: 'p-1',
      name: '',
      age: '',
      gender: 'MALE',
      berthPreference: 'NO_PREFERENCE',
      foodPreference: 'VEG',
    },
  ]);

  // Contact info (dynamically derived from user)
  const [contactDetails, setContactDetails] = useState({
    mobile: user?.mobile || user?.phone_no || '',
    email: user?.email || '',
    travelInsurance: true,
    autoUpgradation: true,
  });

  // Payment method selection & processing state
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'NET_BANKING' | 'CARDS' | 'WALLET'
  const [paymentState, setPaymentState] = useState({
    isProcessing: false,
    otpRequired: false,
    otpValue: '',
    error: null,
  });

  // Latest Confirmed Booking
  const [currentBooking, setCurrentBooking] = useState(null);

  // Stored PNR Database in localStorage
  const [pnrHistory, setPnrHistory] = useState(() => {
    const saved = localStorage.getItem('irctc_pnr_history');
    return saved ? JSON.parse(saved) : SAMPLE_PNRS;
  });

  // Active PNR being searched in PNR status view
  const [pnrLookupResult, setPnrLookupResult] = useState(null);

  // Real-time seat map version trigger for instant UI re-fetch
  const [seatMapVersion, setSeatMapVersion] = useState(0);
  const refreshSeatMap = () => setSeatMapVersion(prev => prev + 1);

  // Sync to local storage
  useEffect(() => {
    if (user && user.isLoggedIn) {
      localStorage.setItem('irctc_user', JSON.stringify(user));
      if (user.token) {
        localStorage.setItem('token', user.token);
      }
    } else {
      localStorage.removeItem('irctc_user');
      localStorage.removeItem('token');
    }
  }, [user]);

  // Update contact details and lead passenger whenever user changes
  useEffect(() => {
    if (user) {
      setContactDetails(prev => ({
        ...prev,
        mobile: user.mobile || user.phone_no || prev.mobile,
        email: user.email || prev.email,
      }));
      setPassengers(prev => prev.map((p, idx) => idx === 0 && !p.name ? { ...p, name: user.name } : p));
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('irctc_pnr_history', JSON.stringify(pnrHistory));
  }, [pnrHistory]);

  // Helper for tomorrow's date
  function getTomorrowDateString() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  // Swap From and To stations
  const swapStations = () => {
    setSearchParams(prev => ({
      ...prev,
      fromStation: prev.toStation,
      toStation: prev.fromStation,
    }));
  };

  // Helper to normalize train data from backend or local seed
  const normalizeTrainData = (t, fromCode, toCode, quota = 'GN') => {
    const fromStop = Array.isArray(t.route)
      ? t.route.find(r => r.stationCode?.toUpperCase() === fromCode?.toUpperCase())
      : null;
    const toStop = Array.isArray(t.route)
      ? t.route.find(r => r.stationCode?.toUpperCase() === toCode?.toUpperCase())
      : null;

    const originCode = fromCode || t.fromStation?.stationCode || (typeof t.originStation === 'object' ? t.originStation.code : t.originStation);
    const destinationCode = toCode || t.toStation?.stationCode || (typeof t.destinationStation === 'object' ? t.destinationStation.code : t.destinationStation);

    const originName = typeof t.originStation === 'object' ? t.originStation.name : (STATIONS.find(s => s.code === originCode)?.name || originCode);
    const destinationName = typeof t.destinationStation === 'object' ? t.destinationStation.name : (STATIONS.find(s => s.code === destinationCode)?.name || destinationCode);

    const depTime = t.departureTime || fromStop?.departureTime || '06:00';
    const arrTime = t.arrivalTime || toStop?.arrivalTime || '14:00';
    const duration = t.duration || '08h 00m';
    const distanceKm = t.distanceKm || (toStop && fromStop ? Math.max(100, (toStop.distanceFromOriginKm || 0) - (fromStop.distanceFromOriginKm || 0)) : 800);

    // Generate or preserve travel classes with dynamic availability & fares
    let classes = t.classes;
    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      const classList = t.availableClasses || ['3A', '2A', '1A', 'SL'];
      const baseRates = {
        '1A': 2.8,
        '2A': 1.8,
        '3A': 1.25,
        '3E': 1.05,
        'CC': 0.98,
        'EC': 2.1,
        'SL': 0.42,
        '2S': 0.22,
      };

      classes = classList.map(cType => {
        const rate = baseRates[cType] || 1.0;
        const fare = Math.round(distanceKm * rate + 100);
        const isAC = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(cType);

        return {
          classType: cType,
          fare,
          availability: {
            GN: {
              status: cType === '1A' ? 'AVAILABLE' : cType === 'SL' ? 'RAC' : 'AVAILABLE',
              seats: cType === '1A' ? 24 : cType === '2A' ? 54 : cType === '3A' ? 72 : cType === 'CC' ? 80 : 72,
              updateTime: 'Live PRS Status',
            },
            TQ: {
              status: isAC ? 'AVAILABLE' : 'WL',
              seats: isAC ? 12 : 25,
              updateTime: 'Tatkal Quota',
            },
            PT: { status: 'AVAILABLE', seats: 8, updateTime: 'Premium Tatkal' },
            LD: { status: 'AVAILABLE', seats: 6, updateTime: 'Ladies Quota' },
            SS: { status: 'AVAILABLE', seats: 4, updateTime: 'Sr. Citizen' },
            HP: { status: 'AVAILABLE', seats: 2, updateTime: 'Divyangjan' },
          },
        };
      });
    }

    // Generate stops from route if stops array is missing
    let stops = t.stops;
    if (!stops || !Array.isArray(stops) || stops.length === 0) {
      if (Array.isArray(t.route)) {
        stops = t.route.map(r => ({
          name: r.station?.name || r.stationCode,
          code: r.stationCode,
          arr: r.arrivalTime || 'Starts',
          dep: r.departureTime || 'Terminates',
          halt: r.haltMinutes ? `${r.haltMinutes}m` : '--',
          day: `Day ${r.dayNumber || 1}`,
          dist: r.distanceFromOriginKm || 0,
        }));
      } else {
        stops = [];
      }
    }

    return {
      ...t,
      id: t._id || t.id || `tr-${t.trainNumber}`,
      trainNumber: t.trainNumber,
      trainName: t.trainName,
      trainType: t.trainType || 'SUPERFAST',
      originStation: originCode,
      destinationStation: destinationCode,
      originStationName: originName,
      destinationStationName: destinationName,
      departureTime: depTime,
      arrivalTime: arrTime,
      duration,
      distanceKm,
      runsOn: t.runsOnDays || t.runsOn || ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      pantry: t.pantry !== undefined ? t.pantry : ['VANDE_BHARAT', 'RAJDHANI', 'SHATABDI', 'DURONTO', 'SUPERFAST'].includes(t.trainType),
      classes,
      stops,
    };
  };

  // Search trains from backend API: GET /api/trains/search?from=...&to=...&date=...&quota=...
  const performTrainSearch = useCallback(async (customParams) => {
    const from = (customParams?.fromStation || searchParams.fromStation).trim().toUpperCase();
    const to = (customParams?.toStation || searchParams.toStation).trim().toUpperCase();
    const date = customParams?.journeyDate || searchParams.journeyDate;
    const quota = customParams?.quota || searchParams.quota || 'GN';

    setIsSearching(true);
    setSearchError(null);

    try {
      const url = `/api/trains/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}&quota=${encodeURIComponent(quota)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.trains)) {
        const normalized = data.trains.map(t => normalizeTrainData(t, from, to, quota));
        setSearchResults(normalized);
        setIsSearching(false);
        return { success: true, trains: normalized };
      } else if (res.status === 404 || (data && !data.success && data.count === 0)) {
        setSearchResults([]);
        setSearchError(data.message || `No direct trains found operating between ${from} and ${to} on ${date}.`);
        setIsSearching(false);
        return { success: false, trains: [], message: data.message };
      } else {
        throw new Error(data.message || 'Train search request failed');
      }
    } catch (err) {
      console.warn('Backend search API unavailable, using fallback dataset:', err.message);
      const fallback = INITIAL_TRAINS.map(t => normalizeTrainData(t, from, to, quota));
      setSearchResults(fallback);
      setIsSearching(false);
      return { success: true, trains: fallback, isFallback: true };
    }
  }, [searchParams]);

  // Requirement 3: Save complete context package (Train Number, Train Name, From Station, To Station, Journey Date, Class, Quota)
  const selectTrainForBooking = useCallback((trainData, classData, customParams = null) => {
    const from = customParams?.fromStation || searchParams.fromStation;
    const to = customParams?.toStation || searchParams.toStation;
    const date = customParams?.journeyDate || searchParams.journeyDate;
    const quota = customParams?.quota || searchParams.quota || 'GN';

    const originName = STATIONS.find(s => s.code === from)?.name || from;
    const destName = STATIONS.find(s => s.code === to)?.name || to;

    const contextPackage = {
      trainNumber: trainData.trainNumber,
      trainName: trainData.trainName,
      trainType: trainData.trainType || 'SUPERFAST',
      fromStation: from,
      fromStationName: originName,
      toStation: to,
      toStationName: destName,
      journeyDate: date,
      class: classData.classType,
      quota: quota,
      fare: classData.fare,
      availability: classData.availability?.[quota] || classData.availability?.GN || { status: 'AVAILABLE', seats: 20 },
      departureTime: trainData.departureTime,
      arrivalTime: trainData.arrivalTime,
      duration: trainData.duration,
      train: trainData,
      classItem: classData,
    };

    setBookingContext(contextPackage);
    setSelectedTrain({
      ...trainData,
      ...contextPackage,
    });
    setSelectedClass({
      ...classData,
      quota,
      journeyDate: date,
    });
    return contextPackage;
  }, [searchParams]);

  // Passenger management
  const addPassenger = () => {
    const maxPassengers = searchParams.quota === 'TQ' ? 4 : 6;
    if (passengers.length >= maxPassengers) {
      alert(`Maximum of ${maxPassengers} passengers allowed under ${searchParams.quota === 'TQ' ? 'Tatkal' : 'General'} quota.`);
      return;
    }

    setPassengers(prev => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        name: '',
        age: '',
        gender: 'MALE',
        berthPreference: 'NO_PREFERENCE',
        foodPreference: 'VEG',
      },
    ]);
  };

  const removePassenger = (id) => {
    if (passengers.length === 1) {
      alert('At least one passenger is required for ticket booking.');
      return;
    }
    setPassengers(prev => prev.filter(p => p.id !== id));
  };

  const updatePassenger = (id, field, value) => {
    setPassengers(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const fillSamplePassengers = () => {
    setPassengers([
      {
        id: 'p-1',
        name: user?.name || 'Rohan Mehta',
        age: user?.age ? String(user.age) : '29',
        gender: user?.gender || 'MALE',
        berthPreference: 'LOWER',
        foodPreference: 'VEG',
      },
      {
        id: 'p-2',
        name: 'Simran Mehta',
        age: '27',
        gender: 'FEMALE',
        berthPreference: 'MIDDLE',
        foodPreference: 'VEG',
      },
    ]);
  };

  // Fare calculations
  const calculateFare = () => {
    if (!selectedClass) return { baseFare: 0, tatkalCharge: 0, convenienceFee: 0, insurance: 0, gst: 0, totalFare: 0 };

    const passengerCount = Math.max(1, passengers.length);
    const unitBaseFare = selectedClass.fare;
    const baseFareTotal = unitBaseFare * passengerCount;

    // Tatkal surcharge: 10% for second class, 30% for AC classes
    const activeQuota = String(
      selectedClass?.quota ||
      bookingContext?.quota ||
      selectedTrain?.quota ||
      searchParams?.quota ||
      'GN'
    ).trim().toUpperCase();

    let tatkalCharge = 0;
    if (activeQuota === 'TQ' || activeQuota === 'PT') {
      const isAC = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(selectedClass.classType);
      tatkalCharge = Math.round((isAC ? 0.3 : 0.1) * baseFareTotal);
    }

    // IRCTC Convenience fee
    const isAC = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(selectedClass.classType);
    const convenienceFee = isAC ? 30.0 : 15.0;
    const convenienceGst = +(convenienceFee * 0.18).toFixed(2);
    const convenienceFeeTotal = +(convenienceFee + convenienceGst).toFixed(2);

    // Optional travel insurance (₹0.45 per passenger)
    const insuranceTotal = contactDetails.travelInsurance ? +(0.45 * passengerCount).toFixed(2) : 0;

    // GST on AC fares (5%)
    const gstTotal = isAC ? Math.round(baseFareTotal * 0.05) : 0;

    const totalFare = Math.round(baseFareTotal + tatkalCharge + convenienceFeeTotal + insuranceTotal + gstTotal);

    return {
      passengerCount,
      unitBaseFare,
      baseFare: baseFareTotal,
      tatkalCharge,
      convenienceFee: convenienceFeeTotal,
      insurance: insuranceTotal,
      gst: gstTotal,
      totalFare,
    };
  };

  // Generate Realistic 10-Digit Indian Railways PNR
  const generatePNR = () => {
    const zonePrefixes = ['245', '831', '610', '422', '124', '759'];
    const prefix = zonePrefixes[Math.floor(Math.random() * zonePrefixes.length)];
    const suffix = Math.floor(1000000 + Math.random() * 9000000).toString();
    return `${prefix}${suffix}`;
  };

  // Perform Booking & Confirmation
  const confirmBooking = (txnDetails) => {
    const pnr = generatePNR();
    const fare = calculateFare();
    const fromStn = STATIONS.find(s => s.code === searchParams.fromStation) || { name: searchParams.fromStation };
    const toStn = STATIONS.find(s => s.code === searchParams.toStation) || { name: searchParams.toStation };

    // Explicitly resolve the active quota from selectedClass, bookingContext, selectedTrain, or searchParams
    const resolvedBookingQuota = String(
      selectedClass?.quota ||
      bookingContext?.quota ||
      selectedTrain?.quota ||
      searchParams?.quota ||
      'GN'
    ).trim().toUpperCase();

    // Coach and seat allocator
    const coachPrefix = {
      '1A': 'H',
      '2A': 'A',
      '3A': 'B',
      '3E': 'M',
      'SL': 'S',
      'CC': 'C',
      'EC': 'E',
      '2S': 'D',
    }[selectedClass.classType] || 'B';

    const coachNumber = `${coachPrefix}1`;
    const startSeat = Math.floor(Math.random() * 20) + 1;

    const statusBadge =
      selectedClass.availability?.[resolvedBookingQuota]?.status ||
      selectedClass.availability?.GN?.status ||
      'AVAILABLE';
    const isWaitlisted = statusBadge === 'WL';
    const isRAC = statusBadge === 'RAC';

    const allocatedPassengers = passengers.map((p, idx) => {
      let bStatus = 'CNF';
      let cStatus = 'CNF';
      let coach = coachNumber;
      let seat = startSeat + idx;
      const prefUpper = String(p.berthPreference || 'NO_PREFERENCE').toUpperCase();
      let berth = prefUpper !== 'NO_PREFERENCE' ? prefUpper : (selectedClass.classType === 'CC' ? 'WINDOW' : 'LOWER');
      if (['WS', 'WN', 'WINDOW_SEAT'].includes(berth)) berth = 'WINDOW';
      else if (['UB', 'UPPER_BERTH'].includes(berth)) berth = 'UPPER';
      else if (['LB', 'LOWER_BERTH'].includes(berth)) berth = 'LOWER';
      else if (['MB', 'MIDDLE_BERTH', 'MIDDLE_SEAT', 'MS'].includes(berth)) berth = 'MIDDLE';
      else if (['SL', 'SIDE_LOWER_BERTH'].includes(berth)) berth = 'SIDE_LOWER';
      else if (['SU', 'SIDE_UPPER_BERTH'].includes(berth)) berth = 'SIDE_UPPER';
      let waitingNo = null;

      if (isWaitlisted) {
        bStatus = 'WL';
        cStatus = 'WL';
        coach = null;
        seat = null;
        berth = null;
        waitingNo = idx + 6;
      } else if (isRAC) {
        bStatus = 'RAC';
        cStatus = 'RAC';
        coach = coachNumber;
        seat = 63;
        berth = 'SIDE_LOWER';
        waitingNo = idx + 10;
      }

      return {
        id: p.id || `p-${idx}`,
        name: p.name || `Passenger ${idx + 1}`,
        age: Number(p.age) || 30,
        gender: p.gender || 'MALE',
        berthPreference: p.berthPreference || 'NO_PREFERENCE',
        bookingStatus: bStatus,
        currentStatus: cStatus,
        allocatedCoach: coach,
        coachNumber: coach,
        allocatedSeatNumber: seat,
        seatNumber: seat,
        berthNumber: seat,
        allocatedBerth: berth,
        waitingNumber: waitingNo,
      };
    });

    const overallStatus = isWaitlisted ? 'WAITLISTED' : isRAC ? 'RAC' : 'CONFIRMED';

    const newBooking = {
      userId: user?.userId || user?._id || user?.username || null,
      pnr,
      trainId: selectedTrain._id || selectedTrain.id || null,
      trainNumber: selectedTrain.trainNumber,
      trainName: selectedTrain.trainName,
      trainType: selectedTrain.trainType,
      journeyDate: searchParams.journeyDate,
      fromStation: searchParams.fromStation,
      fromStationCode: searchParams.fromStation,
      fromStationName: fromStn.name,
      toStation: searchParams.toStation,
      toStationCode: searchParams.toStation,
      toStationName: toStn.name,
      departureTime: selectedTrain.departureTime,
      arrivalTime: selectedTrain.arrivalTime,
      duration: selectedTrain.duration,
      classType: selectedClass.classType,
      quota: resolvedBookingQuota,
      bookingStatus: overallStatus,
      chartStatus: 'CHART NOT PREPARED',
      bookedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      fareDetails: fare,
      passengers: allocatedPassengers,
      contactDetails,
      paymentDetails: {
        transactionId: `TXN${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        paymentMode: txnDetails?.mode || paymentMethod,
        paidAt: new Date().toISOString(),
        paymentStatus: 'SUCCESS',
      },
    };

    // Save in history and set active immediately for responsive UI
    setCurrentBooking(newBooking);
    setPnrHistory(prev => [newBooking, ...prev]);
    setActiveViewRaw('pnr');
    refreshSeatMap();

    // 1. Enqueue booking request to BullMQ high-concurrency queue
    const queuePayload = {
      userId: user?.userId || user?._id || user?.id || '000000000000000000000001',
      pnr: newBooking.pnr,
      trainId: selectedTrain._id || selectedTrain.id,
      trainNumber: selectedTrain.trainNumber,
      journeyDate: searchParams.journeyDate,
      fromStation: searchParams.fromStation,
      toStation: searchParams.toStation,
      fromStationCode: searchParams.fromStation,
      toStationCode: searchParams.toStation,
      classType: selectedClass.classType,
      quota: resolvedBookingQuota,
      passengers: passengers.map((p) => ({
        name: p.name || 'Passenger',
        age: Number(p.age) || 30,
        gender: p.gender || 'MALE',
        berthPreference: p.berthPreference || 'NO_PREFERENCE',
      })),
      fareDetails: fare,
      paymentDetails: newBooking.paymentDetails,
    };

    fetch('/api/bookings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify(queuePayload),
    })
      .then((res) => res.json())
      .then((result) => {
        console.log('⚡ [BullMQ:Queue] Job enqueued from client:', result);
        refreshSeatMap();
        if (!result?.success) {
          syncDirectly();
        }
      })
      .catch((err) => {
        console.warn('⚠️ [BullMQ:Queue] Enqueue error, falling back to direct confirmation:', err);
        syncDirectly();
      });

    // 2. Direct persistence fallback to ensure immediate DB record and seat linkage
    function syncDirectly() {
      fetch('/api/bookings/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify(newBooking),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result?.success && result?.data) {
            const dbBooking = result.data;
            const mergedPassengers = newBooking.passengers.map((p, idx) => ({
              ...p,
              _id: dbBooking.passengers?.[idx]?._id || p._id,
            }));
            const syncedBooking = {
              ...newBooking,
              _id: dbBooking._id,
              passengers: mergedPassengers,
            };
            setCurrentBooking((prev) => (prev && prev.pnr === newBooking.pnr ? syncedBooking : prev));
            setPnrHistory((prev) => prev.map((b) => (b.pnr === newBooking.pnr ? syncedBooking : b)));
            refreshSeatMap();
          }
        })
        .catch((err) => {
          console.error('Failed to sync booking with backend:', err);
        });
    }

    return newBooking;
  };

  // Update local booking state after backend ticket cancellation succeeds
  const applyBookingCancellation = (pnr, cancellationData) => {
    const cancelledIds = (cancellationData?.cancelledPassengerIds || []).map(String);
    const updateBookingObj = (b) => {
      if (!b || b.pnr !== pnr) return b;
      const updatedPassengers = (b.passengers || []).map((p, idx) => {
        const dbMatch = cancellationData?.passengers?.[idx];
        if (dbMatch) {
          return {
            ...p,
            _id: dbMatch._id || p._id,
            currentStatus: dbMatch.currentStatus,
            waitingNumber: dbMatch.waitingNumber,
          };
        }
        const pid = String(p._id || p.id || '');
        if (!cancelledIds.length || cancelledIds.includes(pid)) {
          return { ...p, currentStatus: 'CAN', waitingNumber: null };
        }
        return p;
      });
      const activeRemaining = updatedPassengers.filter(p => p.currentStatus !== 'CAN');
      const nextStatus =
        cancellationData?.bookingStatus ||
        (activeRemaining.length === 0 ? 'CANCELLED' : 'PARTIALLY_CANCELLED');
      return {
        ...b,
        bookingStatus: nextStatus,
        passengers: updatedPassengers,
      };
    };

    setCurrentBooking(prev => updateBookingObj(prev));
    setPnrHistory(prev => prev.map(updateBookingObj));
    setPnrLookupResult(prev => updateBookingObj(prev));
    refreshSeatMap();
  };

  // Lookup PNR in existing history or generate live simulation
  const lookupPNR = (pnrNumber) => {
    const cleanPNR = (pnrNumber || '').replace(/[^0-9]/g, '');
    const found = pnrHistory.find(b => b.pnr === cleanPNR);
    if (found) {
      setPnrLookupResult(found);
      return { success: true, booking: found };
    }

    if (cleanPNR.length === 10) {
      const sampleTrain = INITIAL_TRAINS[0];
      const synthetic = {
        pnr: cleanPNR,
        trainNumber: sampleTrain.trainNumber,
        trainName: sampleTrain.trainName,
        trainType: sampleTrain.trainType,
        journeyDate: getTomorrowDateString(),
        fromStation: 'NDLS',
        fromStationName: 'New Delhi',
        toStation: 'MMCT',
        toStationName: 'Mumbai Central',
        departureTime: '16:55',
        arrivalTime: '08:35',
        duration: '15h 40m',
        classType: '3A',
        quota: 'GN',
        bookingStatus: 'CONFIRMED',
        chartStatus: 'CHART NOT PREPARED',
        bookedAt: 'Earlier Today IST',
        fareDetails: {
          baseFare: 2040,
          tatkalCharge: 0,
          convenienceFee: 35.4,
          insurance: 0.45,
          totalFare: 2075.85,
        },
        passengers: [
          {
            id: 'p1',
            name: user?.name || 'Passenger 1',
            age: 32,
            gender: 'MALE',
            berthPreference: 'LOWER',
            bookingStatus: 'CNF',
            currentStatus: 'CNF',
            allocatedCoach: 'B3',
            allocatedSeatNumber: 28,
            allocatedBerth: 'LOWER',
            waitingNumber: null,
          },
        ],
        paymentDetails: {
          transactionId: `TXN${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          paymentMode: 'UPI (Bhim / GPay)',
          paidAt: new Date().toISOString(),
          paymentStatus: 'SUCCESS',
        },
      };
      setPnrLookupResult(synthetic);
      return { success: true, booking: synthetic };
    }

    setPnrLookupResult(null);
    return { success: false, message: 'Invalid PNR Number. Please enter a valid 10-digit number.' };
  };

  // Dynamic user login: accepts custom credentials or API response
  const loginUser = (userCredentialOrObject, token) => {
    let newUser;

    if (typeof userCredentialOrObject === 'object' && userCredentialOrObject !== null) {
      const u = userCredentialOrObject;
      const derivedName = u.fullName || u.name || (u.username ? u.username.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'IRCTC User');
      
      newUser = {
        isLoggedIn: true,
        username: u.username || u.phone_no || 'user',
        userId: u._id || u.id || u.username || u.phone_no || null,
        name: derivedName,
        mobile: u.phone_no || u.mobile || '',
        email: u.email || `${(u.username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@irctc.res.in`,
        irctcId: u.irctcId || `IRCTC-IN-${Math.floor(100000 + Math.random() * 900000)}`,
        role: u.role || 'user',
        age: u.age || '',
        gender: u.gender || '',
        savedPassengers: Array.isArray(u.savedPassengers) ? u.savedPassengers : [],
        token: token || u.token || `jwt_${Date.now()}`,
      };
    } else {
      const rawId = String(userCredentialOrObject || '').trim();
      const isPhone = /^\d{10}$/.test(rawId);
      
      let displayName;
      if (isPhone) {
        displayName = `User (${rawId.slice(-4)})`;
      } else if (rawId) {
        displayName = rawId
          .split(/[._-]/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      } else {
        displayName = 'Railway Passenger';
      }

      newUser = {
        isLoggedIn: true,
        username: rawId || 'user',
        name: displayName,
        mobile: isPhone ? rawId : '9876543210',
        email: rawId.includes('@') ? rawId : `${rawId.toLowerCase().replace(/[^a-z0-9]/g, '')}@irctc.res.in`,
        irctcId: `IRCTC-IN-${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'user',
        token: token || `jwt_custom_${Date.now()}`,
      };
    }

    setUser(newUser);
    localStorage.setItem('irctc_user', JSON.stringify(newUser));
    if (newUser.token) {
      localStorage.setItem('token', newUser.token);
    }

    setContactDetails(prev => ({
      ...prev,
      mobile: newUser.mobile || prev.mobile,
      email: newUser.email || prev.email,
    }));

    setPassengers(prev =>
      prev.map((p, idx) => (idx === 0 && !p.name ? { ...p, name: newUser.name } : p))
    );

    setActiveViewRaw('search');
    return newUser;
  };

  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem('irctc_user');
    localStorage.removeItem('token');
    setPassengers([
      {
        id: 'p-1',
        name: '',
        age: '',
        gender: 'MALE',
        berthPreference: 'NO_PREFERENCE',
        foodPreference: 'VEG',
      },
    ]);
    setActiveViewRaw('login');
  };

  const updateUser = (updates) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...updates } : currentUser));
  };

  return (
    <BookingContext.Provider
      value={{
        activeView,
        setActiveView,
        user,
        loginUser,
        logoutUser,
        updateUser,
        searchParams,
        setSearchParams,
        searchResults,
        setSearchResults,
        isSearching,
        searchError,
        performTrainSearch,
        swapStations,
        resultsFilters,
        setResultsFilters,
        selectedTrain,
        setSelectedTrain,
        selectedClass,
        setSelectedClass,
        bookingContext,
        setBookingContext,
        selectTrainForBooking,
        passengers,
        setPassengers,
        addPassenger,
        removePassenger,
        updatePassenger,
        fillSamplePassengers,
        contactDetails,
        setContactDetails,
        calculateFare,
        paymentMethod,
        setPaymentMethod,
        paymentState,
        setPaymentState,
        confirmBooking,
        applyBookingCancellation,
        seatMapVersion,
        refreshSeatMap,
        currentBooking,
        setCurrentBooking,
        pnrHistory,
        pnrLookupResult,
        setPnrLookupResult,
        lookupPNR,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
