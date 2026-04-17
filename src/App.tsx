import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, ChevronDown, ChevronUp, 
  Code2, Volume2, VolumeX, RefreshCcw, AlertTriangle, CheckCircle2
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live OS - FIX v3
window.dinoChannels = {}; 

// Canali e Strumenti
const master = new Tone.Channel().toDestination();
const kick = new Tone.MembraneSynth().connect(master);
const synth = new Tone.PolySynth().connect(master);

window.dinoChannels.kick = master;
window.dinoChannels.synth = master;

// Sequenza semplice
Tone.getTransport().scheduleRepeat((time) => {
  kick.triggerAttackRelease("C1", "8n", time);
}, "4n");

Tone.getTransport().scheduleRepeat((time) => {
  synth.triggerAttackRelease(["E3", "G3"], "16n", time);
}, "2n");

Tone.getTransport().bpm.value = 120;
Tone.getTransport().start();
`;

interface Message { role: 'user' | 'assistant'; content: string; }

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
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
    console.log("Audio Engine Started");
    executeCode(codeRef.current);
  };

  const executeCode = async (codeToRun: string) => {
    setErrorLog(null);
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      window.dinoChannels = {};
      setTracks([]);
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      setTimeout(() => updateMixerUI(), 150);
      setIsPlaying(true);
    } catch (err: any) {
      console.error(err);
      setErrorLog(err.message || "Errore sconosciuto nel codice");
    }
  };

  const toggleMute = (trackName: string) => {
    const channel = window.dinoChannels?.[trackName];
    if (channel) {
      const newMuteState = !mutedTracks[trackName];
      channel.mute = newMuteState;
      setMutedTracks(prev => ({ ...prev, [trackName]: newMuteState }));
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
        const newMsgs: Message[] = [
          { role: 'user', content: currentPrompt },
          { role: 'assistant', content: "OK" }
        ];
        setHistory(prev => [...prev, ...newMsgs].slice(-10));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      setErrorLog("Errore connessione IA");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      {!isAudioStarted && (
        <div className="overlay" onClick={startAudioEngine}>
          <motion.div 
            initial={{ scale: 0.8 }} 
            animate={{ scale: 1 }} 
            className="start-card"
          >
            <Play size={48} />
            <h2>ATTIVA NUCLEO AUDIO</h2>
            <p>Clicca per sbloccare l'ambiente musicale</p>
          </motion.div>
        </div>
      )}

      <header>
        <div className="brand">DINO.OS v3</div>
        <div className="status-icons">
          {errorLog ? <AlertTriangle color="#ff3e3e" size={16} /> : <CheckCircle2 color="#00ff41" size={16} />}
          <span style={{ fontSize: '0.6rem' }}>{errorLog ? 'ERRORE' : 'ONLINE'}</span>
        </div>
      </header>

      {/* Mixer */}
      <div className="mixer-container">
        {tracks.length === 0 ? (
          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>Canali non rilevati</div>
        ) : (
          tracks.map(track => (
            <motion.div 
              key={track}
              whileTap={{ scale: 0.95 }}
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
          {errorLog && (
            <div className="error-box">
              <AlertTriangle size={14} /> {errorLog}
            </div>
          )}
          <textarea
            className="main-prompt"
            placeholder="Chiedi all'IA di comporre..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "SYNCING..." : "GENERA"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={20} /></button>
            <button className="btn-icon btn-stop" onClick={() => { Tone.getTransport().stop(); setIsPlaying(false); }}><Square size={20} /></button>
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
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
              <textarea className="code-area" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="status-bar">
        <div>BPM: {isPlaying ? '120' : '0'}</div>
        <div>Vercel: {isGenerating ? 'BUSY' : 'IDLE'}</div>
      </div>
    </div>
  )
}

export default App
