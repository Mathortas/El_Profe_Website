import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/* ---------- Medidor ---------- */
export function Meter({ label, value, delta, icon }: { label: string; value: number; delta?: number; icon?: ReactNode }) {
  const band = value < 35 ? 'low' : value < 60 ? 'mid' : 'high';
  return (
    <div className={`ep-meter ep-meter--${band}`}>
      <div className="ep-meter__top">
        <span className="ep-meter__label">{icon}{label}</span>
        {delta !== undefined && delta !== 0 && (
          <span className="ep-meter__delta" style={{ color: delta > 0 ? 'var(--good)' : 'var(--bad)' }}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <div className="ep-meter__value num">{value}</div>
      <div className="ep-meter__bar"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

/* ---------- Duelo de estadística ---------- */
export function StatDuel({ label, home, away, suffix = '' }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away || 1;
  return (
    <div className="ep-duel">
      <div className="ep-duel__row"><b className="num">{home}{suffix}</b><span>{label}</span><b className="num">{away}{suffix}</b></div>
      <div className="ep-duel__bar"><i style={{ flex: home / total }} /><i style={{ flex: away / total }} /></div>
    </div>
  );
}

/* ---------- Tabla ordenable ---------- */
export interface Column<T> {
  key: string;
  label: string;
  num?: boolean;
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
}

export function SortableTable<T extends { id: number | string }>({
  columns, rows, initialSort, selected, onRowClick, onRowDoubleClick, caption,
}: {
  columns: Column<T>[]; rows: T[]; initialSort?: { key: string; dir: 'asc' | 'desc' };
  selected?: (number | string)[]; onRowClick?: (row: T) => void; onRowDoubleClick?: (row: T) => void; caption?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);

  const toggle = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort(s => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.num ? 'desc' : 'asc' }));
  };

  return (
    <div className="ep-table-wrap">
      <table className="ep-table">
        {caption && <caption className="t3" style={{ textAlign: 'left', padding: '0 10px 6px', fontSize: 12 }}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map(c => {
              const active = sort?.key === c.key;
              const aria = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              const Icon = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={c.key} className={c.num ? 'is-num' : undefined} aria-sort={aria}>
                  {c.sortValue ? (
                    <button onClick={() => toggle(c)}>{c.label}<Icon className="ep-sort" aria-hidden /></button>
                  ) : <span style={{ display: 'inline-block', padding: '8px 10px' }}>{c.label}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} aria-selected={selected?.includes(r.id) || undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(r) : undefined}
              style={onRowClick || onRowDoubleClick ? { cursor: 'pointer' } : undefined}>
              {columns.map(c => <td key={c.key} className={c.num ? 'is-num' : undefined}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
