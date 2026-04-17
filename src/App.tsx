import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Zap, Activity, Power, List, Sliders, Music, Circle
} from 'lucide-react'
import './App.css'

const TRACKS = ['kick', 'snare', 'hihat', 'bass', 'lead'] as const;
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
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeTab, setActiveTab] = useState<'grid' | 'device' | 'keys'>('grid');
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  
  const [cutoff, setCutoff] = useState(20000);
  const [reverbWet, setReverbWet] = useState(0.15);

  const [grid, setGrid] = useState<Record<TrackName, boolean[]>>({
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hihat: Array(STEPS).fill(false),
    bass: Array(STEPS).fill(false),
    lead: Array(STEPS).fill(false),
  });

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const instruments = useRef<any>({});
  const sequencer = useRef<Tone.Sequence | null>(null);
  const filter = useRef<Tone.Filter | null>(null);
  const reverb = useRef<Tone.Reverb | null>(null);
  const gridRef = useRef(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { if (filter.current) filter.current.frequency.rampTo(cutoff, 0.1); }, [cutoff]);
  useEffect(() => { if (reverb.current) reverb.current.wet.rampTo(reverbWet, 0.1); }, [reverbWet]);

  const initEngine = async () => {
    await Tone.start();
    const masterFilter = new Tone.Filter(20000, "lowpass", -24).toDestination();
    const masterReverb = new Tone.Reverb(2.5).connect(masterFilter);
    masterReverb.wet.value = 0.15;
    
    filter.current = masterFilter;
    reverb.current = masterReverb;

    instruments.current.kick = new Tone.MembraneSynth().connect(masterFilter);
    instruments.current.snare = new Tone.NoiseSynth({ volume: -6 }).connect(masterReverb);
    instruments.current.hihat = new Tone.MetalSynth({ volume: -12 }).connect(masterReverb);
    
    // POLYPHONIC BASS & LEAD
    instruments.current.bass = new Tone.PolySynth(Tone.MonoSynth).connect(masterReverb);
    instruments.current.lead = new Tone.PolySynth(Tone.Synth).connect(masterReverb);

    sequencer.current = new Tone.Sequence((time, step) => {
      setCurrentStep(step);
      const g = gridRef.current;
      if (g.kick[step]) instruments.current.kick.triggerAttackRelease("C1", "8n", time);
      if (g.snare[step]) instruments.current.snare.triggerAttackRelease("16n", time);
      if (g.hihat[step]) instruments.current.hihat.triggerAttackRelease("32n", time);
      if (g.bass[step]) instruments.current.bass.triggerAttackRelease("C2", "8n", time);
      if (g.lead[step]) instruments.current.lead.triggerAttackRelease("G3", "8n", time);
    }, Array.from({length: STEPS}, (_, i) => i), "16n");

    setIsAudioStarted(true);
  };

  const playNote = (note: string) => {
    const n = note === 'C2' ? 'C4' : note + '3';
    instruments.current.lead?.triggerAttack(n);
    setPressedKeys(prev => new Set(prev).add(note));

    // LIVE RECORD LOGIC
    if (isRecording && currentStep >= 0) {
      setGrid(prev => {
        const newGrid = { ...prev };
        newGrid.lead = [...prev.lead];
        newGrid.lead[currentStep] = true;
        return newGrid;
      });
    }
  };

  const stopNote = (note: string) => {
    const n = note === 'C2' ? 'C4' : note + '3';
    instruments.current.lead?.triggerRelease(n);
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  };

  const handlePlay = () => {
    if (isPlaying) {
      Tone.getTransport().stop();
      sequencer.current?.stop();
      setIsPlaying(false);
      setIsRecording(false);
      setCurrentStep(-1);
    } else {
      Tone.getTransport().start();
      sequencer.current?.start(0);
      setIsPlaying(true);
    }
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
      const data = await response.json();
      if (data.newGrid) setGrid(data.newGrid);
    } catch(e) {} finally {
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
              <h1 style={{color:'white'}}>DINO STUDIO</h1>
              <p>Touch to start session</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <button className={`transport-btn ${isPlaying ? 'active' : ''}`} onClick={handlePlay}>
          {isPlaying ? <Square size={14} fill="black" /> : <Play size={14} fill="white" />}
        </button>
        <button 
          className={`transport-btn ${isRecording ? 'active' : ''}`} 
          style={isRecording ? {backgroundColor:'#ff3131'} : {}}
          onClick={() => { if(!isPlaying) handlePlay(); setIsRecording(!isRecording); }}
        >
          <Circle size={14} fill={isRecording ? "black" : "#ff3131"} />
        </button>
        <div style={{flex:1}} />
        <div className="bpm-display">124</div>
      </header>

      <nav className="view-tabs">
        <div className={`tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
          <List size={14} /> <span>Grid</span>
        </div>
        <div className={`tab ${activeTab === 'device' ? 'active' : ''}`} onClick={() => setActiveTab('device')}>
          <Sliders size={14} /> <span>FX</span>
        </div>
        <div className={`tab ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
          <Music size={14} /> <span>Rec Keys</span>
        </div>
      </nav>

      <main className="content-area">
        {activeTab === 'grid' && (
          <div>
            {TRACKS.map(t => (
              <div key={t} className={`track-lane ${t}`}>
                <div className="track-info"><span>{t}</span></div>
                <div className="step-grid">
                  {grid[t].map((active, i) => (
                    <div key={i} className={`step ${active ? 'active' : ''} ${currentStep === i ? 'current' : ''}`}
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
          </div>
        )}

        {activeTab === 'device' && (
          <div className="mobile-detail">
            <div className="knob-unit">
              <label>Lowpass Filter</label>
              <input type="range" min="100" max="20000" value={cutoff} onChange={e => setCutoff(Number(e.target.value))} />
            </div>
            <div className="knob-unit">
              <label>Reverb Wash</label>
              <input type="range" min="0" max="1" step="0.01" value={reverbWet} onChange={e => setReverbWet(Number(e.target.value))} />
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="piano-container">
            {PIANO_NOTES.map((note, i) => (
              <div 
                key={i} 
                className={`mobile-key ${note.t} ${pressedKeys.has(note.n) ? 'active' : ''}`}
                onMouseDown={() => playNote(note.n)}
                onMouseUp={() => stopNote(note.n)}
                onTouchStart={(e) => { e.preventDefault(); playNote(note.n); }}
                onTouchEnd={(e) => { e.preventDefault(); stopNote(note.n); }}
              >
                <span>{note.n}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mobile-ai-bar">
        <input placeholder="Ask AI to polish your loop..." value={prompt} onChange={e => setPrompt(e.target.value)} />
        <button className="transport-btn" onClick={handleAI} disabled={isGenerating}><Zap size={18} /></button>
      </footer>
    </div>
  )
}

export default App
