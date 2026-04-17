import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, ChevronDown, ChevronUp, 
  Code2, History, Volume2, VolumeX 
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live OS - Mixer Edition FIX
window.dinoChannels = {}; // Reset mixer

// Canali mixer dedicati
const kickChan = new Tone.Channel().toDestination();
const leadChan = new Tone.Channel().toDestination();

// Strumenti collegati ai canali
const kick = new Tone.MembraneSynth().connect(kickChan);
const lead = new Tone.PolySynth(Tone.MonoSynth, { oscillator: { type: "fatsawtooth" } }).connect(leadChan);

// Registrazione per interfaccia mixer
window.dinoChannels.kick = kickChan;
window.dinoChannels.lead = leadChan;

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
    if (window.dinoChannels) {
      setTracks(Object.keys(window.dinoChannels));
    }
  };

  const executeCode = async (codeToRun: string) => {
    await Tone.start();
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      window.dinoChannels = {};
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      updateMixerUI();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMute = (trackName: string) => {
    const channel = window.dinoChannels?.[trackName];
    if (channel) {
      const isMuted = !mutedTracks[trackName];
      // Tone.Channel ha la proprietà 'mute'
      channel.mute = isMuted;
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
        const assistantMsg: Message = { role: 'assistant', content: "Mixer aggiornato." };
        const userMsg: Message = { role: 'user', content: currentPrompt };
        setHistory(prev => [...prev, userMsg, assistantMsg].slice(-10));
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
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>FIX_MIX_ACTIVE</span>
        </div>
      </header>

      <div className="mixer-container">
        {tracks.length === 0 ? (
          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>Premi 'Esegui' per caricare il mixer...</div>
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
            placeholder="Chiedi: 'Cambia solo il lead', 'Rendi il kick più potente'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "PRODUCENDO..." : "EVOLVI MIX"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={20} /></button>
            <button className="btn-icon btn-stop" onClick={() => { Tone.getTransport().stop(); setIsPlaying(false); }}><Square size={20} /></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={16} /> Sorgente</div>
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
          <div className="panel-title"><History size={16} /> Sessione</div>
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
        <div>MIXER: CHANNEL_MODE</div>
      </div>
    </div>
  )
}

export default App
