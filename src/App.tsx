import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Radio, Zap, Cpu, Keyboard as KeyboardIcon, Activity
} from 'lucide-react'
import './App.css'

// --- CONFIGURAZIONE STRUMENTI FISSI ---
const TRACKS = ['kick', 'snare', 'hihat', 'bass'] as const;
type TrackName = typeof TRACKS[number];

const STEPS = 16;

function App() {
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(124);
  
  // STATO DEL SEQUENCER
  const [grid, setGrid] = useState<Record<TrackName, boolean[]>>({
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hihat: Array(STEPS).fill(false),
    bass: Array(STEPS).fill(false),
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Riferimenti persistenti per Tone.js
  const instrumentsRef = useRef<Partial<Record<TrackName, any>>>({});
  const sequencerRef = useRef<Tone.Sequence | null>(null);

  // Inizializzazione Audio Engine
  const initEngine = async () => {
    await Tone.start();
    
    // Setup Strumenti
    const kick = new Tone.MembraneSynth().toDestination();
    const snare = new Tone.NoiseSynth({
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();
    const hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
    }).toDestination();
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 0.8 }
    }).toDestination();

    instrumentsRef.current = { kick, snare, hihat, bass };

    // Setup Sequencer
    sequencerRef.current = new Tone.Sequence((time, step) => {
      setCurrentStep(step);
      
      // Controlla la griglia e suona
      TRACKS.forEach(track => {
        if (gridRef.current[track][step]) {
          if (track === 'kick') instrumentsRef.current.kick?.triggerAttackRelease("C1", "8n", time);
          if (track === 'snare') instrumentsRef.current.snare?.triggerAttackRelease("16n", time);
          if (track === 'hihat') instrumentsRef.current.hihat?.triggerAttackRelease("32n", time);
          if (track === 'bass') instrumentsRef.current.bass?.triggerAttackRelease("C2", "8n", time);
        }
      });
    }, Array.from({length: STEPS}, (_, i) => i), "16n");

    setIsAudioStarted(true);
  };

  // Sincronizzazione griglia per il sequencer (useRef per evitare closure obsolete)
  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  const toggleTransport = () => {
    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      Tone.getTransport().start();
      sequencerRef.current?.start(0);
      setIsPlaying(true);
    }
  };

  const toggleStep = (track: TrackName, stepIndex: number) => {
    setGrid(prev => ({
      ...prev,
      [track]: prev[track].map((val, i) => i === stepIndex ? !val : val)
    }));
  };

  const handleAiGenerate = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          currentGrid: grid,
          mode: 'daw' 
        }),
      });
      
      const data = await response.json();
      if (data.newGrid) {
        setGrid(data.newGrid);
        setPrompt("");
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("AI Sync Error");
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
              <h2>DINO.DAW 2026</h2>
              <p>Inizializza Ambiente di Produzione</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.DAW</div>
        <div className="transport-bar">
          <button className="btn-icon" onClick={toggleTransport}>
            {isPlaying ? <Square fill="var(--matrix-green)" /> : <Play fill="var(--matrix-green)" />}
          </button>
          <div style={{ fontSize: '0.8rem' }}>BPM: {bpm}</div>
        </div>
      </header>

      {/* SEQUENCER GRID */}
      <section className="sequencer-panel">
        <div className="rack-label" style={{marginBottom:'10px'}}>Step Sequencer</div>
        {TRACKS.map(track => (
          <div key={track} className="sequencer-row">
            <div className="track-label">{track}</div>
            <div className="steps-container">
              {grid[track].map((active, i) => (
                <div 
                  key={i} 
                  className={`step ${active ? 'active' : ''} ${currentStep === i ? 'current' : ''}`}
                  onClick={() => toggleStep(track, i)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* PIANO KEYBOARD */}
      <div className="rack-label" style={{margin:'10px 0 5px 1rem'}}>Virtual Synth Keys</div>
      <section className="keyboard-panel">
        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C2'].map((note, i) => (
          <div 
            key={i} 
            className={`key ${note.includes('#') ? 'black' : 'white'}`}
            onMouseDown={() => instrumentsRef.current.bass?.triggerAttack(note + "2")}
            onMouseUp={() => instrumentsRef.current.bass?.triggerRelease()}
          >
            {note}
          </div>
        ))}
      </section>

      {/* AI ASSISTANT */}
      <section className="ai-copilot">
        <textarea
          className="copilot-input"
          placeholder="Dì all'IA cosa generare (es. 'Fai un ritmo techno', 'Pulisci snare', 'Crea un pattern trap')..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button className="btn-generate" onClick={handleAiGenerate} disabled={isGenerating}>
          {isGenerating ? "ELABORAZIONE PATTERN..." : "✨ GENERA BEAT CON IA"}
        </button>
      </section>

      <div className="status-bar">
        <div>DAW_CORE_V1.0</div>
        <div>BUFFER: OK // SYNC: INTERNAL</div>
      </div>
    </div>
  )
}

export default App
