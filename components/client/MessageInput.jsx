"use client";

import { useRef, useState } from "react";
import { SendHorizonal, Paperclip, Loader2, X, File as FileIcon } from "lucide-react";
import AudioRecorder from "./AudioRecorder";
// import VideoRecorder from "./VideoRecorder";
import { validateFile } from "@/lib/utils/formatFileSize";
import { toast } from "@/components/Toast";

export default function MessageInput({ clientId, session, onSent }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [videoMode, setVideoMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileRef = useRef(null);

  async function uploadBlobs(files, recordedAt = null) {
    const form = new FormData();
    form.append("clientId", clientId);
    form.append("purpose", "message");
    if (recordedAt) form.append("recordedAt", recordedAt);

    for (const file of files) {
      form.append("file", file);
    }

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data.files;
  }

  async function postMessage(payload) {
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not send message");
    // Return the message so caller can handle it
    return data.message;
  }

  async function handleSendText() {
    const value = text.trim();
    if (!value && !selectedFiles.length && busy) return;
    setBusy(true);
    setError("");
    const optimisticId = "temp-" + crypto.randomUUID();
    const optimisticMessage = {
      id: optimisticId,
      client_message_id: optimisticId,
      message_type: selectedFiles.length ? "file" : "text",
      body: value || null,
      status: "sending",
      sent_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
      sender: { id: session?.user?.profileId, full_name: session?.user?.name },
      sender_role: session?.user?.role,
      attachments: selectedFiles.map(f => ({
        id: "temp-" + crypto.randomUUID(),
        file_name: f.name,
        file_size: f.size,
        file_type: f.type,
        storage_path: null,
        storage_provider: null,
      })),
    };
    // Show optimistic message immediately with all attachments
    onSent?.({ type: "add", message: optimisticMessage });
    try {
      if (selectedFiles.length) {
        const uploadedFiles = await uploadBlobs(selectedFiles);
        // Replace temp attachments with real ones
        const realAttachments = uploadedFiles.map(f => ({
          id: f.id, file_name: f.file_name, file_size: f.file_size,
          file_type: f.file_type, storage_path: f.storage_path, storage_provider: f.storage_provider,
        }));
        optimisticMessage.attachments = realAttachments;
        optimisticMessage.message_type = "file";
        optimisticMessage.attachment_id = uploadedFiles[0].id;
        optimisticMessage.status = "sent";
        optimisticMessage.sent_at = new Date().toISOString();
        // Update UI immediately with the fully-populated message (all attachments + status)
        onSent?.({ 
          type: "reconcile", 
          clientMessageId: optimisticId, 
          message: optimisticMessage 
        });
        const serverResponse = await postMessage({
          text: value || null,
          attachmentIds: uploadedFiles.map(f => f.id),
          messageType: "file",
          clientMessageId: optimisticId,
        });
        setSelectedFiles([]);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        await postMessage({ text: value, clientMessageId: optimisticId });
      }
      setText("");
    } catch (e) {
      setError(e.message);
      onSent?.({ type: "fail", clientMessageId: optimisticId });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendRecording(blob, mimeType, recordedAt, seconds) {
    setBusy(true);
    setError("");
    try {
      const kind = mimeType.startsWith("audio") ? "audio" : "video";
      const [file] = await uploadBlobs([new File([blob], `recording-${Date.now()}`, { type: mimeType })], recordedAt);
      await postMessage({
        attachmentIds: [file.id],
        messageType: kind,
        recordedAt,
        uploadedAt: new Date().toISOString(),
      });
      setVideoMode(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      const check = validateFile(file);
      if (!check.valid) {
        errors.push(`${file.name}: ${check.error}`);
      } else if (selectedFiles.length + validFiles.length >= 10) {
        errors.push(`Maximum 10 files allowed`);
        break;
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length) {
      toast.error("Some files couldn't be added", { detail: errors.join("\n") });
    }

    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10));
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="border-t border-white/10 bg-ink/60 p-4 backdrop-blur-xl">
      {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}
      
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <FileIcon className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="text-xs truncate max-w-[150px] text-white">{file.name}</span>
              <span className="text-[10px] text-zinc-500 shrink-0">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-zinc-500 hover:text-red-400 transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {videoMode ? (
        <div className="flex justify-start">
          <VideoRecorder onSend={handleSendRecording} />
          <button
            type="button"
            onClick={() => setVideoMode(false)}
            className="ml-3 grid h-9 w-9 place-items-center self-start rounded-xl border border-white/10 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            rows={2}
            placeholder={selectedFiles.length ? "Add a message with your attachment… " : "Write a message… "}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/50"
          />
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || selectedFiles.length >= 10}
              title={selectedFiles.length >= 10 ? "Maximum 10 files reached" : "Attach files (max 10)"}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-500/40 hover:text-violet-300 disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {!videoMode && (
              <AudioRecorder onSend={handleSendRecording} />
            )}
            {/* <button
              type="button"
              onClick={() => setVideoMode(true)}
              disabled={busy}
              title="Record video message"
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-50"
            >
              <VideoIcon />
            </button> */}

            <button
              type="button"
              onClick={handleSendText}
              disabled={busy || (!text.trim() && !selectedFiles.length)}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              {selectedFiles.length ? `Send (${selectedFiles.length})` : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
  );
}
