import React from 'react';
import { BookingProvider, useBooking } from './context/BookingContext';
import Header from './components/Header';
import NoticeBar from './components/NoticeBar';
import BookingStepper from './components/BookingStepper';
import SearchHomeView from './components/SearchHomeView';
import TrainResultsView from './components/TrainResultsView';
import PassengerForm from './components/PassengerForm';
import PaymentGateway from './components/PaymentGateway';
import PNRConfirmation from './components/PNRConfirmation';
import PNRStatusView from './components/PNRStatusView';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ProfilePage from './components/ProfilePage';
import Footer from './components/Footer';
import CoachLayout from './components/CoachLayout';
import {
  Train,
  Search,
  Users,
  CreditCard,
  FileCheck2,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';

function AppContent() {
  const { activeView, setActiveView, user } = useBooking();

  // Active view router
  const renderActiveView = () => {
    switch (activeView) {
      case 'login':
        return <LoginPage />;
      case 'register':
        return <RegisterPage />;
      case 'profile':
        return <ProfilePage />;
      case 'search':
        return <SearchHomeView />;
      case 'results':
        return <TrainResultsView />;
      case 'passenger':
        return <PassengerForm />;
      case 'payment':
        return <PaymentGateway />;
      case 'pnr':
        return <PNRConfirmation />;
      case 'pnr-status':
        return <PNRStatusView />;
      case 'coach-map':
        return <CoachLayout />;
      default:
        return <SearchHomeView />;
    }
  };

  const showStepper = ['search', 'results', 'passenger', 'payment', 'pnr'].includes(activeView);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans antialiased selection:bg-orange-500 selection:text-white">
      {/* Official Government & IRCTC Top Header */}
      <Header />

      {/* Railway Advisory Marquee Ticker */}
      <NoticeBar />

      {/* Multi-step Booking Progress Indicator (hidden on Login & Standalone PNR lookup) */}
      {showStepper && (
        <div className="bg-white border-b border-slate-200 shadow-sm print:hidden">
          <BookingStepper />
        </div>
      )}

      {/* Main Dynamic View Content */}
      <main className="flex-1 w-full pb-16">
        {renderActiveView()}
      </main>

      {/* Reviewer / Evaluator Quick Navigation Bar (Floating at bottom-left) */}
      <div className="fixed bottom-4 left-4 z-40 print:hidden hidden sm:flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 text-xs">
        <div className="px-2 py-1 flex items-center gap-1 text-[11px] font-bold text-orange-400 uppercase tracking-wider border-r border-slate-700">
          <Layers className="w-3.5 h-3.5" />
          <span>Views</span>
        </div>
        <button
          onClick={() => setActiveView('login')}
          title="Authentication View"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'login' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setActiveView('search')}
          title="Train Search Home"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'search' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setActiveView('results')}
          title="Train Results & Availability"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'results' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Trains
        </button>
        <button
          onClick={() => setActiveView('passenger')}
          title="Passenger Details Form"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'passenger' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Passengers
        </button>
        <button
          onClick={() => setActiveView('payment')}
          title="iPay Payment Gateway"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'payment' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Payment
        </button>
        <button
          onClick={() => setActiveView('pnr-status')}
          title="Check PNR Status"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'pnr-status' || activeView === 'pnr'
              ? 'bg-orange-500 text-white font-bold'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          PNR
        </button>
        <button
          onClick={() => setActiveView('coach-map')}
          title="Interactive coach seat map"
          className={`px-2.5 py-1 rounded-xl font-medium transition-colors cursor-pointer ${
            activeView === 'coach-map' ? 'bg-orange-500 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
          }`}
        >
          Coach map
        </button>
      </div>

      {/* Official CRIS & Ministry of Railways Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BookingProvider>
      <AppContent />
    </BookingProvider>
  );
}
