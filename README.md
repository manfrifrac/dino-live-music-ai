# 🦖 Dino-Live - Live Coding Musicale in JS

Benvenuto nel tuo ambiente di live coding musicale! Questa app ti permette di scrivere codice JavaScript usando la libreria **Tone.js** per creare suoni, loop e ritmi direttamente nel browser.

## Come usare l'IA (Groq)
L'app integra un assistente musicale basato su Llama 3 tramite Groq.
1. Scrivi un'istruzione nel campo in alto (es. "Crea un ritmo techno 4/4").
2. Clicca su **✨ Genera**. L'IA riscriverà il codice nell'editor.
3. Clicca su **▶️ Esegui** per sentire il nuovo risultato.

### Configurazione API Key
Per far funzionare l'IA, devi configurare la tua chiave API di Groq su Vercel:
1. Vai sulla dashboard di Vercel del tuo progetto.
2. Vai su **Settings** -> **Environment Variables**.
3. Aggiungi una nuova variabile:
   - Key: `GROQ_API_KEY`
   - Value: La tua API Key (prendila su [console.groq.com](https://console.groq.com/)).
4. Riesegui il deploy o aggiorna l'app.

### Esempio di codice:
```javascript
const synth = new Tone.PolySynth().toDestination();
const now = Tone.now();
synth.triggerAttackRelease("C4", "8n", now);
synth.triggerAttackRelease("E4", "8n", now + 0.5);
synth.triggerAttackRelease("G4", "8n", now + 1);
```

## Come pubblicare su Vercel
Per vedere la tua app online e condividerla, segui questi passi:

1. **Crea un repository su GitHub**: Carica questa cartella su GitHub.
2. **Vai su Vercel**: Accedi a [vercel.com](https://vercel.com).
3. **Importa il progetto**:
   - Clicca su "Add New" -> "Project".
   - Seleziona il repository GitHub appena creato.
4. **Configura il Build**:
   - Framework Preset: **Vite**.
   - Build Command: `npm run build`.
   - Output Directory: `dist`.
5. **Deploy**: Clicca su "Deploy". In pochi secondi la tua app sarà online!

## Sviluppo Locale
Se vuoi lavorarci sul tuo computer:
```bash
npm install
npm run dev
```

Creato con ❤️ e 🦖.
