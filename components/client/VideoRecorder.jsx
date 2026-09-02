"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Square, RotateCcw, Send, Loader2 } from "lucide-react";

export default function VideoRecorder({ onSend }) {
  const [state, setState] = useState("idle");
  const [blob, setBlob] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const liveRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const stopTracks = useCallback(() => {
    clearInterval(timerRef.current);
    if (liveRef.current?.srcObject) {
      liveRef.current.srcObject.getTracks().forEach((t) => t.stop());
      liveRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      liveRef.current.srcObject = stream;
      liveRef.current.play().catch(() => {});
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stopTracks();
        setBlob(new Blob(chunksRef.current, { type: mime.split(";")[0] }));
        setState("preview");
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Camera/microphone access denied.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
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

  if (state === "idle" || state === "sending") {
    return (
      <button
        type="button"
        onClick={start}
        disabled={state === "sending"}
        title="Record video message"
        className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-50"
      >
        <Video className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-black/40 p-3">
      <div className="relative overflow-hidden rounded-xl">
        {state === "recording" ? (
          <video ref={liveRef} muted playsInline className="aspect-video w-full object-cover" />
        ) : (
          <video src={URL.createObjectURL(blob)} controls playsInline className="aspect-video w-full" />
        )}
        {state === "recording" && (
          <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 font-mono text-xs text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {state === "recording" ? (
          <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white">
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setBlob(null); setState("idle"); }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Redo
            </button>
            <button
              type="button"
              onClick={send}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white"
            >
              <Send className="h-3.5 w-3.5" /> Send video
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
