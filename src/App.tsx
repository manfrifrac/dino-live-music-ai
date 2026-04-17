import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, ChevronDown, ChevronUp, 
  Code2, History, Volume2, VolumeX, RefreshCcw
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live OS - Mixer Edition FIX v2
window.dinoChannels = {}; 

const masterReverb = new Tone.Reverb(2).toDestination();

// Creazione canali
const kickChan = new Tone.Channel().toDestination();
const synthChan = new Tone.Channel().toDestination();

// Registrazione immediata
window.dinoChannels.kick = kickChan;
window.dinoChannels.synth = synthChan;

const kick = new Tone.MembraneSynth().connect(kickChan);
const synth = new Tone.PolySynth().connect(synthChan);

const loop = new Tone.Loop(t => {
  kick.triggerAttackRelease("C1", "8n", t);
}, "4n").start(0);

const sLoop = new Tone.Loop(t => {
  synth.triggerAttackRelease(["E3", "G3"], "8n", t);
}, "2n").start(0.2);

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
      const foundTracks = Object.keys(window.dinoChannels);
      console.log("Mixer aggiornato, tracce trovate:", foundTracks);
      setTracks(foundTracks);
    }
  };

  const executeCode = async (codeToRun: string) => {
    await Tone.start();
    try {
      // 1. Fermiamo tutto
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      
      // 2. Pulizia totale
      window.dinoChannels = {};
      setTracks([]);
      setMutedTracks({}); // Reset fondamentale del mute
      
      // 3. Esecuzione nuovo codice
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      // 4. Scansione canali con piccolo delay per sicurezza
      setTimeout(() => {
        updateMixerUI();
      }, 100);
      
      setIsPlaying(true);
    } catch (err) {
      console.error("Exec error:", err);
    }
  };

  const toggleMute = (trackName: string) => {
    const channel = window.dinoChannels?.[trackName];
    if (channel) {
      const newMuteState = !mutedTracks[trackName];
      channel.mute = newMuteState; // Imposta il mute reale su Tone.js
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
        setHistory(prev => [...prev, { role: 'user', content: currentPrompt }, { role: 'assistant', content: "OK" }].slice(-10));
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
        <button onClick={() => updateMixerUI()} className="btn-icon" style={{ border: 'none' }}>
          <RefreshCcw size={16} />
        </button>
      </header>

      {/* Mixer Section */}
      <div className="mixer-container">
        {tracks.length === 0 ? (
          <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>Configurazione canali...</div>
        ) : (
          tracks.map(track => (
            <motion.div 
              key={track}
              whileTap={{ scale: 0.9 }}
              className={`track-btn ${mutedTracks[track] ? 'muted' : 'active'}`}
              onClick={() => toggleMute(track)}
            >
              {mutedTracks[track] ? <VolumeX size={18} /> : <Volume2 size={18} />}
              <div className="track-name">{track}</div>
              <div style={{ fontSize: '0.5rem', opacity: 0.5 }}>{mutedTracks[track] ? 'OFF' : 'ON'}</div>
            </motion.div>
          ))
        )}
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Comanda l'IA: 'Aggiungi un basso', 'Fai un solo di synth'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "SINCRONIZZAZIONE..." : "EVOLVI MIX"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={20} /></button>
            <button className="btn-icon btn-stop" onClick={() => { Tone.getTransport().stop(); setIsPlaying(false); }}><Square size={20} /></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={16} /> Studio Console</div>
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

      <div className="status-bar">
        <div>MIXER: {tracks.length} CANALI</div>
        <div>AUDIO: {isPlaying ? 'ON' : 'OFF'}</div>
      </div>
    </div>
  )
}

export default App
