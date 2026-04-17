import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Zap, Radio, AlertCircle, Terminal, Power
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
    dinoTriggers: { [key: string]: Function };
    dinoLoops: { [key: string]: any };
  }
}

const DEFAULT_CODE = `// Dino-Live PRO v5 - Anti-Click & Loop Control
window.dinoChannels = {}; 
window.dinoTriggers = {};
window.dinoLoops = {};

const kickChan = new Tone.Channel().toDestination();
const kick = new Tone.MembraneSynth().connect(kickChan);
window.dinoChannels.kick = kickChan;

window.dinoLoops.kick = new Tone.Loop(t => kick.triggerAttackRelease("C1", "8n", t), "4n").start(0);

const synthChan = new Tone.Channel().toDestination();
const synth = new Tone.PolySynth().connect(synthChan);
window.dinoChannels.synth = synthChan;

window.dinoLoops.synth = new Tone.Loop(t => synth.triggerAttackRelease(["E3", "G3"], "16n", t), "2n").start(0.2);

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
  
  const [loopNames, setLoopNames] = useState<string[]>([]);
  const [triggerNames, setTriggerNames] = useState<string[]>([]);
  const [activeLoops, setActiveLoops] = useState<{ [key: string]: boolean }>({});
  const [errorLog, setErrorLog] = useState<string | null>(null);
  
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const codeRef = useRef<string>(DEFAULT_CODE);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const syncUI = () => {
    if (window.dinoLoops) {
      setLoopNames(Object.keys(window.dinoLoops));
      const activeState: any = {};
      Object.keys(window.dinoLoops).forEach(k => {
        activeState[k] = window.dinoLoops[k].state === "started";
      });
      setActiveLoops(activeState);
    }
    if (window.dinoTriggers) setTriggerNames(Object.keys(window.dinoTriggers));
  };

  const startAudioEngine = async () => {
    await Tone.start();
    setIsAudioStarted(true);
    executeCode(codeRef.current);
  };

  const executeCode = async (codeToRun: string) => {
    setErrorLog(null);
    try {
      Tone.getDestination().volume.rampTo(-Infinity, 0.05);
      
      setTimeout(() => {
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
        if (window.dinoLoops) Object.values(window.dinoLoops).forEach((l: any) => l.dispose());
        window.dinoChannels = {};
        window.dinoTriggers = {};
        window.dinoLoops = {};
        
        const func = new Function('Tone', codeToRun);
        func(Tone);
        
        Tone.getDestination().volume.rampTo(0, 0.1);
        setTimeout(syncUI, 200);
      }, 60);
      
    } catch (err: any) {
      setErrorLog(err.message || "Errore");
      Tone.getDestination().volume.rampTo(0, 0.1);
    }
  };

  const toggleLoop = (name: string) => {
    const loop = window.dinoLoops?.[name];
    if (loop) {
      if (loop.state === "started") {
        loop.stop();
        setActiveLoops(prev => ({ ...prev, [name]: false }));
      } else {
        loop.start(0);
        setActiveLoops(prev => ({ ...prev, [name]: true }));
      }
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
        const userMsg: Message = { role: 'user', content: currentPrompt };
        const assistantMsg: Message = { role: 'assistant', content: "OK" };
        setHistory(prev => [...prev, userMsg, assistantMsg].slice(-6));
        setCode(data.code);
        await executeCode(data.code);
      }
    } catch (err) {
      setErrorLog("AI offline");
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
              <Power size={50} color="var(--matrix-green)" />
              <h2>DINO.OS v5</h2>
              <p>Inizializza Protocollo Anti-Click</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.PRO <span style={{opacity:0.5}}>v5</span></div>
        <div className="status-dot pulse" />
      </header>

      <div className="rack">
        <div className="rack-label">Sequencer Status</div>
        <div className="mixer-scroll">
          {loopNames.map(t => (
            <div key={t} className={`track-btn ${activeLoops[t] ? 'active' : 'muted'}`} onClick={() => toggleLoop(t)}>
              {activeLoops[t] ? <Radio size={16} /> : <Power size={16} />}
              <div className="track-name">{t}</div>
              <div style={{fontSize:'0.5rem'}}>{activeLoops[t] ? 'RUN' : 'OFF'}</div>
            </div>
          ))}
        </div>

        <div className="rack-label" style={{marginTop:'10px'}}>Performance Triggers</div>
        <div className="mixer-scroll">
          {triggerNames.map(t => (
            <div key={t} className="trigger-btn" onClick={() => window.dinoTriggers[t]()}>
              <Zap size={16} />
              <div className="track-name">{t}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="panel prompt-panel">
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Evolvi sistema..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "RE-CALIBRATING..." : "EVOLVI SISTEMA"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={18} /></button>
            <button className="btn-icon" style={{ borderColor: '#ff3131', color: '#ff3131' }} onClick={() => Tone.getTransport().stop()}>
              <Square size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className="panel code-preview-panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Terminal size={12} /> Kernell Source Output</div>
        </div>
        {isCodeOpen && (
          <textarea 
            className="code-area" 
            value={code} 
            onChange={(e) => setCode(e.target.value)} 
            spellCheck={false}
          />
        )}
      </section>

      {errorLog && (
        <div className="error-box">
          <AlertCircle size={14} /> {errorLog}
        </div>
      )}

      <div className="status-bar">
        <div>DSP: 48.0KHZ</div>
        <div>LOOPS: {loopNames.length} // ACTIVE: {Object.values(activeLoops).filter(v => v).length}</div>
      </div>
    </div>
  )
}

export default App
