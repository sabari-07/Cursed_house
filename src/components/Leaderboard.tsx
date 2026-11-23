import { useEffect, useState } from 'react'
import { ONLINE, exportSeed, loadSeed, mergePlayers, type PlayerRow } from '../game/accounts'
import { apiLeaderboard } from '../game/onlineAccounts'
import { formatTime, rank, type RankedRow } from '../game/leaderboard'

interface Props {
  /** The signed-in player's name, highlighted. */
  me: string | null
  onClose: () => void
}

/** The ranked table: online, every player's (from the house's API); otherwise the seed file plus this browser's accounts. */
export function Leaderboard({ me, onClose }: Props) {
  const [rows, setRows] = useState<RankedRow[] | null>(null)
  const [seed, setSeed] = useState<PlayerRow[]>([])
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let alive = true
    if (ONLINE) {
      void apiLeaderboard().then(players => {
        if (!alive) return
        setOffline(players === null)
        setRows(rank(players ?? []))
      })
      return () => { alive = false }
    }
    void loadSeed().then(s => {
      if (!alive) return
      setOffline(s === null)
      setSeed(s ?? [])
      setRows(rank(mergePlayers(s ?? [])))
    })
    return () => { alive = false }
  }, [])

  // development only: download this browser's players as the seed file (no passwords)
  const download = () => {
    const blob = new Blob([exportSeed(seed)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'users.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <section className="lb" onClick={e => e.stopPropagation()} aria-label="Leaderboard">
        <h2>LEADERBOARD</h2>
        {!rows ? <p className="lb-note">Reading the ledger…</p> : (
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Levels cleared</th><th>Now in</th><th>Best time</th><th>Deaths</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const done = r.progress.level === 4
                return (
                  <tr key={`${r.local ? 'l' : 's'}-${r.name}`} className={me && r.name.toLowerCase() === me.toLowerCase() ? 'is-me' : ''}>
                    <td>{r.rank}</td>
                    <td>{r.name}</td>
                    <td>{r.levels} of 3</td>
                    <td>{done ? 'All cleared' : `Level ${r.progress.level}`}</td>
                    <td>{r.time ? formatTime(r.time) : '—'}</td>
                    <td>{r.progress.deaths}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {offline && <p className="lb-note">{ONLINE ? 'The house could not be reached. Try again in a moment.' : "Online scores unavailable. Showing this browser's players."}</p>}
        <p className="lb-note">Ranked by levels cleared, then by the total of each level's best time (all five stages in one run). A death sends you back to the start of that level.</p>
        <p className="lb-note">{ONLINE ? 'Every player of the house: the best fifty.' : "Scores from this browser and the house's records."}</p>
        <div className="lb-actions">
          {import.meta.env.DEV && !ONLINE && <button type="button" onClick={download}>EXPORT USERS.JSON</button>}
          <button type="button" onClick={onClose}>CLOSE</button>
        </div>
      </section>
      <style>{`
        .lb-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(0, 0, 0, .6); }
        .lb { width: min(640px, 94vw); max-height: 84vh; overflow: auto; padding: 22px 24px 16px; color: #efe3cb; font-family: Georgia, 'Times New Roman', serif;
          background: linear-gradient(180deg, rgba(16, 12, 9, .97), rgba(8, 6, 5, .97)); border: 1px solid rgba(243, 218, 172, .4);
          box-shadow: 0 0 40px rgba(240, 142, 38, .14), 0 20px 60px rgba(0, 0, 0, .7); }
        .lb h2 { margin: 0 0 14px; text-align: center; font: normal clamp(26px, 3vw, 36px) 'Creepster', Georgia, serif; letter-spacing: .08em; color: #c8141b;
          text-shadow: 2px 2px 0 #1a0000, 0 0 14px rgba(160, 0, 0, .6); }
        .lb table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .lb th { font: 10px Georgia, serif; letter-spacing: .18em; text-transform: uppercase; color: #c9a45e; text-align: left; padding: 6px 8px; border-bottom: 1px solid rgba(201, 164, 94, .35); }
        .lb td { padding: 7px 8px; border-bottom: 1px solid rgba(243, 218, 172, .08); font-variant-numeric: tabular-nums; }
        .lb tr.is-me td { color: #f0b356; background: rgba(240, 179, 86, .08); }
        .lb-note { margin: 10px 0 0; font-size: 11px; font-style: italic; color: rgba(239, 227, 203, .5); text-align: center; }
        .lb-actions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
        .lb-actions button { font: 11px Georgia, serif; letter-spacing: .2em; color: rgba(239, 227, 203, .8); background: transparent;
          border: 1px solid rgba(243, 218, 172, .35); padding: 7px 12px; cursor: pointer; }
        .lb-actions button:hover { color: #fff3dd; border-color: rgba(243, 218, 172, .75); }
      `}</style>
    </div>
  )
}
