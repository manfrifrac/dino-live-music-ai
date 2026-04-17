import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, Play, Square, ChevronDown, ChevronUp, 
  Code2, Cpu, History, Volume2, VolumeX 
} from 'lucide-react'
import './App.css'

// Estendiamo il tipo Tone per includere il nostro registro canali
declare module 'tone' {
  interface ToneStatic {
    channels: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live OS - Mixer Edition
Tone.channels = {}; // Reset mixer

const masterReverb = new Tone.Reverb(2).toDestination();

const kick = new Tone.MembraneSynth().toDestination();
Tone.channels.kick = kick;

const lead = new Tone.PolySynth(Tone.MonoSynth, {
  oscillator: { type: "fatsawtooth" }
}).connect(masterReverb);
Tone.channels.lead = lead;

const loop = new Tone.Loop(t => {
  lead.triggerAttackRelease(["C3", "Eb3", "G3"], "4n", t);
}, "2n").start(0);

const kLoop = new Tone.Loop(t => {
  kick.triggerAttackRelease("C1", "8n", t);
}, "4n").start(0);

Tone.getTransport().bpm.value = 120;
Tone.getTransport().start();
`;

interface Message { role: 'user' | 'assistant'; content: string; }

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tracks, setTracks] = useState<string[]>([]);
  const [mutedTracks, setMutedTracks] = useState<{ [key: string]: boolean }>({});
  
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const codeRef = useRef<string>(DEFAULT_CODE);
  const historyRef = useRef<Message[]>([]);

  useEffect(() => {
    codeRef.current = code;
    historyRef.current = history;
  }, [code, history]);

  const updateMixerUI = () => {
    if (Tone.channels) {
      setTracks(Object.keys(Tone.channels));
    }
  };

  const executeCode = async (codeToRun: string) => {
    await Tone.start();
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      
      // Pulizia canali precedenti
      Tone.channels = {};
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      updateMixerUI();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMute = (trackName: string) => {
    if (Tone.channels[trackName]) {
      const isMuted = !mutedTracks[trackName];
      Tone.channels[trackName].mute = isMuted;
      setMutedTracks(prev => ({ ...prev, [trackName]: isMuted }));
    }
  };

  const handleAiGenerate = async () => {
    if (!prompt || isGenerating) return;
    const currentPrompt = prompt;
    setPrompt("");
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: currentPrompt, 
          currentCode: codeRef.current,
          history: historyRef.current 
        }),
      });
      
      const data = await response.json();
      if (data.code) {
        setHistory(prev => [...prev, { role: 'user', content: currentPrompt }, { role: 'assistant', content: "Mixer aggiornato." }].slice(-10));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      alert("Errore AI");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div className="brand">DINO.MIXER</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className={`dot ${isPlaying ? 'pulse' : ''}`} />
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>DAW_MODE_ON</span>
        </div>
      </header>

      {/* Dynamic Mixer */}
      <div className="mixer-container">
        {tracks.length === 0 ? (
          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>Nessuna traccia rilevata...</div>
        ) : (
          tracks.map(track => (
            <motion.div 
              key={track}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`track-btn ${mutedTracks[track] ? 'muted' : 'active'}`}
              onClick={() => toggleMute(track)}
            >
              {mutedTracks[track] ? <VolumeX size={18} /> : <Volume2 size={18} />}
              <div className="track-name">{track}</div>
            </motion.div>
          ))
        )}
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Cosa vuoi aggiungere al mix? (es. 'Aggiungi un hi-hat in levare', 'Togli il basso')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "PRODUCENDO..." : "AGGIORNA MIX"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={20} /></button>
            <button className="btn-icon btn-stop" onClick={() => { Tone.getTransport().stop(); setIsPlaying(false); }}><Square size={20} /></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={16} /> Console Sorgente</div>
          {isCodeOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        <AnimatePresence>
          {isCodeOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
              <textarea className="code-area" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="panel">
        <div className="panel-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          <div className="panel-title"><History size={16} /> Timeline Log</div>
          {isHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="panel-content">
              {history.length === 0 ? "Pronto." : history.filter(h => h.role === 'user').map((h, i) => (
                <div key={i} style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--matrix-green)' }}>&gt;</span> {h.content}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="status-bar">
        <div>TRACKS: {tracks.length}</div>
        <div>SISTEMA: OTTIMIZZATO</div>
      </div>
    </div>
  )
}

export default App
