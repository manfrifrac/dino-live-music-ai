import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Zap, Sliders, Music, Radio, Activity, Cpu, Power
} from 'lucide-react'
import './App.css'

// --- CONSTANTS ---
const TRACKS = ['kick', 'snare', 'hihat', 'bass'] as const;
type TrackName = typeof TRACKS[number];
const STEPS = 16;
const PIANO_NOTES = [
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
  
  // FX STATE
  const [cutoff, setCutoff] = useState(20000);
  const [reverbWet, setReverbWet] = useState(0.15);

  const [grid, setGrid] = useState<Record<TrackName, boolean[]>>({
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hihat: Array(STEPS).fill(false),
    bass: Array(STEPS).fill(false),
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // REFERENCES
  const instruments = useRef<any>({});
  const sequencer = useRef<Tone.Sequence | null>(null);
  const filter = useRef<Tone.Filter | null>(null);
  const reverb = useRef<Tone.Reverb | null>(null);
  const gridRef = useRef(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  // LIVE FX UPDATES
  useEffect(() => { if (filter.current) filter.current.frequency.rampTo(cutoff, 0.1); }, [cutoff]);
  useEffect(() => { if (reverb.current) reverb.current.wet.rampTo(reverbWet, 0.1); }, [reverbWet]);

  const initEngine = async () => {
    await Tone.start();
    
    // Master Chain
    const masterFilter = new Tone.Filter(20000, "lowpass", -24).toDestination();
    const masterReverb = new Tone.Reverb(2.5).connect(masterFilter);
    masterReverb.wet.value = 0.15;
    
    filter.current = masterFilter;
    reverb.current = masterReverb;

    // Instruments
    instruments.current.kick = new Tone.MembraneSynth().connect(masterFilter);
    instruments.current.snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.2 } }).connect(masterReverb);
    instruments.current.hihat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1 } }).connect(masterReverb);
    instruments.current.bass = new Tone.MonoSynth({
      oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 }
    }).connect(masterReverb);

    // Ducking
    const ducking = new Tone.Gain(1).connect(masterReverb);
    instruments.current.bass.disconnect();
    instruments.current.bass.connect(ducking);

    sequencer.current = new Tone.Sequence((time, step) => {
      setCurrentStep(step);
      const g = gridRef.current;
      if (g.kick[step]) {
        instruments.current.kick.triggerAttackRelease("C1", "8n", time);
        ducking.gain.rampTo(0.2, 0.01, time);
        ducking.gain.rampTo(1, 0.15, time + 0.05);
      }
      if (g.snare[step]) instruments.current.snare.triggerAttackRelease("16n", time);
      if (g.hihat[step]) instruments.current.hihat.triggerAttackRelease("32n", time);
      if (g.bass[step]) instruments.current.bass.triggerAttackRelease("C2", "8n", time);
    }, Array.from({length: STEPS}, (_, i) => i), "16n");

    setIsAudioStarted(true);
  };

  const handlePlay = () => {
    if (isPlaying) {
      Tone.getTransport().stop();
      sequencer.current?.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      Tone.getTransport().start();
      sequencer.current?.start(0);
      setIsPlaying(true);
    }
  };

  const playNote = (note: string) => {
    const n = note === 'C2' ? 'C3' : note + '2';
    instruments.current.bass?.triggerAttack(n);
    setPressedKey(note);
  };

  const stopNote = () => {
    instruments.current.bass?.triggerRelease();
    setPressedKey(null);
  };

  const handleAI = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentGrid: grid, mode: 'daw' }),
      });
      const data = await res.json();
      if (data.newGrid) setGrid(data.newGrid);
    } finally {
      setIsGenerating(false);
      setPrompt("");
    }
  };

  return (
    <div className="daw-shell">
      <AnimatePresence>
        {!isAudioStarted && (
          <motion.div className="overlay" exit={{ opacity: 0 }} onClick={initEngine}>
            <div className="start-card">
              <Power size={48} color="var(--ableton-accent)" />
              <h1 style={{color:'white'}}>DINO LIVE PRO</h1>
              <p>Inizializza Engine Ableton Style</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <button className={`transport-btn ${isPlaying ? 'active' : ''}`} onClick={handlePlay}>
          {isPlaying ? <Square size={14} fill="black" /> : <Play size={14} fill="white" />}
        </button>
        <div className="bpm-display">124.00</div>
        <div style={{flex:1}} />
        <Activity size={16} color="var(--ableton-accent)" />
      </header>

      {/* TRACK LANES */}
      <main className="main-view">
        {TRACKS.map(t => (
          <div key={t} className={`track-lane ${t}`}>
            <div className="track-header">
              <span className="track-name">{t}</span>
              <div style={{height: '4px', width: '100%', background: '#000'}} />
            </div>
            <div className="step-grid">
              {grid[t].map((active, i) => (
                <div 
                  key={i} 
                  className={`step ${active ? 'active' : ''} ${currentStep === i ? 'current' : ''}`}
                  onClick={() => {
                    const newGrid = {...grid};
                    newGrid[t][i] = !newGrid[t][i];
                    setGrid(newGrid);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* DEVICE RACK & PIANO ROLL */}
      <section className="detail-view">
        <div className="device-rack">
          <div className="track-name" style={{fontSize:'9px'}}>Master Effects</div>
          <div className="knob-container">
            <label>Filter Cutoff</label>
            <input type="range" min="100" max="20000" value={cutoff} onChange={e => setCutoff(Number(e.target.value))} />
          </div>
          <div className="knob-container">
            <label>Reverb Dry/Wet</label>
            <input type="range" min="0" max="1" step="0.01" value={reverbWet} onChange={e => setReverbWet(Number(e.target.value))} />
          </div>
        </div>

        <div className="piano-roll">
          {PIANO_NOTES.map((note, i) => (
            <div 
              key={i} 
              className={`key ${note.t} ${pressedKey === note.n ? 'active' : ''}`}
              onMouseDown={() => playNote(note.n)}
              onMouseUp={stopNote}
              onMouseLeave={stopNote}
              onTouchStart={(e) => { e.preventDefault(); playNote(note.n); }}
              onTouchEnd={(e) => { e.preventDefault(); stopNote(); }}
            >
              <span style={{fontSize:'8px', opacity:0.5}}>{note.n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AI COPILOT FOOTER */}
      <footer className="ai-footer">
        <Cpu size={16} />
        <input 
          placeholder="Command AI Assistant (e.g. 'Add deep sub bass loop')..." 
          value={prompt} 
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAI()}
        />
        <button className="transport-btn" onClick={handleAI} disabled={isGenerating}>
          {isGenerating ? <Zap size={14} className="spin" /> : <Zap size={14} />}
        </button>
      </footer>
    </div>
  )
}

export default App
