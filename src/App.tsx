import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Radio, Zap, Cpu, Activity, Sliders, Music
} from 'lucide-react'
import './App.css'

const TRACKS = ['kick', 'snare', 'hihat', 'bass'] as const;
type TrackName = typeof TRACKS[number];
const STEPS = 16;

function App() {
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activePad, setActivePad] = useState<string | null>(null);
  
  // FX STATE
  const [cutoff, setCutoff] = useState(20000);
  const [reverbWet, setReverbWet] = useState(0.2);

  const [grid, setGrid] = useState<Record<TrackName, boolean[]>>({
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hihat: Array(STEPS).fill(false),
    bass: Array(STEPS).fill(false),
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // REFERENCES
  const instrumentsRef = useRef<any>({});
  const sequencerRef = useRef<Tone.Sequence | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const gridRef = useRef(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  // LIVE FX UPDATE
  useEffect(() => {
    if (filterRef.current) filterRef.current.frequency.value = cutoff;
  }, [cutoff]);

  useEffect(() => {
    if (reverbRef.current) reverbRef.current.wet.value = reverbWet;
  }, [reverbWet]);

  const initEngine = async () => {
    await Tone.start();
    
    // Master Chain (The "Fred Again" setup)
    const masterFilter = new Tone.Filter(20000, "lowpass", -24).toDestination();
    const masterReverb = new Tone.Reverb(3).connect(masterFilter);
    masterReverb.wet.value = 0.2;
    
    filterRef.current = masterFilter;
    reverbRef.current = masterReverb;

    // Instruments
    instrumentsRef.current.kick = new Tone.MembraneSynth().connect(masterFilter);
    instrumentsRef.current.snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).connect(masterReverb);
    instrumentsRef.current.hihat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(masterReverb);
    instrumentsRef.current.bass = new Tone.MonoSynth({
      oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1 }
    }).connect(masterReverb);

    // SIDECHAIN SIMULATION: Duck bass when kick plays
    const ducking = new Tone.Gain(1).connect(masterReverb);
    instrumentsRef.current.bass.disconnect();
    instrumentsRef.current.bass.connect(ducking);

    sequencerRef.current = new Tone.Sequence((time, step) => {
      setCurrentStep(step);
      if (gridRef.current.kick[step]) {
        instrumentsRef.current.kick.triggerAttackRelease("C1", "8n", time);
        // Trigger Sidechain duck
        ducking.gain.rampTo(0.2, 0.02, time);
        ducking.gain.rampTo(1, 0.2, time + 0.1);
      }
      if (gridRef.current.snare[step]) instrumentsRef.current.snare.triggerAttackRelease("16n", time);
      if (gridRef.current.hihat[step]) instrumentsRef.current.hihat.triggerAttackRelease("32n", time);
      if (gridRef.current.bass[step]) instrumentsRef.current.bass.triggerAttackRelease("C2", "8n", time);
    }, Array.from({length: STEPS}, (_, i) => i), "16n");

    setIsAudioStarted(true);
  };

  const triggerPad = (type: string, note?: string) => {
    setActivePad(type + (note || ""));
    if (type === 'kick') instrumentsRef.current.kick.triggerAttackRelease("C1", "8n");
    if (type === 'snare') instrumentsRef.current.snare.triggerAttackRelease("16n");
    if (type === 'hihat') instrumentsRef.current.hihat.triggerAttackRelease("32n");
    if (type === 'bass') instrumentsRef.current.bass.triggerAttackRelease(note || "C2", "4n");
    setTimeout(() => setActivePad(null), 100);
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
              <Sliders size={60} color="var(--matrix-green)" />
              <h2>DINO.LIVE PRO</h2>
              <p>Fred Again Performance Mode</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.LIVE</div>
        <button className="btn-icon" onClick={() => {
          if (isPlaying) { Tone.getTransport().stop(); sequencerRef.current?.stop(); setIsPlaying(false); setCurrentStep(-1); }
          else { Tone.getTransport().start(); sequencerRef.current?.start(0); setIsPlaying(true); }
        }}>
          {isPlaying ? <Square fill="#ff3131" /> : <Play fill="#00ff41" />}
        </button>
      </header>

      {/* PERFORMANCE FX UNIT */}
      <section className="performance-fx">
        <div className="fx-control">
          <div className="fx-label">Lowpass Cutoff</div>
          <input type="range" min="100" max="20000" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} />
        </div>
        <div className="fx-control">
          <div className="fx-label">Reverb Wash</div>
          <input type="range" min="0" max="1" step="0.01" value={reverbWet} onChange={(e) => setReverbWet(Number(e.target.value))} />
        </div>
      </section>

      {/* MINI VISUAL SEQUENCER */}
      <div className="mini-sequencer">
        {TRACKS.map(track => (
          <div key={track} className="mini-row">
            {grid[track].map((active, i) => (
              <div key={i} className={`mini-step ${active ? 'active' : ''} ${currentStep === i ? 'current' : ''}`} />
            ))}
          </div>
        ))}
      </div>

      {/* DRUM PAD RACK 4x4 */}
      <section className="pad-grid">
        <div className={`drum-pad kick-pad ${activePad === 'kick' ? 'active' : ''}`} onPointerDown={() => triggerPad('kick')}>
          <div className="pad-label">Kick</div>
          <Zap size={20} />
        </div>
        <div className={`drum-pad snare-pad ${activePad === 'snare' ? 'active' : ''}`} onPointerDown={() => triggerPad('snare')}>
          <div className="pad-label">Snare</div>
          <Activity size={20} />
        </div>
        <div className={`drum-pad ${activePad === 'hihat' ? 'active' : ''}`} onPointerDown={() => triggerPad('hihat')}>
          <div className="pad-label">H-Hat</div>
          <Radio size={20} />
        </div>
        <div className={`drum-pad synth-pad ${activePad === 'bassC2' ? 'active' : ''}`} onPointerDown={() => triggerPad('bass', 'C2')}>
          <div className="pad-label">Bass C</div>
          <Music size={20} />
        </div>

        <div className={`drum-pad synth-pad ${activePad === 'bassEb2' ? 'active' : ''}`} onPointerDown={() => triggerPad('bass', 'Eb2')}>
          <div className="pad-label">Bass Eb</div>
        </div>
        <div className={`drum-pad synth-pad ${activePad === 'bassF2' ? 'active' : ''}`} onPointerDown={() => triggerPad('bass', 'F2')}>
          <div className="pad-label">Bass F</div>
        </div>
        <div className={`drum-pad synth-pad ${activePad === 'bassG2' ? 'active' : ''}`} onPointerDown={() => triggerPad('bass', 'G2')}>
          <div className="pad-label">Bass G</div>
        </div>
        <div className={`drum-pad synth-pad ${activePad === 'bassBb2' ? 'active' : ''}`} onPointerDown={() => triggerPad('bass', 'Bb2')}>
          <div className="pad-label">Bass Bb</div>
        </div>

        {/* ... More pads could be added here to fill 4x4 ... */}
      </section>

      <section className="ai-copilot">
        <textarea className="copilot-input" placeholder="Prompt (es. 'Fai un beat UK Garage', 'Aggiungi atmosfera')..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="btn-generate" onClick={handleAiGenerate} disabled={isGenerating}>
          {isGenerating ? "ANALISI VIBE..." : "✨ EVOLVI SET"}
        </button>
      </section>
    </div>
  )
}

export default App
