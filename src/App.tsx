import { useState, useRef } from 'react'
import * as Tone from 'tone'
import './App.css'

const DEFAULT_CODE = `// Scrivi qui il tuo codice JavaScript musicale!
const synth = new Tone.Synth().toDestination();
const loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease("C4", "8n", time);
}, "4n").start(0);
Tone.getTransport().bpm.value = 120;
Tone.getTransport().start();
`;

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const codeRef = useRef<string>(DEFAULT_CODE);

  codeRef.current = code;

  const handlePlay = async () => {
    await Tone.start();
    try {
      handleStop();
      const func = new Function('Tone', codeRef.current);
      func(Tone);
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      alert("Errore nel codice!");
    }
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
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentCode: code }),
      });
      
      const data = await response.json();
      if (data.code) {
        setCode(data.code);
        setPrompt("");
      } else if (data.error) {
        alert("Errore AI: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Errore nella chiamata all'IA");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="App">
      <h1>Dino-Live 🦖</h1>
      <p>Componi musica con JS e AI</p>

      <div className="ai-container">
        <input
          type="text"
          placeholder="Chiedi all'IA: 'Aggiungi una batteria techno', 'Cambia scala in minore'..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
          disabled={isGenerating}
        />
        <button onClick={handleAiGenerate} disabled={isGenerating}>
          {isGenerating ? "🧠 Pensando..." : "✨ Genera"}
        </button>
      </div>

      <div className="editor-container">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        
        <div className="controls">
          <button onClick={handlePlay}>
            {isPlaying ? "🔄 Riavvia" : "▶️ Esegui"}
          </button>
          <button onClick={handleStop} className="stop-btn">
            ⏹️ Stop
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
