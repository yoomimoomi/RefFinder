import { useState, useEffect } from 'react'
import { Search, RotateCcw, SlidersHorizontal, Sparkles, Move3d } from 'lucide-react'
import Viewport, { JointControls, presetRotations } from '@/components/viewport'
import { exportPose } from '@/components/pose-export'

// const resultImages = [
//   { src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80', label: 'Editorial stance', score: '98%' },
//   { src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80', label: 'Relaxed portrait', score: '94%' },
//   { src: 'https://images.unsplash.com/photo-1539579514369-3d7d1ebd3cbb?auto=format&fit=crop&w=700&q=80', label: 'Street pose', score: '91%' },
//   { src: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80', label: 'Studio reference', score: '88%' },
//   { src: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80', label: 'Fashion motion', score: '84%' },
//   { src: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80', label: 'Seated balance', score: '81%' },
// ]

export default function PoseFinder() {
  const [searched, setSearched] = useState(false)
  const [pose, setPose] = useState(0)
  const [rotations, setRotations] = useState(() => presetRotations(0))
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const applyPreset = (index) => { setPose(index); setRotations(presetRotations(index)) }
  const editRotations = (update) => { setPose(null); setRotations(update) }
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [results, setResults] = useState([]) //NEW! Holds search matches
  const findSimilar = async () => {
    setExporting(true)
    setExportError(null)
    try {
      // await exportPose(rotations)
      const data = await exportPose(rotations) //New
      setResults(data.matches) //New 
      // Together, they send the current 3D/2D pose data to backend & store the returned matching images in React state so UI can render them.
      setSearched(true)
    } catch {
      setExportError("Couldn't reach the server")
    } finally {
      setExporting(false)
    }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Move3d size={18} /></div><span>POSEFINDER</span></div><nav><a className="active">Workspace</a><a>Library</a><a>About</a></nav><button className="icon-button" aria-label="Adjust settings"><SlidersHorizontal size={18} /></button></header>
    <section className="workspace-grid">
      <div className="model-panel"><div className="panel-head"><div><span className="label">POSE EDITOR</span><h2>Mannequin</h2></div><button className="reset" onClick={() => applyPreset(0)}><RotateCcw size={14} /> Reset</button></div><Viewport rotations={rotations} onRotationsChange={editRotations} selected={selected} onSelect={setSelected} /><JointControls joint={selected} rotations={rotations} onRotationsChange={editRotations} /><div className="pose-controls"><span>PRESETS</span><button className={pose === 0 ? 'selected' : ''} onClick={() => applyPreset(0)}>Neutral</button><button className={pose === 1 ? 'selected' : ''} onClick={() => applyPreset(1)}>Raised</button><button className={pose === 2 ? 'selected' : ''} onClick={() => applyPreset(2)}>Open</button></div></div>
      {/* <div className="results-panel"><div className="results-head"><div><span className="label">MATCHING REFERENCES</span><h2>{searched ? 'Your results' : 'Ready when you are'}</h2></div>{searched && <span className="result-count">06 MATCHES</span>}</div>{!searched ? <div className="empty-state"><div className="empty-lines"><i /><i /><i /><i /></div><p>Move the limbs into a pose<br />and search for similar images.</p><button className="search-button" onClick={findSimilar} disabled={exporting}><Search size={17} /> {exporting ? 'Exporting...' : 'Find similar poses'}</button>{exportError && <p className="export-error">{exportError}</p>}</div> : <div className="results-grid">{resultImages.map((image) => <article className="result-card" key={image.src}><div className="result-image"><img src={image.src} alt={image.label} /><span>{image.score}</span></div><p>{image.label}</p></article>)}</div>}</div> */}
      {
        <div className="results-panel"><div className="results-head"><div><span className="label">MATCHING REFERENCES</span><h2>{searched ? 'Your results' : 'Ready when you are'}</h2></div>{searched && <span className="result-count">{String(results.length).padStart(2, '0')} MATCHES</span>}<button className="search-button" onClick={findSimilar} disabled={exporting}><Search size={17} /> {exporting ? 'Exporting...' : 'Find similar poses'}</button></div>{exportError && <p className="export-error">{exportError}</p>}{!searched ? <div className="empty-state"><div className="empty-lines"><i /><i /><i /><i /></div><p>Move the limbs into a pose<br />and search for similar images.</p></div> : <div className="results-grid">{results.map((m) => <article className="result-card" key={m.image}>
          <div className="result-image"><img src={m.url} alt={m.image} /><span>{m.score}%</span></div>
          <p>{m.image}</p> {/* (This line and the 2 above) 3 new lines here. Now gets and displays all the images we have stored */}
        </article>)}</div>}</div>}
    </section>
  </main>
}
