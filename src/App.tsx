import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Volume2, VolumeX, Zap, Radio, Code2, AlertCircle, Terminal
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
    dinoTriggers: { [key: string]: Function };
  }
}

const DEFAULT_CODE = `// Dino-Live OS v4.1 - Initializing...
window.dinoChannels = {}; 
window.dinoTriggers = {};

const kickChan = new Tone.Channel().toDestination();
const kick = new Tone.MembraneSynth().connect(kickChan);
window.dinoChannels.kick = kickChan;

Tone.getTransport().scheduleRepeat(t => kick.triggerAttackRelease("C1", "8n", t), "4n");

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
      setErrorLog(err.message || "Errore di esecuzione");
    }
  };

  const toggleLoop = (name: string) => {
    const channel = window.dinoChannels?.[name];
    if (channel) {
      const isMuted = !mutedLoops[name];
      channel.mute = isMuted;
      setMutedLoops(prev => ({ ...prev, [name]: isMuted }));
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
        body: JSON.stringify({ prompt: currentPrompt, currentCode: codeRef.current, history }),
      });
      const data = await response.json();
      if (data.code) {
        setHistory(prev => [...prev, { role: 'user', content: currentPrompt }, { role: 'assistant', content: "OK" }].slice(-6));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      setErrorLog("AI connection lost");
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
              <h2>DINO PERFORMANCE OS</h2>
              <p>Clicca per inizializzare il sistema</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.PRO <span style={{fontSize:'0.6rem', opacity:0.5}}>v4.1</span></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {errorLog && <AlertCircle color="#ff3131" size={18} />}
          <div className="dot pulse" />
        </div>
      </header>

      {/* RACK PERFORMANCE - Top priority for interaction */}
      <div className="rack">
        <div className="rack-label"><Radio size={10} /> Live Mixer</div>
        <div className="mixer-scroll">
          {loopTracks.map(t => (
            <div key={t} className={`track-btn ${mutedLoops[t] ? 'muted' : 'active'}`} onClick={() => toggleLoop(t)}>
              {mutedLoops[t] ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <div className="track-name">{t}</div>
            </div>
          ))}
          {loopTracks.length === 0 && <div className="placeholder-text">Nessun loop...</div>}
        </div>

        <div className="rack-label" style={{ marginTop: '10px' }}><Zap size={10} /> Instant Triggers</div>
        <div className="mixer-scroll">
          {triggerSuoni.map(t => (
            <div key={t} className="trigger-btn" onClick={() => window.dinoTriggers[t]()}>
              <Play size={16} fill="currentColor" />
              <div className="track-name">{t}</div>
            </div>
          ))}
          {triggerSuoni.length === 0 && <div className="placeholder-text">Nessun trigger...</div>}
        </div>
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Comando neurale (es. 'Aggiungi una snare techno', 'Crea un trigger crash')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "CODIFICA IN CORSO..." : "EVOLVI SISTEMA"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={18} /></button>
            <button className="btn-icon" style={{ borderColor: '#ff3131', color: '#ff3131' }} onClick={() => Tone.getTransport().stop()}>
              <Square size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* CODE VIEW - Visible below prompt for direct feedback */}
      <section className="panel code-preview-panel">
        <div className="panel-header" style={{ padding: '0.4rem 1rem' }}>
          <div className="panel-title" style={{fontSize: '0.65rem'}}><Terminal size={12} /> Kernell Code Output</div>
        </div>
        <textarea 
          className="code-area" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          spellCheck={false}
          style={{ height: '220px', fontSize: '0.7rem', border: 'none', background: 'rgba(0,0,0,0.2)' }}
        />
      </section>

      {errorLog && (
        <div className="error-box" style={{ marginTop: '5px' }}>
          <AlertCircle size={14} /> {errorLog}
        </div>
      )}

      <div className="status-bar">
        <div>STATUS: {isGenerating ? 'GEN_MODE' : 'STABLE'}</div>
        <div>MEM: {Math.floor(Math.random() * 50) + 120}MB // DSP: {isPlaying ? 'ACTIVE' : 'IDLE'}</div>
      </div>
    </div>
  )
}

export default App
