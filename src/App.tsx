import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import './App.css'

const DEFAULT_CODE = `// Dino-Live Matrix 2026
// Benvenuto nel sistema di composizione assistita.

const synth = new Tone.PolySynth(Tone.Synth).toDestination();
const reverb = new Tone.Reverb(2).toDestination();
synth.connect(reverb);

// Loop armonico iniziale
const loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease(["C3", "G3", "C4"], "2n", time);
}, "1n").start(0);

Tone.getTransport().bpm.value = 80;
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
  
  const codeRef = useRef<string>(DEFAULT_CODE);
  const historyRef = useRef<Message[]>([]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const executeCode = async (codeToRun: string) => {
    await Tone.start();
    try {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      
      Tone.getDestination().mute = true;
      
      // Valutazione dinamica
      const func = new Function('Tone', codeToRun);
      func(Tone);
      
      setTimeout(() => {
        Tone.getDestination().mute = false;
      }, 50);

      setIsPlaying(true);
    } catch (err) {
      console.error("Audio Exec Error:", err);
      // Tentativo di ripristino
      Tone.getDestination().mute = false;
    }
  };

  const handlePlayManual = () => {
    executeCode(codeRef.current);
  };

  const handleStop = () => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getDestination().mute = true;
    setTimeout(() => {
      Tone.getDestination().mute = false;
    }, 100);
    setIsPlaying(false);
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
        const newCode = data.code;
        
        // Aggiorna storia locale
        const newHistory: Message[] = [
          ...historyRef.current,
          { role: 'user', content: currentPrompt },
          { role: 'assistant', content: "Codice aggiornato." }
        ];
        
        // Mantieni solo gli ultimi 10 messaggi per non saturare il contesto
        setHistory(newHistory.slice(-10));
        setCode(newCode);
        
        // Auto-Play
        await executeCode(newCode);
      } else {
        alert("Errore AI: " + (data.error || "Sconosciuto"));
      }
    } catch (err) {
      console.error(err);
      alert("Errore connessione AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="App">
      <div className="scanline"></div>
      
      <h1>Dino-Live 2026</h1>
      
      <div className="ai-container">
        <div className="prompt-wrapper">
          <textarea
            className="prompt-input"
            placeholder="Comanda l'IA (es. 'Aggiungi una batteria techno', 'Sposta in scala minore', 'Rendi tutto più spaziale')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAiGenerate();
              }
            }}
            disabled={isGenerating}
          />
          <button 
            className="ai-btn" 
            onClick={handleAiGenerate} 
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? "⚡ SINCRONIZZAZIONE..." : "✨ EVOLVI SISTEMA"}
          </button>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', opacity: 0.6 }}>
          L'IA ricorda le modifiche precedenti. Usa Shift+Enter per andare a capo.
        </div>
      </div>

      <div className="editor-container">
        <textarea
          className="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        
        <div className="controls">
          <button className="btn" onClick={handlePlayManual}>
            {isPlaying ? "🔄 RESET MANUALE" : "▶️ ESEGUI CODICE"}
          </button>
          <button className="btn btn-stop" onClick={handleStop}>
            ⏹️ TERMINA AUDIO
          </button>
        </div>
      </div>

      <footer style={{ marginTop: '3rem', fontSize: '0.8rem', opacity: 0.4 }}>
        SISTEMA OPERATIVO DINO-OS // MATRIX V2026.4 // STATUS: ONLINE
      </footer>
    </div>
  )
}

export default App
