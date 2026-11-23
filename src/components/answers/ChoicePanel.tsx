import type { Option } from '../../riddles/types'
import { SymbolIcon } from './SymbolIcon'

/** Pick one: a name, a book, a sign. The chosen option is `value` (its id). */
export function ChoicePanel({ options, value, onPick }: { options: Option[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="choices" role="radiogroup" aria-label="Choose one">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} data-id={o.id}
          className={`choice-option ${value === o.id ? 'is-chosen' : ''}`} onClick={() => onPick(o.id)}>
          {o.symbol && <SymbolIcon symbol={o.symbol} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
