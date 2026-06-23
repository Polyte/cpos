<script lang="ts">
  import {
    X, RefreshCw, WifiOff, Monitor, Smartphone, Network, ArrowRightLeft, RotateCcw, Move,
    Webhook, Plus, Trash2, Send, CheckCircle2, AlertCircle, Settings2, Power, ExternalLink
  } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';

  interface SwarmNode {
    id: string;
    name: string;
    type: string;
    ip: string;
    version: string;
    status: 'Online' | 'Offline';
    lastSeen: string;
    uptimeMs: number;
  }

  interface SwarmLink {
    source: string;
    target: string;
    latencyMs: number;
    jitter: number;
    packetLoss: number;
    status: 'healthy' | 'degraded';
  }

  interface NodePosition {
    id: string;
    x: number;
    y: number;
    angle: number;
  }

  interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    type: string;
    severityFilter: string[];
    headers: Record<string, string>;
    enabled: boolean;
    lastFiredAt?: string;
    lastResult?: 'success' | 'failure';
  }

  let {
    merchantId,
    onClose
  }: {
    merchantId: string;
    onClose: () => void;
  } = $props();

  let nodes = $state<SwarmNode[]>([]);
  let links = $state<SwarmLink[]>([]);
  let loading = $state(true);
  let selectedNode = $state<SwarmNode | null>(null);
  let serverTime = $state('');
  let isDragging = $state(false);
  let hasCustomLayout = $state(false);
  let activeTab = $state<'diagnostics' | 'webhooks'>('diagnostics');

  let webhooks = $state<WebhookConfig[]>([]);
  let isAddingWebhook = $state(false);
  let webhookForm = $state<Partial<WebhookConfig>>({
    name: '',
    url: '',
    type: 'Health Alert',
    severityFilter: ['critical', 'warning'],
    enabled: true
  });
  let isTestingWebhook = $state<string | null>(null);

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let animFrameId = $state(0);
  let particles = $state<any[]>([]);
  let nodePositions = $state<NodePosition[]>([]);
  let dragNodeId = $state<string | null>(null);
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  let hasCustomLayoutRef = $state(false);

  let LAYOUT_KEY = $derived(`roxton-swarm-layout:${merchantId}`);

  async function fetchWebhooks() {
    try {
      const res = await api.getAlertWebhooks(merchantId);
      if (res.success) webhooks = res.webhooks || [];
    } catch (e) {
      console.error('Failed to fetch webhooks:', e);
    }
  }

  $effect(() => {
    if (activeTab === 'webhooks') {
      fetchWebhooks();
    }
  });

  async function handleCreateWebhook() {
    if (!webhookForm.name || !webhookForm.url) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      const res = await api.createAlertWebhook(merchantId, webhookForm as any);
      if (res.success) {
        toast.success('Webhook created successfully');
        isAddingWebhook = false;
        webhookForm = { name: '', url: '', type: 'Health Alert', severityFilter: ['critical', 'warning'], enabled: true };
        fetchWebhooks();
      } else {
        toast.error(res.error || 'Failed to create webhook');
      }
    } catch (e) {
      toast.error('Network error creating webhook');
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      const res = await api.deleteAlertWebhook(merchantId, id);
      if (res.success) {
        toast.success('Webhook deleted');
        fetchWebhooks();
      }
    } catch (e) {
      toast.error('Failed to delete webhook');
    }
  }

  async function handleToggleWebhook(webhook: WebhookConfig) {
    try {
      const res = await api.updateAlertWebhook(merchantId, webhook.id, { enabled: !webhook.enabled });
      if (res.success) {
        toast.success(`Webhook ${!webhook.enabled ? 'enabled' : 'disabled'}`);
        fetchWebhooks();
      }
    } catch (e) {
      toast.error('Failed to update webhook');
    }
  }

  async function handleTestWebhook(id: string) {
    isTestingWebhook = id;
    try {
      const res = await api.testAlertWebhook(merchantId, id);
      if (res.success) {
        toast.success('Test webhook fired successfully');
      } else {
        toast.error(res.error || 'Webhook test failed');
      }
    } catch (e) {
      toast.error('Network error during webhook test');
    } finally {
      isTestingWebhook = null;
      fetchWebhooks();
    }
  }

  function saveLayoutToStorage(positions: NodePosition[]) {
    try {
      if (!canvasEl) return;
      const rect = canvasEl.parentElement?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const normalized = positions.map(p => ({
        id: p.id,
        xRatio: p.x / rect.width,
        yRatio: p.y / rect.height,
        angle: p.angle
      }));
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(normalized));
    } catch (_) {}
  }

  function loadLayoutFromStorage(nodeList: SwarmNode[], canvasWidth: number, canvasHeight: number): NodePosition[] | null {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return null;
      const normalized: { id: string; xRatio: number; yRatio: number; angle: number }[] = JSON.parse(raw);
      if (!Array.isArray(normalized) || normalized.length === 0) return null;
      const savedIds = new Set(normalized.map(n => n.id));
      const currentIds = nodeList.map(n => n.id);
      if (!currentIds.every(id => savedIds.has(id))) return null;
      return currentIds.map(id => {
        const saved = normalized.find(n => n.id === id)!;
        const xRatio = typeof saved.xRatio === 'number' && isFinite(saved.xRatio) ? Math.max(0.05, Math.min(0.95, saved.xRatio)) : 0.5;
        const yRatio = typeof saved.yRatio === 'number' && isFinite(saved.yRatio) ? Math.max(0.05, Math.min(0.95, saved.yRatio)) : 0.5;
        return {
          id,
          x: xRatio * canvasWidth,
          y: yRatio * canvasHeight,
          angle: typeof saved.angle === 'number' && isFinite(saved.angle) ? saved.angle : 0
        };
      });
    } catch (_) {
      return null;
    }
  }

  function clearLayoutStorage() {
    try { localStorage.removeItem(LAYOUT_KEY); } catch (_) {}
  }

  async function fetchSwarm() {
    try {
      const data = await api.getNetworkSwarm(merchantId);
      nodes = data.nodes || [];
      links = data.links || [];
      serverTime = data.serverTime || '';
    } catch (e) {
      console.error('Swarm fetch error:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchSwarm();
    const interval = setInterval(fetchSwarm, 5000);
    return () => clearInterval(interval);
  });

  function computeCircularLayout(nodeList: SwarmNode[], cx: number, cy: number) {
    const radius = Math.min(cx, cy) * 0.55;
    return nodeList.map((n, i) => {
      const angle = (i / nodeList.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: n.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle
      };
    });
  }

  function resetLayout() {
    if (!canvasEl || nodes.length === 0) return;
    const rect = canvasEl.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    nodePositions = computeCircularLayout(nodes, cx, cy);
    hasCustomLayoutRef = false;
    hasCustomLayout = false;
    clearLayoutStorage();
  }

  function getCanvasCoords(e: MouseEvent) {
    if (!canvasEl) return { x: 0, y: 0 };
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: MouseEvent) {
    const { x, y } = getCanvasCoords(e);
    const HIT_RADIUS = 24;

    for (const np of nodePositions) {
      const dx = x - np.x;
      const dy = y - np.y;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
        dragNodeId = np.id;
        dragOffsetX = dx;
        dragOffsetY = dy;
        isDragging = true;
        hasCustomLayout = true;
        hasCustomLayoutRef = true;
        const matchedNode = nodes.find(n => n.id === np.id);
        if (matchedNode) selectedNode = matchedNode;
        return;
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragNodeId) return;
    const { x, y } = getCanvasCoords(e);
    const idx = nodePositions.findIndex(p => p.id === dragNodeId);
    if (idx >= 0) {
      nodePositions[idx] = {
        ...nodePositions[idx],
        x: x - dragOffsetX,
        y: y - dragOffsetY
      };
      nodePositions = [...nodePositions];
    }
  }

  function handleMouseUp() {
    if (dragNodeId && nodePositions.length > 0) {
      saveLayoutToStorage(nodePositions);
    }
    dragNodeId = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    isDragging = false;
  }

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    if (nodePositions.length !== nodes.length || !hasCustomLayoutRef) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      if (hasCustomLayoutRef && nodePositions.length > 0) {
        const existingMap = new Map(nodePositions.map(p => [p.id, p]));
        const radius = Math.min(cx, cy) * 0.55;
        nodePositions = nodes.map((n, i) => {
          if (existingMap.has(n.id)) return existingMap.get(n.id)!;
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          return { id: n.id, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, angle };
        });
      } else {
        const saved = loadLayoutFromStorage(nodes, canvas.width, canvas.height);
        if (saved) {
          nodePositions = saved;
          hasCustomLayoutRef = true;
          hasCustomLayout = true;
        } else {
          nodePositions = computeCircularLayout(nodes, cx, cy);
        }
      }
    }

    if (particles.length === 0 || links.length !== Math.floor(particles.length / 3)) {
      const newParticles: any[] = [];
      for (const link of links) {
        for (let p = 0; p < 3; p++) {
          newParticles.push({
            link,
            progress: Math.random(),
            speed: 0.003 + Math.random() * 0.005,
            size: 1.5 + Math.random() * 1.5
          });
        }
      }
      particles = newParticles;
    }

    let running = true;
    function animate() {
      if (!running) return;
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      for (const link of links) {
        const sourceNode = nodePositions.find(n => n.id === link.source);
        const targetNode = nodePositions.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) continue;

        const isHealthy = link.status === 'healthy';
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = isHealthy
          ? `rgba(52, 211, 153, ${0.15 + Math.sin(Date.now() * 0.002) * 0.05})`
          : `rgba(251, 191, 36, ${0.2 + Math.sin(Date.now() * 0.003) * 0.1})`;
        ctx.lineWidth = isHealthy ? 1.5 : 2;
        ctx.setLineDash(isHealthy ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        const mx = (sourceNode.x + targetNode.x) / 2;
        const my = (sourceNode.y + targetNode.y) / 2;
        ctx.fillStyle = isHealthy ? 'rgba(52, 211, 153, 0.6)' : 'rgba(251, 191, 36, 0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${link.latencyMs}ms`, mx, my - 6);
        if (link.packetLoss > 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.fillText(`${link.packetLoss}% loss`, mx, my + 8);
        }
      }

      for (const particle of particles) {
        const sourceNode = nodePositions.find(n => n.id === particle.link.source);
        const targetNode = nodePositions.find(n => n.id === particle.link.target);
        if (!sourceNode || !targetNode) continue;

        particle.progress += particle.speed;
        if (particle.progress > 1) particle.progress = 0;

        const px = sourceNode.x + (targetNode.x - sourceNode.x) * particle.progress;
        const py = sourceNode.y + (targetNode.y - sourceNode.y) * particle.progress;

        const isHealthy = particle.link.status === 'healthy';
        ctx.beginPath();
        ctx.arc(px, py, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = isHealthy ? 'rgba(52, 211, 153, 0.8)' : 'rgba(251, 191, 36, 0.8)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, particle.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = isHealthy ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const np of nodePositions) {
        const nodeData = nodes.find(n => n.id === np.id);
        if (nodeData?.status === 'Online') {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(np.x, np.y);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.05)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      for (const np of nodePositions) {
        const nodeData = nodes.find(n => n.id === np.id);
        const isOnline = nodeData?.status === 'Online';
        const isSelected = selectedNode?.id === np.id;
        const isBeingDragged = dragNodeId === np.id;
        const pulse = Math.sin(Date.now() * 0.003 + np.angle) * 2;

        if (isBeingDragged) {
          ctx.beginPath();
          ctx.arc(np.x, np.y, 34, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (isOnline) {
          ctx.beginPath();
          ctx.arc(np.x, np.y, 28 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(250, 204, 21, 0.1)' : 'rgba(52, 211, 153, 0.05)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(np.x, np.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = isOnline
          ? (isSelected ? 'rgba(250, 204, 21, 0.2)' : 'rgba(52, 211, 153, 0.15)')
          : 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
        ctx.strokeStyle = isOnline
          ? (isSelected ? 'rgba(250, 204, 21, 0.6)' : 'rgba(52, 211, 153, 0.4)')
          : 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        if (isOnline) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.font = '6px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('\u2725', np.x, np.y - 10);
        }

        ctx.fillStyle = isOnline ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(np.id, np.x, np.y + 3);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '7px monospace';
        ctx.fillText((nodeData?.name || '').substring(0, 16), np.x, np.y + 36);
      }

      ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HUB', cx, cy + 3);

      animFrameId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resize);
    };
  });

  let onlineCount = $derived(nodes.filter(n => n.status === 'Online').length);
  let avgLatency = $derived(links.length > 0
    ? Math.round(links.reduce((s, l) => s + l.latencyMs, 0) / links.length)
    : 0);
  let degradedLinks = $derived(links.filter(l => l.status === 'degraded').length);
</script>

<div class="fixed inset-0 z-[700] bg-black/95 backdrop-blur-xl flex flex-col">
  <!-- Header -->
  <div class="h-14 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-neutral-900/40">
    <div class="flex items-center gap-4">
      <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
        <Network class="w-4 h-4 text-amber-400" />
      </div>
      <div>
        <h2 class="text-xs font-black text-white uppercase tracking-widest">Network Swarm Diagnostics</h2>
        <p class="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">P2P Mesh Topology - Real-time</p>
      </div>

      <div class="flex gap-1 ml-8 bg-black/40 p-1 rounded-lg border border-white/5">
        <button
          onclick={() => activeTab = 'diagnostics'}
          class="px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all {
            activeTab === 'diagnostics' ? 'bg-amber-500 text-black' : 'text-white/40 hover:text-white'
          }"
        >
          Topology
        </button>
        <button
          onclick={() => activeTab = 'webhooks'}
          class="px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all {
            activeTab === 'webhooks' ? 'bg-amber-500 text-black' : 'text-white/40 hover:text-white'
          }"
        >
          Webhooks
        </button>
      </div>
    </div>
    <div class="flex items-center gap-2">
      {#if activeTab === 'diagnostics' && hasCustomLayout}
        <button
          onclick={resetLayout}
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="Reset to circular layout"
        >
          <RotateCcw class="w-3 h-3" />
          Reset Layout
        </button>
      {/if}
      {#if activeTab === 'diagnostics'}
        <div class="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
          <Move class="w-3 h-3 text-white/30" />
          <span class="text-[7px] font-black text-white/30 uppercase tracking-widest">Drag Nodes</span>
        </div>
      {/if}
      <button onclick={fetchSwarm} class="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
      </button>
      <button onclick={onClose} class="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>

  <div class="flex-1 flex overflow-hidden">
    {#if activeTab === 'diagnostics'}
      <!-- Canvas Area -->
      <div class="flex-1 relative">
        <canvas
          bind:this={canvasEl}
          class="w-full h-full {isDragging ? 'cursor-grabbing' : 'cursor-grab'}"
          onmousedown={handleMouseDown}
          onmousemove={handleMouseMove}
          onmouseup={handleMouseUp}
          onmouseleave={handleMouseUp}
        ></canvas>

        {#if nodes.length > 0}
          <div class="absolute inset-0 pointer-events-none">
            <div class="absolute top-4 left-4 flex gap-2 pointer-events-auto">
              <div class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <p class="text-[8px] font-black text-white/40 uppercase tracking-widest">Nodes</p>
                <p class="text-sm font-black text-emerald-400">{onlineCount}<span class="text-white/30">/{nodes.length}</span></p>
              </div>
              <div class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <p class="text-[8px] font-black text-white/40 uppercase tracking-widest">Avg Latency</p>
                <p class="text-sm font-black text-amber-400">{avgLatency}ms</p>
              </div>
              <div class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <p class="text-[8px] font-black text-white/40 uppercase tracking-widest">Links</p>
                <p class="text-sm font-black text-white">{links.length}</p>
              </div>
              {#if degradedLinks > 0}
                <div class="px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p class="text-[8px] font-black text-rose-400 uppercase tracking-widest">Degraded</p>
                  <p class="text-sm font-black text-rose-400">{degradedLinks}</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Side Panel -->
      <div class="w-72 border-l border-white/5 flex flex-col bg-neutral-950/50">
        <div class="p-4 border-b border-white/5">
          <p class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-3">Terminal Fleet</p>
          <div class="space-y-2">
            {#each nodes as node}
              <button
                onclick={() => selectedNode = selectedNode?.id === node.id ? null : node}
                class="w-full p-3 rounded-lg border text-left transition-all {
                  selectedNode?.id === node.id
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                }"
              >
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-1.5 h-1.5 rounded-full {node.status === 'Online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}"></div>
                  {#if node.type === 'Handheld'}
                    <Smartphone class="w-3 h-3 text-white/40" />
                  {:else}
                    <Monitor class="w-3 h-3 text-white/40" />
                  {/if}
                  <span class="text-[10px] font-black text-white uppercase tracking-wider">{node.id}</span>
                </div>
                <p class="text-[9px] text-white/40 truncate">{node.name}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[8px] font-mono text-white/20">{node.ip}</span>
                  <span class="text-[8px] font-mono text-white/20">v{node.version}</span>
                </div>
              </button>
            {/each}
            {#if nodes.length === 0}
              <div class="text-center py-8">
                <WifiOff class="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p class="text-[9px] text-white/20 font-bold uppercase tracking-widest">No nodes detected</p>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <p class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-3">P2P Link Matrix</p>
          <div class="space-y-1.5">
            {#each links as link, i}
              <div class="p-2 rounded-lg border text-[9px] {
                link.status === 'healthy'
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-amber-500/5 border-amber-500/10'
              }">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-black text-white/60">{link.source.slice(-4)}</span>
                    <ArrowRightLeft class="w-2.5 h-2.5 text-white/20" />
                    <span class="font-mono font-black text-white/60">{link.target.slice(-4)}</span>
                  </div>
                  <span class="font-black {link.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}">
                    {link.latencyMs}ms
                  </span>
                </div>
                <div class="flex gap-3 text-white/30">
                  <span>Jitter: {link.jitter}ms</span>
                  {#if link.packetLoss > 0}
                    <span class="text-rose-400">Loss: {link.packetLoss}%</span>
                  {/if}
                </div>
              </div>
            {/each}
            {#if links.length === 0}
              <p class="text-[9px] text-white/20 text-center py-4">No active links</p>
            {/if}
          </div>
        </div>

        <div class="p-3 border-t border-white/5 text-center">
          <p class="text-[8px] font-mono text-white/20">
            Server: {serverTime ? new Date(serverTime).toLocaleTimeString() : '--'}
          </p>
        </div>
      </div>
    {:else}
      <!-- Webhooks View -->
      <div class="flex-1 overflow-y-auto p-8 bg-black">
        <div class="max-w-4xl mx-auto space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-black text-white uppercase tracking-widest">Webhook Integrations</h3>
              <p class="text-xs text-white/40 mt-1">Forward health alerts and system events to external services.</p>
            </div>
            {#if !isAddingWebhook}
              <button
                onclick={() => isAddingWebhook = true}
                class="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
              >
                <Plus class="w-4 h-4" />
                Add Webhook
              </button>
            {/if}
          </div>

          {#if isAddingWebhook}
            <div class="p-6 bg-neutral-900 border border-white/10 rounded-xl space-y-4">
              <div class="flex items-center justify-between border-b border-white/5 pb-4">
                <h4 class="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Webhook class="w-4 h-4" />
                  New Configuration
                </h4>
                <button onclick={() => isAddingWebhook = false} class="text-white/40 hover:text-white">
                  <X class="w-4 h-4" />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label for="swarm-hook-name" class="text-[10px] font-black text-white/40 uppercase tracking-widest">Hook Name</label>
                  <input
                    type="text"
                    id="swarm-hook-name"
                    placeholder="e.g. Slack Alerts"
                    class="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 transition-colors"
                    bind:value={webhookForm.name}
                  />
                </div>
                <div class="space-y-1.5">
                  <label for="swarm-event-type" class="text-[10px] font-black text-white/40 uppercase tracking-widest">Event Type</label>
                  <select
                    id="swarm-event-type"
                    class="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 transition-colors"
                    bind:value={webhookForm.type}
                  >
                    <option>Health Alert</option>
                    <option>System Event</option>
                    <option>Billing Alert</option>
                  </select>
                </div>
              </div>

              <div class="space-y-1.5">
                <label for="swarm-endpoint-url" class="text-[10px] font-black text-white/40 uppercase tracking-widest">Endpoint URL</label>
                <input
                  type="url"
                  id="swarm-endpoint-url"
                  placeholder="https://hooks.slack.com/services/..."
                  class="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 transition-colors"
                  bind:value={webhookForm.url}
                />
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  onclick={() => isAddingWebhook = false}
                  class="px-4 py-2 text-xs font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onclick={handleCreateWebhook}
                  class="px-6 py-2 bg-amber-500 text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
                >
                  Initialize Hook
                </button>
              </div>
            </div>
          {/if}

          <div class="space-y-3">
            {#each webhooks as wh}
              <div class="group p-5 bg-neutral-900/50 border border-white/5 rounded-xl hover:border-white/10 transition-all">
                <div class="flex items-start justify-between">
                  <div class="flex gap-4">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center {wh.enabled ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-white/20'}">
                      <Webhook class="w-5 h-5" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-black text-white uppercase tracking-wider">{wh.name}</h4>
                        <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest {
                          wh.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'
                        }">
                          {wh.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p class="text-xs font-mono text-white/30 mt-1">{wh.url}</p>
                      <div class="flex items-center gap-4 mt-3">
                        <div class="flex items-center gap-1.5">
                          <Settings2 class="w-3 h-3 text-white/20" />
                          <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">{wh.type}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <RefreshCw class="w-3 h-3 text-white/20" />
                          <span class="text-[9px] font-black text-white/40 uppercase tracking-widest">
                            {wh.lastFiredAt ? `Last fired ${new Date(wh.lastFiredAt).toLocaleTimeString()}` : 'Never fired'}
                          </span>
                        </div>
                        {#if wh.lastResult}
                          <div class="flex items-center gap-1.5">
                            {#if wh.lastResult === 'success'}
                              <CheckCircle2 class="w-3 h-3 text-emerald-400" />
                            {:else}
                              <AlertCircle class="w-3 h-3 text-rose-400" />
                            {/if}
                            <span class="text-[9px] font-black uppercase tracking-widest {wh.lastResult === 'success' ? 'text-emerald-400' : 'text-rose-400'}">
                              {wh.lastResult}
                            </span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onclick={() => handleTestWebhook(wh.id)}
                      disabled={isTestingWebhook === wh.id}
                      class="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                      title="Test Webhook"
                    >
                      <Send class="w-4 h-4 {isTestingWebhook === wh.id ? 'animate-pulse' : ''}" />
                    </button>
                    <button
                      onclick={() => handleToggleWebhook(wh)}
                      class="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-amber-400 transition-colors"
                      title={wh.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power class="w-4 h-4" />
                    </button>
                    <button
                      onclick={() => handleDeleteWebhook(wh.id)}
                      class="p-2 hover:bg-rose-500/10 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}

            {#if webhooks.length === 0 && !isAddingWebhook}
              <div class="text-center py-20 bg-neutral-900/20 border border-dashed border-white/5 rounded-2xl">
                <Webhook class="w-10 h-10 text-white/5 mx-auto mb-4" />
                <p class="text-xs font-black text-white/20 uppercase tracking-[0.2em]">No Webhooks Configured</p>
                <p class="text-[10px] text-white/10 mt-2">Connect your POS fleet to Slack, Discord, or custom endpoints.</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
