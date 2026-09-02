"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Float, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";

function ZipBox({ progress, onComplete }) {
  const groupRef = useRef();
  const boxRef = useRef();
  const lidRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }

    if (lidRef.current && progress > 0.3) {
      const targetRotation = (progress - 0.3) / 0.7 * Math.PI / 2;
      lidRef.current.rotation.x = THREE.MathUtils.lerp(lidRef.current.rotation.x, targetRotation, delta * 5);
    }

    if (boxRef.current) {
      boxRef.current.scale.y = THREE.MathUtils.lerp(boxRef.current.scale.y, 1 + progress * 0.2, delta * 3);
      boxRef.current.scale.x = THREE.MathUtils.lerp(boxRef.current.scale.x, 1 + progress * 0.1, delta * 3);
      boxRef.current.scale.z = THREE.MathUtils.lerp(boxRef.current.scale.z, 1 + progress * 0.1, delta * 3);
    }
  });

  useEffect(() => {
    if (progress >= 1 && onComplete) {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  return (
    <group ref={groupRef}>
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
        <meshStandardMaterial color="#7c3aed" metalness={0.8} roughness={0.2} emissive="#4c1d95" emissiveIntensity={0.5} />
      </mesh>

      <mesh position={[0, 0.7, -0.6]} scale={0.3} castShadow>
        <torusGeometry args={[0.25, 0.06, 16, 32]} />
        <meshStandardMaterial color="#06b6d4" metalness={0.8} roughness={0.2} emissive="#0e7490" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function DataParticle({ index, progress }) {
  const ref = useRef();
  const startDelay = index * 0.02;

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    if (t > startDelay && progress > 0.1) {
      const particleProgress = Math.min((t - startDelay) / 1.5, 1);
      const y = THREE.MathUtils.lerp(-2, 3, particleProgress);
      const scale = Math.sin(particleProgress * Math.PI) * 0.3 + 0.1;
      ref.current.position.y = y;
      ref.current.scale.setScalar(scale);
      ref.current.material.opacity = Math.sin(particleProgress * Math.PI) * 0.8;
    }
  });

  return (
    <mesh ref={ref} position={[(index % 8 - 3.5) * 0.5, -2, (Math.floor(index / 8) - 2) * 0.5]}>
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

function SparkleField({ progress }) {
  return (
    <>
      <Stars radius={20} depth={30} count={1500} factor={3} saturation={0} fade speed={1.5} />
      <Sparkles count={120} scale={[8, 5, 3]} size={3} speed={2} color="#a78bfa" opacity={progress} />
    </>
  );
}

function DownloadScene({ progress, onComplete }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1.5} />
      <pointLight position={[-8, 5, -5]} color="#7c3aed" intensity={80} distance={30} decay={2} />
      <pointLight position={[8, -5, 5]} color="#06b6d4" intensity={60} distance={25} decay={2} />

      <SparkleField progress={progress} />

      <ZipBox progress={progress} onComplete={onComplete} />

      {[...Array(40)].map((_, i) => (
        <DataParticle key={i} index={i} progress={progress} />
      ))}
    </>
  );
}

export default function DownloadAnimation3D({ isOpen, onClose, onDownloadStart }) {
  const [progress, setProgress] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnimating(true);
      let p = 0;
      const interval = setInterval(() => {
        p = Math.min(p + 0.02, 1);
        setProgress(p);
        if (p >= 1) {
          clearInterval(interval);
          if (onDownloadStart) onDownloadStart();
          setTimeout(() => {
            setAnimating(false);
            onClose();
          }, 1000);
        }
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
      setAnimating(false);
    }
  }, [isOpen, onClose, onDownloadStart]);

  if (!animating) return null;

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
          <Suspense fallback={null}>
            <DownloadScene progress={progress} onComplete={() => {}} />
          </Suspense>
        </Canvas>

        <Html
          transform
          position={[0, -3.5, 0]}
          style={{
            pointerEvents: "none",
            textAlign: "center",
            color: "white",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          <div className="px-4">
            <p className="text-lg font-bold tracking-tight">Preparing Download</p>
            <p className="text-sm text-zinc-400 mt-1">Creating ZIP archive...</p>
            <div className="mt-4 w-48 mx-auto h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2 font-mono">{Math.round(progress * 100)}%</p>
          </div>
        </Html>
      </div>
    </div>
  );
}