import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Volume2, VolumeX, Zap, Radio, Code2, AlertCircle
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
    dinoTriggers: { [key: string]: Function };
  }
}

const DEFAULT_CODE = `// Dino-Live PRO: Loops & Triggers
window.dinoChannels = {}; 
window.dinoTriggers = {};

// 1. I LOOP (Base costante)
const kickChan = new Tone.Channel().toDestination();
const kick = new Tone.MembraneSynth().connect(kickChan);
window.dinoChannels.kick = kickChan;

Tone.getTransport().scheduleRepeat((t) => {
  kick.triggerAttackRelease("C1", "8n", t);
}, "4n");

// 2. I TRIGGER (Suoni al volo)
const snare = new Tone.NoiseSynth().toDestination();
window.dinoTriggers.hitSnare = () => snare.triggerAttackRelease("16n");

const fx = new Tone.MetalSynth().toDestination();
window.dinoTriggers.magicFX = () => fx.triggerAttackRelease("1n");

Tone.getTransport().bpm.value = 124;
Tone.getTransport().start();
`;

interface Message { role: 'user' | 'assistant'; content: string; }

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [loopTracks, setLoopTracks] = useState<string[]>([]);
  const [triggerSuoni, setTriggerSuoni] = useState<string[]>([]);
  const [mutedLoops, setMutedLoops] = useState<{ [key: string]: boolean }>({});
  const [errorLog, setErrorLog] = useState<string | null>(null);
  
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const codeRef = useRef<string>(DEFAULT_CODE);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const scanPerformanceRack = () => {
    if (window.dinoChannels) setLoopTracks(Object.keys(window.dinoChannels));
    if (window.dinoTriggers) setTriggerSuoni(Object.keys(window.dinoTriggers));
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
      window.dinoTriggers = {};
      setLoopTracks([]);
      setTriggerSuoni([]);
      setMutedLoops({});
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      setTimeout(scanPerformanceRack, 200);
    } catch (err: any) {
      setErrorLog(err.message || "Errore");
    }
  };

  const toggleLoop = (name: string) => {
    const channel = window.dinoChannels?.[name];
    if (channel) {
      const isMuted = !mutedLoops[name];
      channel.mute = isMuted;
      setMutedTracks(name, isMuted);
    }
  };

  const setMutedTracks = (name: string, isMuted: boolean) => {
    setMutedLoops(prev => ({ ...prev, [name]: isMuted }));
  }

  const fireTrigger = (name: string) => {
    const triggerFunc = window.dinoTriggers?.[name];
    if (triggerFunc) triggerFunc();
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
        body: JSON.stringify({ prompt: currentPrompt, currentCode: codeRef.current, history }),
      });
      const data = await response.json();
      if (data.code) {
        const newMsgs: Message[] = [
          { role: 'user', content: currentPrompt },
          { role: 'assistant', content: "OK" }
        ];
        setHistory(prev => [...prev, ...newMsgs].slice(-6));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      setErrorLog("AI Offline");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <AnimatePresence>
        {!isAudioStarted && (
          <motion.div className="overlay" exit={{ opacity: 0 }} onClick={startAudioEngine}>
            <div className="start-card">
              <Zap size={50} color="var(--matrix-green)" />
              <h2>LIVE PERFORMER</h2>
              <p>Clicca per iniziare</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.PRO</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {errorLog && <AlertCircle color="#ff3131" size={18} />}
          <div className="dot pulse" />
        </div>
      </header>

      <div className="rack">
        <div className="rack-label"><Radio size={10} /> Mixer Loop</div>
        <div className="mixer-scroll">
          {loopTracks.map(t => (
            <div key={t} className={`track-btn ${mutedLoops[t] ? 'muted' : 'active'}`} onClick={() => toggleLoop(t)}>
              {mutedLoops[t] ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <div className="track-name">{t}</div>
            </div>
          ))}
        </div>

        <div className="rack-label" style={{ marginTop: '10px' }}><Zap size={10} /> One-Shot Triggers</div>
        <div className="mixer-scroll">
          {triggerSuoni.map(t => (
            <div key={t} className="trigger-btn" onClick={() => fireTrigger(t)}>
              <Play size={16} fill="currentColor" />
              <div className="track-name">{t}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Evolvi la performance..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "SYCHING..." : "EVOLVI PERFORMANCE"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={18} /></button>
            <button className="btn-icon" style={{ borderColor: '#ff3131', color: '#ff3131' }} onClick={() => Tone.getTransport().stop()}>
              <Square size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between' }} onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={14} /> Source</div>
          <div style={{ fontSize: '0.6rem' }}>{isCodeOpen ? 'HIDE' : 'SHOW'}</div>
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
        <div>CORE: DINO-PRO_v4</div>
        <div>LOOPS: {loopTracks.length} // TRIG: {triggerSuoni.length}</div>
      </div>
    </div>
  )
}

export default App
