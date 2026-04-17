import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Zap, RotateCcw, AlertCircle, Power
} from 'lucide-react'
import './App.css'

// --- COSTANTI DI SISTEMA ---
const TRACKS = ['kick', 'snare', 'hihat', 'bass'] as const;
type TrackName = typeof TRACKS[number];
const STEPS = 16;
const BASS_NOTES = ['C2', 'Eb2', 'F2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3'];

function App() {
  // --- STATO ---
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activePad, setActivePad] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  // --- RIFERIMENTI (AUDIO ENGINE) ---
  const nodes = useRef<any>({});
  const sequencer = useRef<Tone.Sequence | null>(null);
  const gridRef = useRef(grid);
  
  useEffect(() => { gridRef.current = grid; }, [grid]);

  // --- LIVE AUDIO UPDATES ---
  useEffect(() => { if(nodes.current.filter) nodes.current.filter.frequency.rampTo(cutoff, 0.05); }, [cutoff]);
  useEffect(() => { if(nodes.current.reverb) nodes.current.reverb.wet.rampTo(reverbWet, 0.1); }, [reverbWet]);

  // --- INITIALIZATION ---
  const initEngine = async () => {
    try {
      await Tone.start();
      const limiter = new Tone.Limiter(-1).toDestination();
      const filter = new Tone.Filter(20000, "lowpass", -24).connect(limiter);
      const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.15 }).connect(filter);
      const ducking = new Tone.Gain(1).connect(reverb);
      
      const kick = new Tone.MembraneSynth({ volume: 0 }).connect(filter);
      const snare = new Tone.NoiseSynth({ volume: -6, envelope: { attack: 0.001, decay: 0.2 } }).connect(reverb);
      const hihat = new Tone.MetalSynth({ volume: -12, envelope: { attack: 0.001, decay: 0.1 } }).connect(reverb);
      const bass = new Tone.MonoSynth({
        volume: -3,
        oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 }
      }).connect(ducking);

      nodes.current = { kick, snare, hihat, bass, filter, reverb, ducking };

      sequencer.current = new Tone.Sequence((time, step) => {
        setCurrentStep(step);
        const g = gridRef.current;
        if (g.kick[step]) {
          nodes.current.kick.triggerAttackRelease("C1", "8n", time);
          nodes.current.ducking.gain.rampTo(0.1, 0.01, time);
          nodes.current.ducking.gain.rampTo(1, 0.15, time + 0.05);
        }
        if (g.snare[step]) nodes.current.snare.triggerAttackRelease("16n", time);
        if (g.hihat[step]) nodes.current.hihat.triggerAttackRelease("32n", time);
        if (g.bass[step]) nodes.current.bass.triggerAttackRelease("C2", "8n", time);
      }, Array.from({length: STEPS}, (_, i) => i), "16n");

      setIsAudioStarted(true);
    } catch (e) {
      setError("Audio Init Fail");
    }
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

  const trigger = (inst: TrackName, note = "C1") => {
    if (!isAudioStarted) return;
    setActivePad(inst + note);
    if (inst === 'kick') nodes.current.kick.triggerAttackRelease("C1", "8n");
    if (inst === 'snare') nodes.current.snare.triggerAttackRelease("16n");
    if (inst === 'hihat') nodes.current.hihat.triggerAttackRelease("32n");
    if (inst === 'bass') nodes.current.bass.triggerAttackRelease(note, "4n");
    setTimeout(() => setActivePad(null), 100);
  };

  const handleAI = async () => {
    if (!prompt || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentGrid: grid, mode: 'daw' }),
      });
      const data = await res.json();
      if (data.newGrid) {
        setGrid(data.newGrid);
        setPrompt("");
      }
    } catch (e) {
      setError("AI connection lost");
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
              <Power size={50} />
              <h2>DINO CORE v5.5</h2>
              <p>Clicca per inizializzare</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.PRO</div>
        <button className={`btn-icon ${isPlaying ? 'stop' : 'play'}`} onClick={handlePlay}>
          {isPlaying ? <Square size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
      </header>

      <section className="glass-panel">
        <div className="flex-row">
          <div className="fx-unit">
            <label>Filter</label>
            <input type="range" min="100" max="20000" value={cutoff} onChange={e => setCutoff(Number(e.target.value))} />
          </div>
          <div className="fx-unit">
            <label>Wash</label>
            <input type="range" min="0" max="0.8" step="0.01" value={reverbWet} onChange={e => setReverbWet(Number(e.target.value))} />
          </div>
        </div>
      </section>

      <div className="mini-seq">
        {Array(STEPS).fill(0).map((_, i) => (
          <div key={i} className={`mini-dot ${currentStep === i ? 'active' : ''} ${TRACKS.some(t => grid[t][i]) ? 'has-sound' : ''}`} />
        ))}
      </div>

      <div className="pad-grid">
        <div className={`pad k ${activePad === 'kickC1' ? 'hit' : ''}`} onPointerDown={() => trigger('kick')}>KICK</div>
        <div className={`pad s ${activePad === 'snareC1' ? 'hit' : ''}`} onPointerDown={() => trigger('snare')}>SNARE</div>
        <div className={`pad h ${activePad === 'hihatC1' ? 'hit' : ''}`} onPointerDown={() => trigger('hihat')}>HIHAT</div>
        <div className="pad disabled">--</div>
        {BASS_NOTES.map(n => (
          <div key={n} className={`pad b ${activePad === 'bass'+n ? 'hit' : ''}`} onPointerDown={() => trigger('bass', n)}>
            {n.replace('2', '')}
          </div>
        ))}
      </div>

      <footer className="ai-section">
        {error && <div className="err-msg"><AlertCircle size={12} /> {error}</div>}
        <div className="input-group">
          <input placeholder="Prompt..." value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAI()} />
          <button onClick={handleAI} disabled={isGenerating}>
            {isGenerating ? <RotateCcw className="spin" size={16} /> : <Zap size={16} />}
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App
