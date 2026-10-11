import Seat from './Seat';

const groups = [['LOWER', 'MIDDLE', 'UPPER'], ['CABIN', 'COUPE', 'WINDOW', 'MIDDLE_SEAT', 'AISLE'], ['SIDE_LOWER', 'SIDE_UPPER']];

export default function CoachRow({ row, onSelect }) {
  return <div className="grid min-w-[760px] grid-cols-[3fr_0.45fr_5fr_0.45fr_2fr] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
    <div className="grid grid-cols-3 gap-1">{groups[0].map((berth) => <Seat key={berth} seat={row[berth]} onSelect={onSelect} />)}</div>
    <div className="h-full rounded bg-slate-100" aria-label="Aisle" />
    <div className="grid grid-cols-5 gap-1">{groups[1].map((berth) => <Seat key={berth} seat={row[berth]} onSelect={onSelect} />)}</div>
    <div className="h-full rounded bg-slate-100" aria-label="Aisle" />
    <div className="grid grid-cols-2 gap-1">{groups[2].map((berth) => <Seat key={berth} seat={row[berth]} onSelect={onSelect} />)}</div>
  </div>;
}
