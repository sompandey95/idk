import React, { useEffect, useRef, useState } from 'react';
import {
  NeuralNode,
  Synapse,
  DataPacket,
  DDAState,
  computeActivation,
  calculateLoss
} from '../game/neuralEngine.ts';
import { sound } from '../services/sound.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface NeuralCanvasProps {
  nodes: NeuralNode[];
  synapses: Synapse[];
  packets: DataPacket[];
  dda: DDAState;
  onPacketArrived: (packet: DataPacket, arrivedNode: NeuralNode) => void;
  onWeightAdjusted: (synapseId: string, delta: number) => void;
  onSynapseCreated: (fromId: string, toId: string) => void;
  onNodeSelected: (node: NeuralNode) => void;
  isPaused: boolean;
}

export const NeuralCanvas: React.FC<NeuralCanvasProps> = ({
  nodes,
  synapses,
  packets,
  dda,
  onPacketArrived,
  onWeightAdjusted,
  onSynapseCreated,
  onNodeSelected,
  isPaused
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drag-to-connect state
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  // Particles & visual ripples buffer
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Keep latest props in refs to avoid tearing down 60fps loop
  const propsRef = useRef({
    nodes,
    synapses,
    packets,
    dda,
    onPacketArrived,
    onWeightAdjusted,
    isPaused
  });

  useEffect(() => {
    propsRef.current = {
      nodes,
      synapses,
      packets,
      dda,
      onPacketArrived,
      onWeightAdjusted,
      isPaused
    };
  }, [nodes, synapses, packets, dda, onPacketArrived, onWeightAdjusted, isPaused]);

  // Spawn visual particle burst
  const spawnBurst = (x: number, y: number, color: string, count: number = 16) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 30 + Math.random() * 20,
        color,
        size: 2 + Math.random() * 3
      });
    }
    ripplesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 45,
      alpha: 0.9,
      color
    });
  };

  // Convert screen to canvas coordinates
  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left),
      y: (clientY - rect.top)
    };
  };

  // Find node under pointer
  const findNodeAt = (x: number, y: number, w: number, h: number) => {
    const hitRadius = 34;
    return nodes.find((node) => {
      const nx = node.x * w;
      const ny = node.y * h;
      const dist = Math.hypot(x - nx, y - ny);
      return dist <= hitRadius;
    });
  };

  // Find synapse clicked
  const findSynapseAt = (x: number, y: number, w: number, h: number) => {
    for (const syn of synapses) {
      const from = nodes.find(n => n.id === syn.fromNodeId);
      const to = nodes.find(n => n.id === syn.toNodeId);
      if (!from || !to) continue;

      const x1 = from.x * w;
      const y1 = from.y * h;
      const x2 = to.x * w;
      const y2 = to.y * h;

      // Distance from point to segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(x - projX, y - projY);

      if (dist < 18) {
        return syn;
      }
    }
    return null;
  };

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;

    const hitNode = findNodeAt(x, y, w, h);
    if (hitNode) {
      sound.playTap();
      sound.triggerHaptic('light');
      onNodeSelected(hitNode);
      if (hitNode.layer !== 'output') {
        setConnectingNodeId(hitNode.id);
        setPointerPos({ x, y });
      }
      return;
    }

    const hitSynapse = findSynapseAt(x, y, w, h);
    if (hitSynapse) {
      // Tap synapse to cycle weight
      const nextWeight = hitSynapse.weight >= 1.8 ? -1.5 : Number((hitSynapse.weight + 0.4).toFixed(1));
      onWeightAdjusted(hitSynapse.id, nextWeight);
      sound.playDial(nextWeight);
      sound.triggerHaptic('light');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!connectingNodeId || !canvasRef.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    setPointerPos({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (connectingNodeId && canvasRef.current) {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      const targetNode = findNodeAt(x, y, w, h);

      if (targetNode && targetNode.id !== connectingNodeId) {
        const sourceNode = nodes.find(n => n.id === connectingNodeId);
        if (sourceNode && sourceNode.layer !== targetNode.layer) {
          onSynapseCreated(sourceNode.id, targetNode.id);
          sound.playActivation();
          spawnBurst(targetNode.x * w, targetNode.y * h, '#00f0ff', 12);
        }
      }
    }
    setConnectingNodeId(null);
    setPointerPos(null);
  };

  // 60fps Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = (time: number) => {
      if (!running) return;
      const rawDt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      const dt = Math.min(rawDt, 0.05);

      const w = canvas.width;
      const h = canvas.height;

      // Clear with subtle dark blue tint
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      // Cyber grid background lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const { nodes: currentNodes, synapses: currentSynapses, packets: currentPackets, isPaused: paused } = propsRef.current;

      // 1. Draw Synapses (Axons)
      currentSynapses.forEach((syn) => {
        const from = currentNodes.find(n => n.id === syn.fromNodeId);
        const to = currentNodes.find(n => n.id === syn.toNodeId);
        if (!from || !to) return;

        const x1 = from.x * w;
        const y1 = from.y * h;
        const x2 = to.x * w;
        const y2 = to.y * h;

        const isExcitatory = syn.weight >= 0;
        const baseColor = isExcitatory ? 'rgba(0, 240, 255,' : 'rgba(255, 0, 127,';
        const alpha = Math.min(0.9, 0.25 + Math.abs(syn.weight) * 0.35);
        const lineW = Math.max(1.5, Math.abs(syn.weight) * 2.8);

        // Synapse glow aura
        ctx.save();
        ctx.shadowColor = isExcitatory ? '#00f0ff' : '#ff007f';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = `${baseColor} ${alpha})`;
        ctx.lineWidth = lineW;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        // Synapse weight indicator pip in the middle
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        ctx.fillStyle = '#090e1d';
        ctx.strokeStyle = `${baseColor} 0.8)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(midX, midY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isExcitatory ? '#00f0ff' : '#ff007f';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(syn.weight > 0 ? `+${syn.weight}` : `${syn.weight}`, midX, midY);
      });

      // 2. Drag-to-connect line preview
      if (connectingNodeId && pointerPos) {
        const source = currentNodes.find(n => n.id === connectingNodeId);
        if (source) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = '#00ff9d';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#00ff9d';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(source.x * w, source.y * h);
          ctx.lineTo(pointerPos.x, pointerPos.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Draw & Update Data Packets
      if (!paused) {
        currentPackets.forEach((pkt) => {
          // If packet is moving along a synapse
          const syn = currentSynapses.find(s => s.id === pkt.currentSynapseId);
          if (syn) {
            const from = currentNodes.find(n => n.id === syn.fromNodeId);
            const to = currentNodes.find(n => n.id === syn.toNodeId);
            if (from && to) {
              const x1 = from.x * w;
              const y1 = from.y * h;
              const x2 = to.x * w;
              const y2 = to.y * h;

              // Progress
              pkt.progress += dt * pkt.speed;
              const curX = x1 + (x2 - x1) * pkt.progress;
              const curY = y1 + (y2 - y1) * pkt.progress;

              // Packet packet color
              let pktColor = '#00f0ff';
              if (pkt.isAdversarial) {
                pktColor = '#ff0055'; // Hostile red/magenta
              } else if (pkt.targetClass === 1) {
                pktColor = '#a855f7'; // Purple Beta
              } else if (pkt.targetClass === 2) {
                pktColor = '#00ff9d'; // Lime Gamma
              }

              // Draw packet pulse
              ctx.save();
              ctx.shadowColor = pktColor;
              ctx.shadowBlur = pkt.isAdversarial ? 16 : 10;
              ctx.fillStyle = pktColor;

              ctx.beginPath();
              ctx.arc(curX, curY, pkt.isAdversarial ? 7 : 5.5, 0, Math.PI * 2);
              ctx.fill();

              // Pulsing halo
              ctx.strokeStyle = pktColor;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(curX, curY, (pkt.isAdversarial ? 11 : 8.5) + Math.sin(time * 0.015) * 2, 0, Math.PI * 2);
              ctx.stroke();

              ctx.restore();

              // Arrival Check
              if (pkt.progress >= 1.0) {
                propsRef.current.onPacketArrived(pkt, to);
                spawnBurst(x2, y2, pktColor, pkt.isAdversarial ? 20 : 12);
              }
            }
          }
        });
      }

      // 4. Draw Ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const rip = ripplesRef.current[i];
        rip.radius += dt * 70;
        rip.alpha -= dt * 1.5;
        if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
          ripplesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = rip.color;
        ctx.globalAlpha = Math.max(0, rip.alpha);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Draw Nodes (Input, Hidden, Output)
      currentNodes.forEach((node) => {
        const nx = node.x * w;
        const ny = node.y * h;
        const radius = node.isQuarantine ? 26 : 22;

        let nodeColor = '#00f0ff';
        if (node.isQuarantine) {
          nodeColor = '#ff0055';
        } else if (node.layer === 'input') {
          nodeColor = '#38bdf8';
        } else if (node.layer === 'hidden') {
          nodeColor = '#a855f7';
        } else if (node.layer === 'output') {
          nodeColor = '#00ff9d';
        }

        ctx.save();

        // Node Glow Halo
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = 14;

        // Outer Ring
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#090e1d';
        ctx.beginPath();
        ctx.arc(nx, ny, radius - 2, 0, Math.PI * 2);
        ctx.fill();

        // Central activity dot
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(nx, ny, 6 + Math.sin(time * 0.005 + node.y * 10) * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Label above or below
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(node.label, nx, ny - radius - 5);

        // Subtext / Activation info
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textBaseline = 'top';
        const subtext = node.isQuarantine ? 'SINK ⊘' : `${node.activation.toUpperCase()}`;
        ctx.fillText(subtext, nx, ny + radius + 4);
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      canvasRef.current.style.width = `${rect.width}px`;
      canvasRef.current.style.height = `${rect.height}px`;

      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] select-none touch-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        data-testid="neural-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-crosshair block"
      />
      <div className="absolute bottom-2 left-3 text-[11px] font-mono text-cyan-400/60 pointer-events-none">
        [NEURAL GRAPH VIEWPORT // INTERACTIVE TENSOR BUS]
      </div>
    </div>
  );
};
