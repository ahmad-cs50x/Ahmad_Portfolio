"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import {
  Loader2,
  Download,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  FileArchive,
  Trash2,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

function ZipBox({ progress }) {
  const groupRef = useRef();
  const boxRef = useRef();
  const lidRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    if (lidRef.current && progress > 0.3) {
      const targetRotation = (((progress - 0.3) / 0.7) * Math.PI) / 2;
      lidRef.current.rotation.x = THREE.MathUtils.lerp(
        lidRef.current.rotation.x,
        targetRotation,
        delta * 5,
      );
    }
    if (boxRef.current) {
      boxRef.current.scale.y = THREE.MathUtils.lerp(
        boxRef.current.scale.y,
        1 + progress * 0.2,
        delta * 3,
      );
      boxRef.current.scale.x = THREE.MathUtils.lerp(
        boxRef.current.scale.x,
        1 + progress * 0.1,
        delta * 3,
      );
      boxRef.current.scale.z = THREE.MathUtils.lerp(
        boxRef.current.scale.z,
        1 + progress * 0.1,
        delta * 3,
      );
    }
  });

  return (
    <group>
      <mesh ref={boxRef} position={[0, -0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.8, 2.2]} />
        <meshStandardMaterial
          color="#1e1e2e"
          metalness={0.3}
          roughness={0.7}
          emissive="#0f0f1a"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh ref={lidRef} position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.3, 0.15, 2.3]} />
        <meshStandardMaterial
          color="#2a2a3e"
          metalness={0.4}
          roughness={0.5}
          emissive="#1a1a2e"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 0.7, 0.6]} scale={0.3} castShadow>
        <torusGeometry args={[0.25, 0.06, 16, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          metalness={0.8}
          roughness={0.2}
          emissive="#4c1d95"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, 0.7, -0.6]} scale={0.3} castShadow>
        <torusGeometry args={[0.25, 0.06, 16, 32]} />
        <meshStandardMaterial
          color="#06b6d4"
          metalness={0.8}
          roughness={0.2}
          emissive="#0e7490"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

function DataParticle({ index, progress }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    if (t > index * 0.02 && progress > 0.1) {
      const p = Math.min((t - index * 0.02) / 1.5, 1);
      const y = THREE.MathUtils.lerp(-2, 3, p);
      const s = Math.sin(p * Math.PI) * 0.3 + 0.1;
      ref.current.position.y = y;
      ref.current.scale.setScalar(s);
      ref.current.material.opacity = Math.sin(p * Math.PI) * 0.8;
    }
  });
  return (
    <mesh
      position={[
        ((index % 8) - 3.5) * 0.5,
        -2,
        (Math.floor(index / 8) - 2) * 0.5,
      ]}
    >
      <octahedronGeometry args={[0.15, 0]} />
      <meshStandardMaterial
        transparent
        opacity={0}
        color={index % 2 === 0 ? "#7c3aed" : "#06b6d4"}
        emissive={index % 2 === 0 ? "#4c1d95" : "#0e7490"}
        emissiveIntensity={1}
      />
    </mesh>
  );
}

function DownloadScene({ progress }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1.5} />
      <pointLight
        position={[-8, 5, -5]}
        color="#7c3aed"
        intensity={80}
        distance={30}
        decay={2}
      />
      <pointLight
        position={[8, -5, 5]}
        color="#06b6d4"
        intensity={60}
        distance={25}
        decay={2}
      />
      <Stars
        radius={20}
        depth={30}
        count={1500}
        factor={3}
        saturation={0}
        fade
        speed={1.5}
      />
      <ZipBox progress={progress} />
      {[...Array(40)].map((_, i) => (
        <DataParticle key={i} index={i} progress={progress} />
      ))}
    </>
  );
}

function DownloadAnimation3D({ isOpen, onClose, progress }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          className="rounded-2xl"
        >
          <fog attach="fog" args={["#050505", 5, 30]} />
          <DownloadScene progress={progress} />
        </Canvas>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 text-center">
          <p className="text-lg font-bold">
            {progress >= 0.95 ? "Creating ZIP…" : "Downloading files…"}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {progress >= 0.95
              ? "Compressing archive…"
              : "Fetching files from server…"}
          </p>
          <div className="mt-4 mx-auto h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2 font-mono">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FilesPage() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [files, setFiles] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [expandedDays, setExpandedDays] = useState({});
  const [downloadingDay, setDownloadingDay] = useState(null);

  const load = async () => {
    try {
      const res = await fetch("/api/files");
      const json = await res.json();
      if (res.ok) {
        setFiles(json.files ?? []);
        setClientId(json.clientId ?? null);
      }
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  async function remove(id) {
    if (!confirm("Delete this file permanently?")) return;
    await fetch(`/api/files?id=${id}&permanent=true`, { method: "DELETE" });
    load();
  }

  async function downloadDayFiles(day, dayFiles) {
    setDownloadingDay(day);
    setDownloadOpen(true);
    setDownloadProgress(0);

    const zip = new JSZip();
    const total = dayFiles.length;
    for (let i = 0; i < total; i++) {
      const f = dayFiles[i];
      try {
        const res = await fetch(`/api/files/${f.id}`);
        if (res.ok) {
          const blob = await res.blob();
          zip.file(f.file_name, blob);
        }
      } catch (e) {
        console.error("Failed to fetch", f.file_name, e);
      }
      setDownloadProgress((i + 1) / (total + 1));
    }

    setDownloadProgress(0.95);
    const content = await zip.generateAsync({ type: "blob" });
    setDownloadProgress(1);
    const dayLabel = dayFiles[0]
      ? formatDate(dayFiles[0].created_at).replace(/\s+/g, "-")
      : "files";
    saveAs(content, `${dayLabel}.zip`);
    setTimeout(() => {
      setDownloadOpen(false);
      setDownloadingDay(null);
    }, 800);
  }

  async function downloadAllFiles() {
    const filesToZip = filteredFiles;
    if (!filesToZip.length) return;
    setDownloadOpen(true);
    setDownloadProgress(0);

    const zip = new JSZip();
    const total = filesToZip.length;
    const names = new Set();
    for (let i = 0; i < total; i++) {
      const f = filesToZip[i];
      try {
        const res = await fetch(`/api/files/${f.id}`);
        if (res.ok) {
          const blob = await res.blob();
          let name = f.file_name;
          let j = 1;
          while (names.has(name)) {
            const dot = f.file_name.lastIndexOf(".");
            const ext = dot > 0 ? f.file_name.slice(dot) : "";
            const base = dot > 0 ? f.file_name.slice(0, dot) : f.file_name;
            name = `${base} (${j})${ext}`;
            j += 1;
          }
          names.add(name);
          zip.file(name, blob);
        }
      } catch (e) {
        console.error("Failed to fetch", f.file_name, e);
      }
      setDownloadProgress((i + 1) / (total + 1));
    }

    setDownloadProgress(0.95);
    const content = await zip.generateAsync({ type: "blob" });
    setDownloadProgress(1);
    saveAs(content, `all-files.zip`);
    setTimeout(() => {
      setDownloadOpen(false);
    }, 800);
  }

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    let result = files;
    if (filter === "today") {
      const today = new Date();
      result = result.filter((f) => isSameDay(new Date(f.created_at), today));
    } else if (filter === "custom" && customDate) {
      const target = new Date(customDate);
      result = result.filter((f) => isSameDay(new Date(f.created_at), target));
    }
    return result;
  }, [files, filter, customDate]);

  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const f of filteredFiles) {
      const day = formatDate(f.created_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(f);
    }
    return groups;
  }, [filteredFiles]);

  const toggleDay = (day) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const sortedDays = Object.keys(groupedByDay).sort(
    (a, b) => new Date(b) - new Date(a),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-white">Files</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadAllFiles}
            disabled={!files || files.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileArchive className="h-4 w-4" />
            Download all
          </button>
          <Filter className="h-4 w-4 text-zinc-500" />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCustomDate("");
            }}
            className="rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="custom">Custom date</option>
          </select>
          {filter === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none"
            />
          )}
        </div>
      </div>

      {files === null ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <p className="rounded-2xl border border-white/10 p-10 text-center text-sm text-zinc-600">
          No files for this filter.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const dayFiles = groupedByDay[day];
            const isExpanded = expandedDays[day];
            return (
              <div key={day} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleDay(day)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="font-medium text-white">{day}</p>
                      <p className="text-[11px] text-zinc-500">
                        {dayFiles.length} file{dayFiles.length !== 1 ? "s" : ""}{" "}
                        · {formatFileSize(dayFiles.reduce((sum, f) => sum + f.file_size, 0))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDayFiles(day, dayFiles);
                      }}
                      disabled={downloadingDay === day}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingDay === day ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileArchive className="h-3.5 w-3.5" />
                      )}{" "}
                      {downloadingDay === day ? "Downloading…" : "Download all"}
                    </button>
                    <span className="text-zinc-500">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/5 p-4">
                    {dayFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-4 border-b border-white/5 px-2 py-3 last:border-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">
                            {f.file_name}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {formatFileSize(f.file_size)} · {f.purpose}
                          </span>
                        </span>
                        <a
                          href={`/api/files/${f.id}`}
                          title="Download"
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:text-cyan-300"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => remove(f.id)}
                          title="Delete"
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:border-red-500/40 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DownloadAnimation3D
        isOpen={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        progress={downloadProgress}
      />
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
