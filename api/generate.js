export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode, history = [] } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API Groq non configurata' });
  }

  const messages = [
    {
      role: "system",
      content: `Sei un Senior Sound Designer e Producer Musicale esperto di Tone.js.
      Il tuo obiettivo è creare musica ELETTRONICA di alta qualità.
      
      LINEE GUIDA PER "BEI SUONI":
      1. NON usare mai Tone.Synth base senza effetti. È troppo povero.
      2. Usa SEMPRE una catena di effetti: Strumento -> FeedbackDelay o Chorus -> Reverb -> Destination.
      3. Per i Bassi/Lead: Usa Tone.MonoSynth o Tone.PolySynth con oscillator type: "fatsawtooth" o "fatpwm" per un suono pieno.
      4. Per il Riverbero: Usa Tone.Reverb(2).toDestination() e ricorda di chiamare .generate() se necessario (o usa valori predefiniti).
      5. Per la Batteria: Usa Tone.MembraneSynth per i Kick (bassi profondi) e Tone.NoiseSynth per Hi-Hats e Snare.
      6. Dinamica: Usa l'inviluppo (envelope) per rendere i suoni "morbidi" (long attack) o "percussivi" (short decay).
      
      REGOLE DI CODICE:
      - Restituisci SOLO il codice JS completo.
      - NO commenti, NO markdown.
      - Usa Tone.getTransport().start() alla fine.`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nIstruzione per migliorare o cambiare il suono:\n${prompt}`
    }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
      })
    });

    const data = await response.json();
    let generatedCode = data.choices[0]?.message?.content || "";
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();
    res.status(200).json({ code: generatedCode });
  } catch (error) {
    res.status(500).json({ error: "Errore di rete" });
  }
}
