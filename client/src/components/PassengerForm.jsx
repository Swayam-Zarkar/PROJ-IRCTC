import React, { useState } from 'react';
import { 
  ArrowLeft, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  Train, 
  CreditCard, 
  Sparkles,
  Zap
} from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { STATIONS } from '../data/trainsData';

export default function PassengerForm() {
  const { 
    selectedTrain, 
    selectedClass, 
    searchParams, 
    passengers, 
    addPassenger, 
    removePassenger, 
    updatePassenger, 
    setPassengers,
    fillSamplePassengers, 
    contactDetails, 
    setContactDetails, 
    calculateFare, 
    setActiveView,
    user
  } = useBooking();

  const [formErrors, setFormErrors] = useState({});
  const savedPassengers = user?.savedPassengers || [];

  const activeQuota = (selectedClass?.quota || searchParams?.quota || 'GN').toUpperCase();

  const addSavedPassengerToBooking = (savedPassenger) => {
    const passengerData = {
      name: savedPassenger.name,
      age: String(savedPassenger.age),
      gender: savedPassenger.gender,
      berthPreference: savedPassenger.berthPreference || 'NO_PREFERENCE',
      foodPreference: 'VEG',
    };
    const maximumPassengers = (activeQuota === 'TQ' || activeQuota === 'PT') ? 4 : 6;

    setPassengers((currentPassengers) => {
      const emptyPassengerIndex = currentPassengers.findIndex((passenger) => !passenger.name && !passenger.age);
      if (emptyPassengerIndex >= 0) {
        return currentPassengers.map((passenger, index) => index === emptyPassengerIndex ? { ...passenger, ...passengerData } : passenger);
      }
      if (currentPassengers.length >= maximumPassengers) {
        alert(`Only ${maximumPassengers} passengers are allowed for this quota.`);
        return currentPassengers;
      }
      return [...currentPassengers, { id: `saved-${Date.now()}`, ...passengerData }];
    });
  };

  if (!selectedTrain || !selectedClass) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-xl shadow-md border text-center">
        <Train className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No Train Selected</h3>
        <p className="text-xs text-slate-500 mb-4">Please select a train and travel class from the search results first.</p>
        <button
          onClick={() => setActiveView('search')}
          className="bg-[#0f2c59] text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-[#1a4484] cursor-pointer"
        >
          Return to Train Search
        </button>
      </div>
    );
  }

  const fromStn = STATIONS.find(s => s.code === searchParams.fromStation) || { name: searchParams.fromStation };
  const toStn = STATIONS.find(s => s.code === searchParams.toStation) || { name: searchParams.toStation };
  const fare = calculateFare();

  const berthOptions = [
    { value: 'NO_PREFERENCE', label: 'No Preference' },
    { value: 'LOWER', label: 'Lower Berth' },
    { value: 'MIDDLE', label: 'Middle Berth' },
    { value: 'UPPER', label: 'Upper Berth' },
    { value: 'SIDE_LOWER', label: 'Side Lower Berth' },
    { value: 'SIDE_UPPER', label: 'Side Upper Berth' },
    { value: 'WINDOW', label: 'Window Seat (for CC/EC)' },
  ];

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    const errors = {};

    // Validate passengers
    passengers.forEach((p, idx) => {
      if (!p.name || p.name.trim().length < 2) {
        errors[`name_${idx}`] = 'Enter valid passenger name';
      }
      const ageNum = parseInt(p.age);
      if (!p.age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        errors[`age_${idx}`] = 'Enter valid age (1-120)';
      }
    });

    if (!contactDetails.mobile || contactDetails.mobile.length !== 10) {
      errors.mobile = 'Enter valid 10-digit mobile number';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      alert('Please fill all required passenger details properly.');
      return;
    }

    setFormErrors({});
    setActiveView('payment');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => setActiveView('results')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0f2c59] mb-4 group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Train Search Results</span>
      </button>

      {/* Main Journey Highlight Header */}
      <div className="bg-[#0f2c59] text-white p-5 rounded-xl shadow-md mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-orange-400 bg-[#1a3d72] px-2 py-0.5 rounded">
                #{selectedTrain.trainNumber}
              </span>
              <span className="text-base font-bold">{selectedTrain.trainName}</span>
              {(activeQuota === 'TQ' || activeQuota === 'PT') && (
                <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-white" /> {activeQuota === 'PT' ? 'PREMIUM TATKAL' : 'TATKAL QUOTA'}
                </span>
              )}
            </div>

            <div className="text-sm font-semibold flex items-center gap-2">
              <span>{fromStn.name} ({searchParams.fromStation})</span>
              <span className="text-orange-400 font-bold">➔</span>
              <span>{toStn.name} ({searchParams.toStation})</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs bg-[#1a3d72]/80 px-4 py-2.5 rounded-lg border border-slate-700">
            <div>
              <div className="text-slate-400 text-[10px]">Journey Date</div>
              <div className="font-bold text-amber-300">{searchParams.journeyDate}</div>
            </div>
            <div className="w-px h-8 bg-slate-600"></div>
            <div>
              <div className="text-slate-400 text-[10px]">Class & Quota</div>
              <div className="font-bold text-white">
                {selectedClass.classType} • {activeQuota}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-600"></div>
            <div>
              <div className="text-slate-400 text-[10px]">Departs</div>
              <div className="font-bold text-white">{selectedTrain.departureTime}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Passenger Roster (Col 1-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Passenger Roster Box */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-5 bg-orange-600 rounded-xs"></span>
                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                  Passenger Details ({passengers.length} of {(activeQuota === 'TQ' || activeQuota === 'PT') ? 4 : 6} Max)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fillSamplePassengers}
                  className="text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>Fill Sample Passengers</span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {savedPassengers.length > 0 && (
                <div className="border border-blue-200 bg-blue-50/60 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide mb-2">Add from Master Passenger List</div>
                  <div className="flex flex-wrap gap-2">
                    {savedPassengers.map((savedPassenger) => (
                      <button key={savedPassenger._id || savedPassenger.id} type="button" onClick={() => addSavedPassengerToBooking(savedPassenger)} className="px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer">
                        {savedPassenger.name} <span className="text-blue-600">({savedPassenger.age})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {passengers.map((passenger, index) => (
                <div 
                  key={passenger.id} 
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0f2c59] uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0f2c59] text-white flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      <span>Passenger {index + 1}</span>
                    </span>

                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(passenger.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        title="Remove Passenger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Name */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={passenger.name}
                        onChange={(e) => updatePassenger(passenger.id, 'name', e.target.value)}
                        placeholder="As on Govt ID"
                        className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59] ${
                          formErrors[`name_${index}`] ? 'border-red-500 bg-red-50' : 'border-slate-300'
                        }`}
                        required
                      />
                      {formErrors[`name_${index}`] && (
                        <p className="text-[10px] text-red-500 mt-0.5">{formErrors[`name_${index}`]}</p>
                      )}
                    </div>

                    {/* Age */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Age *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={passenger.age}
                        onChange={(e) => updatePassenger(passenger.id, 'age', e.target.value)}
                        placeholder="Years"
                        className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59] ${
                          formErrors[`age_${index}`] ? 'border-red-500 bg-red-50' : 'border-slate-300'
                        }`}
                        required
                      />
                      {formErrors[`age_${index}`] && (
                        <p className="text-[10px] text-red-500 mt-0.5">{formErrors[`age_${index}`]}</p>
                      )}
                    </div>

                    {/* Gender */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Gender *
                      </label>
                      <select
                        value={passenger.gender}
                        onChange={(e) => updatePassenger(passenger.id, 'gender', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59] cursor-pointer"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Transgender</option>
                      </select>
                    </div>

                    {/* Berth Preference */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Berth Preference
                      </label>
                      <select
                        value={passenger.berthPreference}
                        onChange={(e) => updatePassenger(passenger.id, 'berthPreference', e.target.value)}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59] cursor-pointer"
                      >
                        {berthOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Passenger Action */}
              <button
                type="button"
                onClick={addPassenger}
                className="w-full py-2.5 border-2 border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/40 hover:bg-orange-50 text-orange-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ ADD ANOTHER PASSENGER</span>
              </button>
            </div>
          </div>

          {/* Contact Details & Preferences */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 space-y-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2 h-5 bg-[#0f2c59] rounded-xs"></span>
              <span>Contact Information (For SMS & E-Ticket Slip)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (SMS alerts) *
                </label>
                <div className="flex">
                  <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 text-xs font-bold text-slate-600 rounded-l-lg">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={contactDetails.mobile}
                    onChange={(e) => setContactDetails(prev => ({ ...prev, mobile: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-r-lg focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59]"
                    required
                  />
                </div>
                {formErrors.mobile && (
                  <p className="text-[10px] text-red-500 mt-0.5">{formErrors.mobile}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email ID (For E-Ticket PDF) *
                </label>
                <input
                  type="email"
                  value={contactDetails.email}
                  onChange={(e) => setContactDetails(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0f2c59]"
                  required
                />
              </div>
            </div>

            {/* Checkbox Preferences */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={contactDetails.travelInsurance}
                  onChange={(e) => setContactDetails(prev => ({ ...prev, travelInsurance: e.target.checked }))}
                  className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <strong>Consider for Travel Insurance</strong> (₹0.45/person). Includes comprehensive emergency transit cover.
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={contactDetails.autoUpgradation}
                  onChange={(e) => setContactDetails(prev => ({ ...prev, autoUpgradation: e.target.checked }))}
                  className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <strong>Consider for Auto-Upgradation</strong> to higher AC class at no extra charge if berths are vacant during chart preparation.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Fare Breakdown Box (Col 9-12) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 sticky top-20 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center justify-between">
              <span>Fare Breakdown</span>
              <span className="text-xs font-normal text-slate-500">{passengers.length} Passenger(s)</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Base Fare ({selectedClass.classType} × {passengers.length})</span>
                <span className="font-semibold text-slate-800">₹{fare.baseFare}</span>
              </div>

              {fare.tatkalCharge > 0 && (
                <div className="flex justify-between text-orange-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-orange-500" /> Tatkal Quota Surcharge
                  </span>
                  <span>+₹{fare.tatkalCharge}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>IRCTC Convenience Fee (incl. GST)</span>
                <span className="font-semibold text-slate-800">₹{fare.convenienceFee}</span>
              </div>

              {fare.insurance > 0 && (
                <div className="flex justify-between">
                  <span>Travel Insurance</span>
                  <span className="font-semibold text-slate-800">₹{fare.insurance}</span>
                </div>
              )}

              {fare.gst > 0 && (
                <div className="flex justify-between">
                  <span>Railway GST (5% AC Services)</span>
                  <span className="font-semibold text-slate-800">₹{fare.gst}</span>
                </div>
              )}

              <div className="pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-sm">Total Payable Amount</span>
                <span className="text-xl font-black text-[#0f2c59]">₹{fare.totalFare}</span>
              </div>
            </div>

            {/* Terms notice */}
            <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-500 leading-snug flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Free cancellation up to 48 hours before scheduled departure as per Railway refund rules.</span>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleProceedToPayment}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>PROCEED TO PAYMENT (₹{fare.totalFare})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
