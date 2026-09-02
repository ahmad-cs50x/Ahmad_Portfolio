"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, Sparkles, MeshDistortMaterial } from "@react-three/drei";

function ParallaxGroup({ children }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 0.15) * 0.18 + state.pointer.x * 0.35;
    ref.current.rotation.x = -Math.cos(t * 0.12) * 0.08 - state.pointer.y * 0.22;
  });

  return <group ref={ref}>{children}</group>;
}

function Rings() {
  const r1 = useRef();
  const r2 = useRef();

  useFrame((_, delta) => {
    if (r1.current) r1.current.rotation.z += delta * 0.15;
    if (r2.current) r2.current.rotation.z -= delta * 0.12;
  });

  return (
    <>
      <mesh ref={r1} rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[2.3, 0.012, 12, 160]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 1.8, -0.4, 0.4]}>
        <torusGeometry args={[2.9, 0.008, 12, 180]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.35} />
      </mesh>
    </>
  );
}

function Shard({ position, color, scale = 0.3, speed = 1.5 }) {
  return (
    <Float speed={speed} rotationIntensity={2} floatIntensity={2}>
      <mesh position={position} scale={scale}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.15}
          emissive={color}
          emissiveIntensity={0.35}
        />
      </mesh>
    </Float>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 6, 4]} intensity={1.2} />
      <pointLight position={[-6, -2, -4]} color="#06b6d4" intensity={40} distance={25} decay={2} />
      <pointLight position={[5, -3, 3]} color="#d946ef" intensity={30} distance={22} decay={2} />

      <Stars radius={90} depth={40} count={2500} factor={4} saturation={0} fade speed={0.6} />
      <Sparkles count={90} scale={[10, 7, 4]} size={2.5} speed={0.4} color="#a78bfa" opacity={0.6} />

      <ParallaxGroup>
        <Float speed={1.6} rotationIntensity={0.9} floatIntensity={1.4}>
          <mesh>
            <torusKnotGeometry args={[1.05, 0.3, 220, 40]} />
            <MeshDistortMaterial
              color="#8b5cf6"
              metalness={0.85}
              roughness={0.2}
              distort={0.26}
              speed={2.2}
              emissive="#4c1d95"
              emissiveIntensity={0.4}
            />
          </mesh>
        </Float>

        <Rings />

        <Float speed={1.2}>
          <mesh position={[2.6, -1.3, -1.2]} scale={1.15}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.18} />
          </mesh>
        </Float>

        <Shard position={[-2.8, 1.4, -0.8]} color="#e879f9" scale={0.32} />
        <Shard position={[2.3, 1.9, -1.6]} color="#67e8f9" scale={0.26} speed={1.8} />
        <Shard position={[-2.1, -1.9, -0.4]} color="#a78bfa" scale={0.3} speed={1.3} />
        <Shard position={[1.6, -2.3, -2]} color="#f472b6" scale={0.22} speed={2} />
      </ParallaxGroup>
    </>
  );
}

export default function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 42 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      className="!absolute inset-0"
    >
      <fog attach="fog" args={["#050505", 10, 26]} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
