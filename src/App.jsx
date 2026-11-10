import { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  AudioLines, Upload, Play, Pause, Download, RotateCcw, SlidersHorizontal,
  Music2, CheckCircle2, LoaderCircle, FileAudio, Volume2
} from "lucide-react";

const BANDS = [
  { label: "31", frequency: 31 },
  { label: "62", frequency: 62 },
  { label: "125", frequency: 125 },
  { label: "250", frequency: 250 },
  { label: "500", frequency: 500 },
  { label: "1K", frequency: 1000 },
  { label: "2K", frequency: 2000 },
  { label: "4K", frequency: 4000 },
  { label: "8K", frequency: 8000 },
  { label: "16K", frequency: 16000 }
];

const DEFAULT_EQ = Array(10).fill(0);

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function safeName(name) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^\w-]+/g, "_") || "audio";
}

export default function App() {
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [eq, setEq] = useState(DEFAULT_EQ);
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Carga un archivo de audio para comenzar.");
  const [engineReady, setEngineReady] = useState(false);
  const [error, setError] = useState("");

  const changed = useMemo(
    () => speed !== 1 || eq.some((value) => value !== 0),
    [speed, eq]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed, audioUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function loadEngine() {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;
    if (loadingEngine) throw new Error("El motor de audio ya se está iniciando.");
    setLoadingEngine(true);
    setStatus("Preparando el motor de audio...");
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: value }) => {
        setProgress(Math.max(0, Math.min(100, Math.round(value * 100))));
      });
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
      });
      ffmpegRef.current = ffmpeg;
      setEngineReady(true);
      return ffmpeg;
    } finally {
      setLoadingEngine(false);
    }
  }

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(nextFile.name)) {
      setError("Selecciona un archivo de audio compatible.");
      return;
    }
    setError("");
    setPlaying(false);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    objectUrlRef.current = nextUrl;
    setFile(nextFile);
    setAudioUrl(nextUrl);
    setCurrentTime(0);
    setDuration(0);
    setStatus("Audio cargado. Ajusta el ecualizador y exporta cuando quieras.");
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError("No se pudo reproducir este archivo en el navegador.");
      }
    }
  }

  function resetControls() {
    setEq(DEFAULT_EQ);
    setSpeed(1);
    setError("");
    setStatus("Ajustes restablecidos.");
  }

  async function exportAudio() {
    if (!file) {
      setError("Primero carga un archivo de audio.");
      return;
    }
    setError("");
    setProcessing(true);
    setProgress(0);
    let ffmpeg;
    try {
      ffmpeg = await loadEngine();
      const inputName = "source_audio";
      const outputName = `${safeName(file.name)}_ChipeoPresion.ogg`;
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const filters = ["aresample=44100"];
      if (speed !== 1) {
        filters.push(`asetrate=44100*${speed.toFixed(5)}`);
        filters.push("aresample=44100");
      }
      BANDS.forEach((band, index) => {
        const gain = eq[index];
        if (gain !== 0) {
          filters.push(`equalizer=f=${band.frequency}:width_type=o:width=1:g=${gain.toFixed(2)}`);
        }
      });

      const args = ["-i", inputName];
      if (filters.length) args.push("-af", filters.join(","));
      args.push("-c:a", "flac", "-compression_level", "8", "-f", "ogg", outputName);

      setStatus("Procesando audio y creando OGG con códec FLAC...");
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) throw new Error("FFmpeg no pudo completar la conversión.");
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: "audio/ogg" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      setProgress(100);
      setStatus("Exportación completada: contenedor OGG + códec FLAC, compresión nivel 8.");
    } catch (err) {
      setError(`No se pudo exportar: ${err?.message || "error desconocido"}`);
      setStatus("La exportación no se completó.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><AudioLines size={23} /></div>
          <div>
            <div className="brand-name">CHIPEO PRESION <span>V2</span></div>
            <div className="brand-subtitle">MUSIC STUDIO</div>
          </div>
        </div>
        <div className="top-status"><span className="status-dot" /> AUDIO WORKSPACE</div>
      </header>

      <section className="hero">
        <div className="eyebrow">PRO AUDIO PROCESSING</div>
        <h1>Tu sonido.<br /><span>Tu control.</span></h1>
        <p>Ecualiza, ajusta la velocidad y exporta tu audio con procesamiento local en el navegador.</p>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div className="section-icon"><Music2 size={18} /></div>
          <div><h2>ESTUDIO DE AUDIO</h2><p>Importa una pista para comenzar a editar.</p></div>
        </div>

        {!file ? (
          <button className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-icon"><Upload size={25} /></div>
            <strong>Seleccionar archivo de audio</strong>
            <span>MP3, WAV, OGG, FLAC, M4A, AAC y más</span>
            <small>El archivo se procesa en tu navegador.</small>
          </button>
        ) : (
          <div className="track-card">
            <div className="track-art"><FileAudio size={26} /></div>
            <div className="track-info">
              <strong>{file.name}</strong>
              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB · {duration ? formatTime(duration) : "Leyendo duración"}</span>
            </div>
            <button className="icon-button" title="Cambiar audio" onClick={() => fileInputRef.current?.click()}><Upload size={18} /></button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*,.flac,.ogg,.opus" hidden onChange={(event) => chooseFile(event.target.files?.[0])} />

        {file && (
          <div className="player">
            <button className="play-button" onClick={togglePlayback}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
            <div className="player-main">
              <div className="player-times"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
              <input className="timeline" type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={(event) => {
                const value = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = value;
                setCurrentTime(value);
              }} />
            </div>
            <Volume2 size={18} className="volume-icon" />
            <audio ref={audioRef} src={audioUrl} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => setPlaying(false)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
          </div>
        )}
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div className="section-icon"><SlidersHorizontal size={18} /></div>
          <div><h2>ECUALIZADOR DE 10 BANDAS</h2><p>Control independiente de frecuencias, de graves a agudos.</p></div>
          <button className="text-button" onClick={() => setEq(DEFAULT_EQ)}>RESTABLECER EQ</button>
        </div>
        <div className="eq-panel">
          <div className="eq-grid">
            {BANDS.map((band, index) => (
              <div className="eq-band" key={band.frequency}>
                <span className="eq-value">{eq[index] > 0 ? "+" : ""}{eq[index].toFixed(1)}</span>
                <input
                  aria-label={`Ganancia ${band.label} Hz`}
                  className="eq-slider"
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={eq[index]}
                  style={{ "--value": `${((eq[index] + 12) / 24) * 100}%` }}
                  onChange={(event) => setEq((old) => old.map((value, i) => i === index ? Number(event.target.value) : value))}
                />
                <span className="eq-frequency">{band.label}</span>
              </div>
            ))}
          </div>
          <div className="eq-scale"><span>+12 dB</span><span>0 dB</span><span>-12 dB</span></div>
        </div>
      </section>

      <section className="workspace speed-workspace">
        <div className="section-heading">
          <div className="section-icon"><AudioLines size={18} /></div>
          <div><h2>VELOCIDAD</h2><p>La velocidad también modifica el tono de reproducción.</p></div>
        </div>
        <div className="speed-card">
          <div className="speed-readout"><strong>{speed.toFixed(2)}x</strong><span>PLAYBACK SPEED</span></div>
          <input className="speed-slider" type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          <div className="speed-labels"><span>0.50x</span><span>1.00x</span><span>2.00x</span></div>
        </div>
      </section>

      <section className="export-panel">
        <div className="export-copy">
          <div className="export-icon"><Download size={21} /></div>
          <div><h2>EXPORTAR AUDIO</h2><p>OGG · Códec FLAC · Compresión nivel 8</p></div>
        </div>
        <button className="export-button" onClick={exportAudio} disabled={!file || processing || loadingEngine}>
          {processing || loadingEngine ? <><LoaderCircle className="spin" size={18} /> PROCESANDO...</> : <><Download size={18} /> DESCARGAR AUDIO</>}
        </button>
        {(processing || loadingEngine) && <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>}
        <div className="status-line">
          {error ? <span className="error-text">{error}</span> : <><CheckCircle2 size={14} /><span>{status}</span></>}
        </div>
        <div className="format-note">La exportación usa FLAC dentro de un contenedor OGG. FLAC es sin pérdida; el tamaño final depende del audio original. La conversión ocurre localmente en este navegador.</div>
      </section>

      <footer><span>CHIPEO PRESION V2</span><span>BUILT FOR SOUND</span></footer>
    </main>
  );
}