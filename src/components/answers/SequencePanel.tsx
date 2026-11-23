import type { Option } from '../../riddles/types'
import { SymbolIcon } from './SymbolIcon'

/**
 * Put signs in order: each pick fills the next empty slot; clicking a filled
 * slot empties it. `value` is the picked ids joined with '-'.
 */
export function SequencePanel({ options, slots, value, onChange }: { options: Option[]; slots: number; value: string; onChange: (v: string) => void }) {
  const picked = value ? value.split('-') : []
  const byId = new Map(options.map(o => [o.id, o]))
  const add = (id: string) => { if (picked.length < slots && !picked.includes(id)) onChange([...picked, id].join('-')) }
  const remove = (i: number) => onChange(picked.filter((_, k) => k !== i).join('-'))
  return (
    <div className="sequence">
      <div className="seq-slots" aria-label="Your order">
        {Array.from({ length: slots }, (_, i) => {
          const o = picked[i] ? byId.get(picked[i]) : undefined
          return (
            <button key={i} type="button" className={`seq-slot ${o ? 'is-full' : ''}`} onClick={() => o && remove(i)}
              aria-label={o ? `${i + 1}: ${o.label} (click to take it out)` : `${i + 1}: empty`}>
              <span className="seq-n">{i + 1}</span>
              {o?.symbol && <SymbolIcon symbol={o.symbol} size={34} />}
              <span>{o ? o.label : '—'}</span>
            </button>
          )
        })}
      </div>
      <div className="seq-options">
        {options.map(o => (
          <button key={o.id} type="button" data-id={o.id} className="seq-option" disabled={picked.includes(o.id) || picked.length >= slots} onClick={() => add(o.id)}>
            {o.symbol && <SymbolIcon symbol={o.symbol} size={30} />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="key-btn key-clear seq-clear" onClick={() => onChange('')}>CLEAR</button>
    </div>
  )
}
