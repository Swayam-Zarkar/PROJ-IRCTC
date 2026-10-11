const statusClass = {
  AVAILABLE: 'border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100',
  BOOKED: 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  RAC: 'border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200',
  WL: 'border-yellow-500 bg-yellow-100 text-yellow-950 hover:bg-yellow-200',
  TQ: 'border-purple-600 bg-purple-100 text-purple-950 hover:bg-purple-200',
  PT: 'border-purple-700 bg-purple-200 text-purple-950 hover:bg-purple-300',
};

export default function Seat({ seat, onSelect }) {
  if (!seat) {
    return <div className="h-16 min-w-0 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50" />;
  }

  const activeClass = statusClass[seat.status] || statusClass.AVAILABLE;

  return (
    <button
      type="button"
      onClick={() => onSelect && onSelect(seat)}
      className={`h-16 min-w-0 rounded-lg border-2 px-1 text-center shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeClass}`}
      aria-label={`Seat ${seat.seatNumber}, ${seat.berthType}, ${seat.status}`}
    >
      <span className="block text-sm font-black leading-5">{seat.seatNumber}</span>
      <span className="block text-[10px] font-bold tracking-wide">{seat.shortLabel}</span>
    </button>
  );
}
