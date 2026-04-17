import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Activity
} from 'lucide-react'
import './App.css'

const TRACKS = ['kick', 'snare', 'hihat', 'bass'] as const;
type TrackName = typeof TRACKS[number];
const STEPS = 16;

// Definizione note per la tastiera
const NOTES = [
  { n: 'C', t: 'white' }, { n: 'C#', t: 'black' },
  { n: 'D', t: 'white' }, { n: 'D#', t: 'black' },
  { n: 'E', t: 'white' }, { n: 'F', t: 'white' },
  { n: 'F#', t: 'black' }, { n: 'G', t: 'white' },
  { n: 'G#', t: 'black' }, { n: 'A', t: 'white' },
  { n: 'A#', t: 'black' }, { n: 'B', t: 'white' },
  { n: 'C2', t: 'white' }
];

function App() {
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  
  const [grid, setGrid] = useState<Record<TrackName, boolean[]>>({
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hihat: Array(STEPS).fill(false),
    bass: Array(STEPS).fill(false),
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const instrumentsRef = useRef<any>({});
  const sequencerRef = useRef<Tone.Sequence | null>(null);
  const gridRef = useRef(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  const initEngine = async () => {
    await Tone.start();
    
    instrumentsRef.current.kick = new Tone.MembraneSynth().toDestination();
    instrumentsRef.current.snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination();
    instrumentsRef.current.hihat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).toDestination();
    instrumentsRef.current.bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
    }).toDestination();

    sequencerRef.current = new Tone.Sequence((time, step) => {
      setCurrentStep(step);
      if (gridRef.current.kick[step]) instrumentsRef.current.kick.triggerAttackRelease("C1", "8n", time);
      if (gridRef.current.snare[step]) instrumentsRef.current.snare.triggerAttackRelease("16n", time);
      if (gridRef.current.hihat[step]) instrumentsRef.current.hihat.triggerAttackRelease("32n", time);
      if (gridRef.current.bass[step]) instrumentsRef.current.bass.triggerAttackRelease("C2", "8n", time);
    }, Array.from({length: STEPS}, (_, i) => i), "16n");

    setIsAudioStarted(true);
  };

  const playNote = (note: string) => {
    const fullNote = note === 'C2' ? 'C3' : note + '2';
    instrumentsRef.current.bass?.triggerAttack(fullNote);
    setPressedKey(note);
  };

  const stopNote = () => {
    instrumentsRef.current.bass?.triggerRelease();
    setPressedKey(null);
  };

  const handleAiGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentGrid: grid, mode: 'daw' }),
      });
      const data = await response.json();
      if (data.newGrid) {
        setGrid(data.newGrid);
        setPrompt("");
      }
    } catch (err) {
      alert("AI Error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="daw-shell">
      <AnimatePresence>
        {!isAudioStarted && (
          <motion.div className="overlay" exit={{ opacity: 0 }} onClick={initEngine}>
            <div className="start-card">
              <Activity size={60} color="var(--matrix-green)" />
              <h2>DINO.DAW v1.1</h2>
              <p>Clicca per sbloccare l'interfaccia</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.DAW</div>
        <div className="transport-bar">
          <button className="btn-icon" onClick={() => {
            if (isPlaying) { Tone.getTransport().stop(); sequencerRef.current?.stop(); setIsPlaying(false); setCurrentStep(-1); }
            else { Tone.getTransport().start(); sequencerRef.current?.start(0); setIsPlaying(true); }
          }}>
            {isPlaying ? <Square fill="#00ff41" /> : <Play fill="#00ff41" />}
          </button>
        </div>
      </header>

      <section className="sequencer-panel">
        {TRACKS.map(track => (
          <div key={track} className="sequencer-row">
            <div className="track-label">{track}</div>
            <div className="steps-container">
              {grid[track].map((active, i) => (
                <div key={i} className={`step ${active ? 'active' : ''} ${currentStep === i ? 'current' : ''}`} onClick={() => {
                  const newGrid = {...grid};
                  newGrid[track][i] = !newGrid[track][i];
                  setGrid(newGrid);
                }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="rack-label">Synth Keyboard (Bass/Lead)</div>
      <section className="keyboard-panel">
        {NOTES.map((note, i) => (
          <div 
            key={i} 
            className={`key ${note.t} ${pressedKey === note.n ? 'active' : ''}`}
            onMouseDown={() => playNote(note.n)}
            onMouseUp={stopNote}
            onMouseLeave={stopNote}
            onTouchStart={(e) => { e.preventDefault(); playNote(note.n); }}
            onTouchEnd={(e) => { e.preventDefault(); stopNote(); }}
          >
            <span>{note.n}</span>
          </div>
        ))}
      </section>

      <section className="ai-copilot">
        <textarea className="copilot-input" placeholder="Prompt IA..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="btn-generate" onClick={handleAiGenerate} disabled={isGenerating}>
          {isGenerating ? "GENERANDO..." : "✨ GENERA PATTERN"}
        </button>
      </section>
    </div>
  )
}

export default App
