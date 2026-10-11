const statusClass = { AVAILABLE: 'bg-emerald-500', BOOKED: 'bg-slate-700', RAC: 'bg-amber-500' };

export default function TimelineDrawer({ seat, onClose }) {
  if (!seat) return null;
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40" onClick={onClose}>
    <section className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-3xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Seat journey timeline">
      <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Seat journey</p><h2 className="text-xl font-black text-slate-900">{seat.coachNumber} · {seat.seatNumber} {seat.shortLabel}</h2></div><button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button></div>
      <div className="overflow-x-auto"><ol className="flex min-w-[620px] items-start">{seat.journeyLegs.map((leg, index) => <li key={`${leg.from}-${leg.to}`} className="flex flex-1 items-start last:flex-none"><div className="min-w-24"><span className={`mx-auto mb-2 block h-4 w-4 rounded-full ring-4 ring-white ${statusClass[leg.status]}`} /><p className="text-xs font-bold text-slate-800">{leg.from}</p><p className="mt-1 text-[11px] text-slate-500">to {leg.to}</p><span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{leg.status}</span></div>{index < seat.journeyLegs.length - 1 && <div className="mt-2 h-1 flex-1 bg-slate-200"><div className={`h-full w-full ${statusClass[leg.status]}`} /></div>}</li>)}</ol></div>
    </section>
  </div>;
}
