import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Code2, 
  Music2, 
  Cpu,
  History
} from 'lucide-react'
import './App.css'

const DEFAULT_CODE = `// Dino-Live OS v2026.4
const synth = new Tone.PolySynth(Tone.Synth).toDestination();
const filter = new Tone.Filter(2000, "lowpass").toDestination();
synth.connect(filter);

const loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease(["E2", "E3"], "16n", time);
}, "8n").start(0);

Tone.getTransport().bpm.value = 124;
Tone.getTransport().start();
`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Panel States
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const codeRef = useRef<string>(DEFAULT_CODE);
  const historyRef = useRef<Message[]>([]);

  useEffect(() => {
    codeRef.current = code;
    historyRef.current = history;
  }, [code, history]);

  const executeCode = async (codeToRun: string) => {
    await Tone.start();
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      Tone.getDestination().mute = true;
      
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      setTimeout(() => {
        Tone.getDestination().mute = false;
      }, 60);
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      Tone.getDestination().mute = false;
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
        setHistory(prev => [...prev, { role: 'user', content: currentPrompt }, { role: 'assistant', content: "Codice evoluto." }].slice(-10));
        setCode(data.code);
        await executeCode(data.code);
      } else {
        alert(data.error || "Errore IA");
      }
    } catch (err) {
      alert("Errore di rete");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div className="brand">DINO.OS</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className={`dot ${isPlaying ? 'pulse' : ''}`} />
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>2026.REL_4</span>
        </div>
      </header>

      {/* Main Prompt Panel - Always Open/Prominent */}
      <section className="panel prompt-panel">
        <div className="panel-header">
          <div className="panel-title"><Sparkles size={18} /> Comando Neurale</div>
          <Cpu size={16} style={{ opacity: 0.5 }} />
        </div>
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Cosa vuoi creare? (es. 'Aggiungi una batteria techno', 'Sposta tutto in Re minore', 'Rendi il suono più acido')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          <div className="action-bar">
            <button 
              className="btn-primary" 
              onClick={handleAiGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? "ELABORAZIONE..." : "EVOLVI TRACCIA"}
            </button>
            <button className="btn-icon" onClick={() => executeCode(code)}>
              <Play size={20} />
            </button>
            <button className="btn-icon btn-stop" onClick={() => {
              Tone.getTransport().stop();
              Tone.getTransport().cancel();
              setIsPlaying(false);
            }}>
              <Square size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Code Editor Panel - Collapsible */}
      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={18} /> Sorgente Nucleo</div>
          {isCodeOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        <AnimatePresence>
          {isCodeOpen && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <textarea
                className="code-area"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* History Panel - Collapsible */}
      <section className="panel">
        <div className="panel-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          <div className="panel-title"><History size={18} /> Log Evoluzione</div>
          {isHistoryOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="panel-content"
              style={{ fontSize: '0.8rem', opacity: 0.8 }}
            >
              {history.length === 0 ? "Nessun log disponibile." : history.filter(h => h.role === 'user').map((h, i) => (
                <div key={i} style={{ marginBottom: '5px' }}>
                  <span style={{ color: 'var(--matrix-green)' }}>&gt;</span> {h.content}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="status-bar">
        <div>STATUS: {isGenerating ? 'SYNCING' : 'READY'}</div>
        <div>MEM: 4.2GB // AUDIO: 44.1KHZ</div>
      </div>
    </div>
  )
}

export default App
