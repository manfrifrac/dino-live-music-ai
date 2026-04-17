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
  Cpu,
  History
} from 'lucide-react'
import './App.css'

const DEFAULT_CODE = `// Dino-Live Matrix 2026 - High Fidelity Sound Design
// Catena di effetti globale per un suono ricco
const masterReverb = new Tone.Reverb(2.5).toDestination();
const masterDelay = new Tone.FeedbackDelay("8n", 0.4).connect(masterReverb);

// Synth principale - PolySynth con oscillatore "fat"
const lead = new Tone.PolySynth(Tone.MonoSynth, {
  oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
  envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 1.5 },
  filter: { q: 1, type: "lowpass", rolloff: -24 },
  filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.5, baseFrequency: 200, octaves: 4 }
}).connect(masterDelay);

// Kick Drum profondo
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 10,
  oscillator: { type: "sine" }
}).toDestination();

// Loop Armonico (Chord progression)
const loop = new Tone.Loop((time) => {
  lead.triggerAttackRelease(["C3", "G3", "Bb3", "F4"], "2n", time);
}, "1n").start(0);

// Kick sul beat
const kickLoop = new Tone.Loop((time) => {
  kick.triggerAttackRelease("C1", "8n", time);
}, "4n").start(0);

Tone.getTransport().bpm.value = 110;
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
      }, 70);
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
        const newMessages: Message[] = [
          { role: 'user', content: currentPrompt },
          { role: 'assistant', content: "Sound Design migliorato." }
        ];
        setHistory(prev => [...prev, ...newMessages].slice(-10));
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
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>AUDIO_HI-FI</span>
        </div>
      </header>

      <section className="panel prompt-panel">
        <div className="panel-header">
          <div className="panel-title"><Sparkles size={18} /> Produzione IA</div>
          <Cpu size={16} style={{ opacity: 0.5 }} />
        </div>
        <div className="panel-content">
          <textarea
            className="main-prompt"
            placeholder="Descrivi il suono che desideri (es. 'Fai un basso acido techno', 'Crea una melodia celestiale', 'Dacci un beat hip hop sporco')..."
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
              {isGenerating ? "PRODUCENDO..." : "GENERA SOUND DESIGN"}
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

      <section className="panel">
        <div className="panel-header" onClick={() => setIsCodeOpen(!isCodeOpen)}>
          <div className="panel-title"><Code2 size={18} /> Studio Rack</div>
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

      <section className="panel">
        <div className="panel-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          <div className="panel-title"><History size={18} /> Session Log</div>
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
              {history.length === 0 ? "In attesa di istruzioni sonore." : history.filter(h => h.role === 'user').map((h, i) => (
                <div key={i} style={{ marginBottom: '5px' }}>
                  <span style={{ color: 'var(--matrix-green)' }}>&gt;</span> {h.content}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="status-bar">
        <div>AUDIO: 24-BIT // DSP: HIGH</div>
        <div>SAMP RATE: 48KHZ // SYNC: INTERNAL</div>
      </div>
    </div>
  )
}

export default App
