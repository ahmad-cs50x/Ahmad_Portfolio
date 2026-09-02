"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Send, Loader2 } from "lucide-react";

export default function AudioRecorder({ onSend }) {
  const [state, setState] = useState("idle"); // idle | recording | preview | sending
  const [blob, setBlob] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewRef = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.stream) {
      recorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setBlob(new Blob(chunksRef.current, { type: mime }));
        setState("preview");
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    cleanup();
  }

  async function send() {
    if (!blob) return;
    setState("sending");
    const recordedAt = new Date(Date.now() - seconds * 1000).toISOString();
    await onSend(blob, blob.type, recordedAt, seconds);
    setBlob(null);
    setSeconds(0);
    setState("idle");
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        title="Record voice message"
        className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-500/40 hover:text-violet-300"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
      {state === "recording" && (
        <>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-xs text-zinc-300">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <button type="button" onClick={stop} className="grid h-8 w-8 place-items-center rounded-lg bg-red-500 text-white">
            <Square className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {state === "preview" && (
        <>
          <audio ref={previewRef} controls src={URL.createObjectURL(blob)} className="h-9 w-44" />
          <button
            type="button"
            title="Discard"
            onClick={() => { setBlob(null); setState("idle"); }}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Send"
            onClick={send}
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {state === "sending" && <Loader2 className="h-4 w-4 animate-spin text-violet-300" />}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
