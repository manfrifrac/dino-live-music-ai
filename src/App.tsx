import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Zap, Radio, AlertCircle, Terminal, Power, Mic, Circle
} from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    dinoChannels: { [key: string]: any };
    dinoTriggers: { [key: string]: Function };
    dinoLoops: { [key: string]: any };
    dinoSampleUrl: string | null;
  }
}

const DEFAULT_CODE = `// Dino-Live Sampler OS
window.dinoChannels = {}; 
window.dinoTriggers = {};
window.dinoLoops = {};

// Se hai registrato qualcosa, usalo!
if (window.dinoSampleUrl) {
  const samplerChan = new Tone.Channel().toDestination();
  const sampler = new Tone.Sampler({
    urls: { C4: window.dinoSampleUrl },
    onload: () => console.log("Campione caricato!")
  }).connect(samplerChan);
  
  window.dinoChannels.mic_sample = samplerChan;
  window.dinoTriggers.playSample = () => sampler.triggerAttackRelease("C4", "1n");
}

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
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  // Logic: Record Sample
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
          const url = URL.createObjectURL(blob);
          window.dinoSampleUrl = url;
          alert("Suono campionato! Ora chiedi all'IA di usarlo.");
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        alert("Permesso microfono negato.");
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
        setHistory(prev => [...prev, { role: 'user', content: currentPrompt }, { role: 'assistant', content: "Sampler pronto." }].slice(-6));
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
              <h2>DINO.SAMPLER OS</h2>
              <p>Inizializza Motore Ibrido</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="brand">DINO.SAMPLER</div>
        <button 
          onClick={toggleRecording} 
          className={`rec-btn ${isRecording ? 'recording' : ''}`}
        >
          {isRecording ? <Circle fill="red" size={14} /> : <Mic size={14} />}
          {isRecording ? 'STOP REC' : 'CAMPIONA'}
        </button>
      </header>

      <div className="rack">
        <div className="rack-label">Sequencer</div>
        <div className="mixer-scroll">
          {loopNames.map(t => (
            <div key={t} className={`track-btn ${activeLoops[t] ? 'active' : 'muted'}`} onClick={() => {
              const loop = window.dinoLoops[t];
              if (loop.state === "started") loop.stop(); else loop.start(0);
              syncUI();
            }}>
              <Radio size={16} />
              <div className="track-name">{t}</div>
            </div>
          ))}
        </div>

        <div className="rack-label" style={{marginTop:'8px'}}>Trigger Pads</div>
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
            placeholder="Es: 'Usa il mio campione per fare un basso cupo' o 'Crea una melodia celestiale'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="action-bar">
            <button className="btn-primary" onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? "ANALISI CAMPIONE..." : "EVOLVI PERFORMANCE"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}><Play size={18} /></button>
          </div>
        </div>
      </section>

      <section className="panel code-preview-panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Terminal size={12} /> Kernell Code Output</div>
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

      <div className="status-bar">
        <div>STATUS: {isRecording ? 'RECORDING' : 'HYBRID_MODE'}</div>
        <div>SAMPLES: {window.dinoSampleUrl ? '1' : '0'}</div>
      </div>
    </div>
  )
}

export default App
