import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Code2, Volume2, VolumeX, RefreshCcw, AlertTriangle, CheckCircle2
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live OS - Independent Channels FIX
window.dinoChannels = {}; 

// Canale Kick INDIPENDENTE
const kickChan = new Tone.Channel().toDestination();
const kick = new Tone.MembraneSynth().connect(kickChan);
window.dinoChannels.kick = kickChan;

// Canale Synth INDIPENDENTE
const synthChan = new Tone.Channel().toDestination();
const synth = new Tone.PolySynth().connect(synthChan);
window.dinoChannels.synth = synthChan;

// Pattern
Tone.getTransport().scheduleRepeat((t) => {
  kick.triggerAttackRelease("C1", "8n", t);
}, "4n");

Tone.getTransport().scheduleRepeat((t) => {
  synth.triggerAttackRelease(["E3", "G3"], "16n", t);
}, "2n");

Tone.getTransport().bpm.value = 120;
Tone.getTransport().start();
`;

interface Message { role: 'user' | 'assistant'; content: string; }

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tracks, setTracks] = useState<string[]>([]);
  const [mutedTracks, setMutedTracks] = useState<{ [key: string]: boolean }>({});
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [isCodeOpen, setIsCodeOpen] = useState(false);

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

  const startAudioEngine = async () => {
    await Tone.start();
    setIsAudioStarted(true);
    executeCode(codeRef.current);
  };

  const executeCode = async (codeToRun: string) => {
    setErrorLog(null);
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      window.dinoChannels = {};
      setTracks([]);
      setMutedTracks({}); // Reset stati mute al caricamento
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      setTimeout(() => updateMixerUI(), 150);
    } catch (err: any) {
      console.error(err);
      setErrorLog(err.message || "Errore nel codice");
    }
  };

  const toggleMute = (trackName: string) => {
    const channel = window.dinoChannels?.[trackName];
    if (channel) {
      const currentMute = !mutedTracks[trackName];
      channel.mute = currentMute;
      setMutedTracks(prev => ({ ...prev, [trackName]: currentMute }));
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
        const assistantMsg: Message = { role: 'assistant', content: "OK" };
        const userMsg: Message = { role: 'user', content: currentPrompt };
        setHistory(prev => [...prev, userMsg, assistantMsg].slice(-10));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      setErrorLog("Errore AI");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <AnimatePresence>
        {!isAudioStarted && (
          <motion.div className="overlay" exit={{ opacity: 0 }} onClick={startAudioEngine}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="start-card">
              <Play size={48} />
              <h2>AVVIA MIXER</h2>
              <p>Clicca per iniziare la sessione</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.OS</div>
        <div className="status-icons">
          {errorLog ? <AlertTriangle color="#ff3e3e" size={16} /> : <CheckCircle2 color="#00ff41" size={16} />}
        </div>
      </header>

      <div className="mixer-container">
        {tracks.map(track => (
          <motion.div 
            key={track}
            whileTap={{ scale: 0.95 }}
            className={`track-btn ${mutedTracks[track] ? 'muted' : 'active'}`}
            onClick={() => toggleMute(track)}
          >
            {mutedTracks[track] ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <div className="track-name">{track}</div>
          </motion.div>
        ))}
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          {errorLog && (
            <div className="error-box">
              <AlertTriangle size={14} /> {errorLog}
            </div>
          )}
          <textarea
            className="main-prompt"
            placeholder="Aggiungi strumenti indipendenti..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "SYCHING..." : "EVOLVI"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={20} /></button>
            <button className="btn-icon btn-stop" onClick={() => { Tone.getTransport().stop(); }}><Square size={20} /></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={16} /> Sorgente</div>
          <button onClick={(e) => { e.stopPropagation(); updateMixerUI(); }} className="btn-icon" style={{ width: '24px', height: '24px', border: 'none' }}>
            <RefreshCcw size={12} />
          </button>
        </div>
        <AnimatePresence>
          {isCodeOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
              <textarea className="code-area" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="status-bar">
        <div>TRACKS: {tracks.length}</div>
        <div>STABLE_v3.2</div>
      </div>
    </div>
  )
}

export default App
