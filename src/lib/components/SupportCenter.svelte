<script lang="ts">
  import {
    Terminal,
    Settings,
    Activity,
    Cpu,
    Database,
    Wifi,
    ShieldAlert,
    Clock,
    Search,
    ChevronRight,
    RefreshCw,
    Power,
    Zap,
    MessageSquare,
    Wrench,
    AlertCircle,
    CheckCircle2,
    HardDrive,
    Network
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';
  import NetworkSwarm from './NetworkSwarm.svelte';

  let activeTab = $state<'diagnostics' | 'tickets' | 'remote'>('diagnostics');
  let isUpdating = $state(false);
  let showSwarm = $state(false);
  let merchantId = $state('merchant:M1');

  const systemMetrics = [
    { label: 'CPU Usage', value: '12%', status: 'Healthy', icon: Cpu },
    { label: 'RAM Utilization', value: '4.2GB / 8GB', status: 'Optimal', icon: Database },
    { label: 'Storage', value: '128GB Free', status: 'Healthy', icon: HardDrive },
    { label: 'Network Latency', value: '15ms', status: 'Excellent', icon: Wifi },
  ];

  let tickets = $state<any[]>([]);
  let loadingTickets = $state(false);

  $effect(() => {
    if (activeTab === 'tickets') {
      loadTickets();
    }
  });

  const loadTickets = async () => {
    try {
      loadingTickets = true;
      const res = await api.getTickets();
      if (Array.isArray(res)) {
        tickets = res;
      }
    } catch (e) {
      console.error('Failed to load tickets');
    } finally {
      loadingTickets = false;
    }
  };

  let selectedTicket = $state<any>(null);
  let newComment = $state('');
  let showNewTicketModal = $state(false);
  let newTicket = $state({ store: '', issue: '', priority: 'Medium' });
  let isSubmitting = $state(false);

  let terminalInput = $state('');
  let commandHistory = $state<string[]>([]);
  let historyIndex = $state(-1);
  let terminalLogs = $state<string[]>([
    '$ roxton-os --init-remote --node 042',
    '[SYSTEM] Booting secure shell...',
    '[SYSTEM] Kernel: RoxtonOS v4.2.0-stable',
    '[SYSTEM] Handshake established with Pretoria Hub.',
    '[SUCCESS] Remote terminal mirror live.',
    'Type "help" for a list of available diagnostic commands.'
  ]);

  let terminalScrollEl: HTMLDivElement = $state()!;
  let terminalInputEl: HTMLInputElement = $state()!;

  $effect(() => {
    if (activeTab === 'remote' && terminalInputEl) {
      terminalInputEl.focus();
    }
  });

  $effect(() => {
    if (terminalScrollEl) {
      terminalScrollEl.scrollTop = terminalScrollEl.scrollHeight;
    }
  });

  const executeCommand = (commandText: string) => {
    const input = commandText.trim();
    if (!input) return;

    const cmd = input.toLowerCase();
    const newLogs = [...terminalLogs, `$ ${input}`];

    terminalLogs = newLogs;
    commandHistory = [input, ...commandHistory];
    historyIndex = -1;
    terminalInput = '';

    setTimeout(() => {
      let responses: string[] = [];
      if (cmd === 'help') {
        responses = [
          '[HELP] ROXTON OS REMOTE DIAGNOSTICS',
          '----------------------------------',
          'status   - View node health and connectivity',
          'audit    - Run forensic integrity check',
          'repair   - Attempt automated hardware recovery',
          'logs     - Stream last 50 system events',
          'reboot   - Force remote node restart',
          'clear    - Purge terminal buffer',
          'exit     - Terminate secure session'
        ];
      } else if (cmd === 'status') {
        responses = [
          '[STATUS] NODE: Forecourt-POS-042',
          '[STATUS] Uptime: 45d 12h 04m',
          '[STATUS] Network: 5G Teltonika (Signal: -65dBm)',
          '[STATUS] Hardware: Thermal printer OK, Card Reader OK',
          '[STATUS] Database: 12ms latency to Hub'
        ];
      } else if (cmd === 'audit') {
        responses = [
          '[AUDIT] Scanning sales ledger integrity...',
          '[AUDIT] Verification: 100% COMPLETE',
          '[AUDIT] No discrepancies found in block-sync.',
          '[AUDIT] Secure Hash: 0x88f2...a19'
        ];
      } else if (cmd === 'repair') {
        responses = [
          '[REPAIR] Re-initializing card protocol...',
          '[REPAIR] Flashing temporary buffer...',
          '[SUCCESS] Handshake protocol A1 recovered.'
        ];
      } else if (cmd === 'logs') {
        responses = [
          '[LOG] 14:20:01 - Transaction #9021 completed',
          '[LOG] 14:22:15 - Keep-alive ping from Hub',
          '[LOG] 14:25:30 - User "Cashier_01" session started',
          '[LOG] 14:28:10 - [WARN] Card reader timeout (Handled)'
        ];
      } else if (cmd === 'reboot') {
        responses = [
          '[SYSTEM] Initiating remote reboot sequence...',
          '[SYSTEM] Connection lost. Re-establishing...',
          '[SUCCESS] Node online. Handshake complete.'
        ];
      } else if (cmd === 'clear') {
        terminalLogs = [];
        return;
      } else {
        responses = [`[ERROR] "${cmd}" is not recognized as a Roxton system command.`];
      }

      terminalLogs = [...terminalLogs, ...responses];
    }, 300);
  };

  const handleTerminalCommand = (e: Event) => {
    e.preventDefault();
    executeCommand(terminalInput);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        historyIndex = nextIndex;
        terminalInput = commandHistory[nextIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        historyIndex = nextIndex;
        terminalInput = commandHistory[nextIndex];
      } else if (historyIndex === 0) {
        historyIndex = -1;
        terminalInput = '';
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;

    const comment = {
      user: 'You',
      text: newComment,
      time: 'Just now'
    };

    try {
      await api.addTicketComment(selectedTicket.id, comment);
      tickets = tickets.map((t: any) =>
        t.id === selectedTicket.id
          ? { ...t, comments: [...(t.comments || []), comment] }
          : t
      );

      selectedTicket = {
        ...selectedTicket,
        comments: [...(selectedTicket.comments || []), comment]
      };

      newComment = '';
      toast.success('Comment Added');
    } catch (e) {
      toast.error('Failed to post comment');
    }
  };

  const handleCreateTicket = async (e: Event) => {
    e.preventDefault();
    if (!newTicket.store || !newTicket.issue) {
      toast.error('Missing required fields');
      return;
    }

    isSubmitting = true;
    try {
      const ticket = {
        id: `TIC-${Math.floor(1000 + Math.random() * 9000)}`,
        store: newTicket.store,
        issue: newTicket.issue,
        priority: newTicket.priority,
        status: 'Open',
        time: 'Just now',
        comments: []
      };

      await api.saveTicket(ticket);
      tickets = [ticket, ...tickets];
      isSubmitting = false;
      showNewTicketModal = false;
      newTicket = { store: '', issue: '', priority: 'Medium' };
      toast.success('Incident Logged', { description: 'Support engineers have been notified.' });
    } catch (e) {
      toast.error('Failed to log incident');
    } finally {
      isSubmitting = false;
    }
  };

  const handleGlobalUpdate = () => {
    isUpdating = true;
    toast.promise(new Promise(r => setTimeout(r, 3000)), {
      loading: 'Pushing firmware update v2026.02.b to all regional hubs...',
      success: () => {
        isUpdating = false;
        return 'Update Deployed Successfully';
      },
      error: 'Update Failed'
    });
  };

  const tabs = [
    { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { id: 'tickets', label: 'Incident Desk', icon: MessageSquare },
    { id: 'remote', label: 'Remote Access', icon: Terminal },
  ];

  const hubs = [
    { region: 'Gauteng Hub', load: 82, nodes: 1245, status: 'Stable' },
    { region: 'Western Cape Hub', load: 45, nodes: 890, status: 'Stable' },
    { region: 'KZN Hub', load: 94, nodes: 612, status: 'High Load' },
    { region: 'Eastern Cape Hub', load: 12, nodes: 450, status: 'Low Load' },
  ];

  const priorities = ['Low', 'Medium', 'High', 'Critical'].slice(1);
</script>

<div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div>
      <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Support Command Center</h2>
      <p class="text-neutral-500 font-medium italic">Remote node monitoring â€¢ Remote Terminal Access â€¢ SLA Tracking</p>
    </div>

    <div class="flex flex-col md:flex-row items-center gap-4">
      <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        {#each tabs as tab}
          {@const TabIcon = tab.icon}
          <button
            onclick={() => activeTab = tab.id as any}
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all {activeTab === tab.id ? 'bg-neutral-900 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-900'}"
          >
            <TabIcon class="w-4 h-4" />
            {tab.label}
          </button>
        {/each}
      </div>

      <button
        onclick={() => showSwarm = true}
        class="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 shadow-lg active:scale-95 transition-all"
      >
        <Network class="w-4 h-4" />
        Network Swarm
      </button>
    </div>
  </div>

  {#if showSwarm}
    <NetworkSwarm {merchantId} onClose={() => showSwarm = false} />
  {/if}

  {#if activeTab === 'diagnostics'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each systemMetrics as m, i}
        {@const MetricIcon = m.icon}
        <div class="bg-white dark:bg-neutral-800 p-8 rounded-[40px] border border-neutral-100 dark:border-neutral-700 shadow-sm group hover:border-indigo-600 transition-all">
          <div class="flex items-center justify-between mb-6">
            <div class="w-12 h-12 bg-neutral-50 dark:bg-neutral-700 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <MetricIcon class="w-5 h-5" />
            </div>
            <span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{m.status}</span>
          </div>
          <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{m.label}</p>
          <h4 class="text-2xl font-black tracking-tighter dark:text-neutral-100">{m.value}</h4>
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div class="p-10 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <h3 class="text-xl font-black">Regional Node Status</h3>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Global Health: 99.8%</span>
          </div>
        </div>
        <div class="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each hubs as hub, i}
            <div class="p-8 bg-neutral-50 rounded-[32px] border border-neutral-100 space-y-6">
              <div class="flex justify-between items-center">
                <h4 class="font-black text-neutral-900">{hub.region}</h4>
                <span class="text-[9px] font-black uppercase tracking-widest {hub.status === 'High Load' ? 'text-amber-500' : 'text-emerald-500'}">{hub.status}</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  <span>Cluster Load</span>
                  <span>{hub.load}%</span>
                </div>
                <div class="h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div class="h-full transition-all duration-1000 {hub.load > 90 ? 'bg-red-500' : hub.load > 70 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: {hub.load}%"></div>
                </div>
              </div>
              <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{hub.nodes} Active Terminals</p>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-neutral-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
          <Zap class="w-12 h-12 text-amber-400 mb-8" />
          <h3 class="text-2xl font-black mb-4 tracking-tight">Rapid Deployment</h3>
          <p class="text-neutral-400 font-medium leading-relaxed mb-10">Push system-wide configuration changes or firmware updates to all Roxton nodes.</p>
          <button
            disabled={isUpdating}
            onclick={handleGlobalUpdate}
            class="w-full py-5 bg-white text-neutral-900 rounded-[24px] font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {#if isUpdating}
              <RefreshCw class="w-4 h-4 animate-spin" />
            {:else}
              <RefreshCw class="w-4 h-4" />
            {/if}
            Deploy Global Patch
          </button>
          <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>

        <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-8">
          <div class="flex items-center gap-4">
            <ShieldAlert class="w-8 h-8 text-red-500" />
            <h4 class="text-lg font-black tracking-tight">Critical Alerts</h4>
          </div>
          <div class="space-y-4">
            <div class="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4">
              <AlertCircle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-black text-red-900 uppercase">Failover Active</p>
                <p class="text-[10px] font-medium text-red-600">Store #1024 switched to GPRS via Teltonika.</p>
              </div>
            </div>
            <div class="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
              <AlertCircle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-black text-amber-900 uppercase">Latency Spike</p>
                <p class="text-[10px] font-medium text-amber-600">Gauteng Hub responding with 250ms delay.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if activeTab === 'tickets'}
    <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
      <div class="p-10 border-b border-neutral-100 flex items-center justify-between">
        <h3 class="text-2xl font-black">Support Incident Desk</h3>
        <div class="flex items-center gap-4">
          <div class="relative">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"></Search>
            <input type="text" placeholder="Search incidents..." class="pl-12 pr-6 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-bold outline-none" />
          </div>
          <button
            onclick={() => showNewTicketModal = true}
            class="px-8 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
          >
            New Ticket
          </button>
        </div>
      </div>

      {#key selectedTicket}
        {#if selectedTicket}
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div
              transition:fade={{ duration: 200 }}
              onclick={() => selectedTicket = null}
              onkeydown={(e) => e.key === 'Enter' && (selectedTicket = null)}
              role="button"
              tabindex="0"
              class="absolute inset-0 bg-neutral-900/60 backdrop-blur-md"
            ></div>
            <div
              transition:fly={{ x: 20, scale: 0.9, opacity: 0, duration: 200 }}
              class="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[48px] shadow-2xl p-12 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <MessageSquare class="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-black tracking-tight">{selectedTicket.id}</h3>
                    <p class="text-sm font-bold text-neutral-400 uppercase tracking-widest">{selectedTicket.store}</p>
                  </div>
                </div>
                <button onclick={() => selectedTicket = null} class="p-3 hover:bg-neutral-100 rounded-2xl transition-all">
                  <ChevronRight class="w-6 h-6 text-neutral-400 rotate-180" />
                </button>
              </div>

              <div class="mb-8 p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                <p class="text-[10px] font-black uppercase text-neutral-400 mb-2">Original Incident Description</p>
                <p class="text-neutral-900 font-bold leading-relaxed">{selectedTicket.issue}</p>
              </div>

              <div class="flex-1 overflow-y-auto pr-2 space-y-4 mb-8 custom-scrollbar">
                <p class="text-[10px] font-black uppercase text-neutral-400 tracking-widest sticky top-0 bg-white dark:bg-neutral-900 py-2">Activity Feed</p>
                {#if selectedTicket.comments?.length === 0}
                  <div class="py-10 text-center text-neutral-300 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-neutral-100 rounded-3xl">
                    No activity recorded yet
                  </div>
                {:else}
                  {#each selectedTicket.comments as c, i}
                    <div class="p-5 rounded-3xl border {c.user === 'System' ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-neutral-100 shadow-sm'}">
                      <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest {c.user === 'System' ? 'text-indigo-600' : 'text-neutral-900'}">{c.user}</span>
                        <span class="text-[9px] font-bold text-neutral-400">{c.time}</span>
                      </div>
                      <p class="text-sm font-medium text-neutral-700">{c.text}</p>
                    </div>
                  {/each}
                {/if}
              </div>

              <div class="mt-auto pt-6 border-t border-neutral-100">
                <div class="relative">
                  <textarea
                    rows={2}
                    placeholder="Add internal comment..."
                    class="w-full pl-6 pr-24 py-5 bg-neutral-50 border border-neutral-200 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
                    bind:value={newComment}></textarea>
                  <button
                    onclick={handleAddComment}
                    disabled={!newComment.trim()}
                    class="absolute right-3 bottom-3 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/key}

      {#key showNewTicketModal}
        {#if showNewTicketModal}
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div
              transition:fade={{ duration: 200 }}
              onclick={() => showNewTicketModal = false}
              onkeydown={(e) => e.key === 'Enter' && (showNewTicketModal = false)}
              role="button"
              tabindex="0"
              class="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            ></div>
            <div
              transition:fly={{ y: 20, scale: 0.9, opacity: 0, duration: 200 }}
              class="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[48px] shadow-2xl p-10 overflow-hidden"
            >
              <div class="flex items-center gap-4 mb-8">
                <div class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <MessageSquare class="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 class="text-2xl font-black tracking-tight">Log Incident</h3>
                  <p class="text-xs font-medium text-neutral-400">Escalate a technical issue to the regional hub.</p>
                </div>
              </div>

              <form onsubmit={handleCreateTicket} class="space-y-6">
                <div class="space-y-2">
                  <label for="support-source-store" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Source Store / ID</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Retail Hub #881"
                    bind:value={newTicket.store}
                    id="support-source-store"
                    class="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div class="space-y-2">
                  <label for="support-priority" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Priority Level</label>
                  <div id="support-priority" role="radiogroup" class="grid grid-cols-3 gap-3">
                    {#each priorities as p}
                      <button
                        type="button"
                        onclick={() => newTicket = { ...newTicket, priority: p }}
                        class="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all {newTicket.priority === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-neutral-50 border-neutral-100 text-neutral-400 hover:border-neutral-200'}"
                      >
                        {p}
                      </button>
                    {/each}
                  </div>
                </div>

                <div class="space-y-2">
                  <label for="support-issue" class="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Issue Description</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe the technical failure..."
                    id="support-issue"
                    bind:value={newTicket.issue}
                    class="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"></textarea>
                </div>

                <div class="flex gap-4 pt-4">
                  <button
                    type="button"
                    onclick={() => showNewTicketModal = false}
                    class="flex-1 py-4 bg-neutral-50 text-neutral-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-neutral-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    class="flex-[2] py-4 bg-neutral-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {#if isSubmitting}
                      <RefreshCw class="w-4 h-4 animate-spin" />
                    {:else}
                      <CheckCircle2 class="w-4 h-4" />
                    {/if}
                    {isSubmitting ? 'Logging...' : 'Submit Incident'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        {/if}
      {/key}

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-neutral-50 border-b border-neutral-100">
            <tr>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">ID</th>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Source Store</th>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Incident Detail</th>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Priority</th>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
              <th class="px-10 py-6 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-50">
            {#each tickets as t, i}
              <tr onclick={() => selectedTicket = t} class="group hover:bg-neutral-50 transition-all cursor-pointer">
                <td class="px-10 py-8 font-mono text-xs font-bold text-neutral-900">{t.id}</td>
                <td class="px-10 py-8">
                  <p class="font-black text-neutral-900 text-sm">{t.store}</p>
                  <p class="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{t.time}</p>
                </td>
                <td class="px-10 py-8 font-medium text-neutral-500 text-sm">{t.issue}</td>
                <td class="px-10 py-8">
                  <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest {t.priority === 'Critical' ? 'bg-red-100 text-red-600' : t.priority === 'High' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}">
                    {t.priority}
                  </span>
                </td>
                <td class="px-10 py-8">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full {t.status === 'Open' ? 'bg-red-500' : 'bg-amber-500'}"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-neutral-900">{t.status}</span>
                  </div>
                </td>
                <td class="px-10 py-8 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => {
                        tickets = tickets.filter((ticket: any) => ticket.id !== t.id);
                        toast.success(`Ticket ${t.id} Resolved`);
                      }}
                      class="p-3 hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 rounded-2xl transition-all border border-transparent"
                    >
                      <CheckCircle2 class="w-5 h-5" />
                    </button>
                    <button class="p-3 hover:bg-white hover:shadow-xl rounded-2xl transition-all border border-transparent hover:border-neutral-100">
                      <ChevronRight class="w-5 h-5 text-neutral-400" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if activeTab === 'remote'}
    <div class="bg-neutral-900 rounded-[60px] p-12 text-white shadow-2xl min-h-[600px] flex flex-col">
      <div class="flex items-center justify-between mb-12">
        <div class="flex items-center gap-6">
          <div class="w-16 h-16 bg-white/5 rounded-[28px] flex items-center justify-center border border-white/10">
            <Terminal class="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h3 class="text-3xl font-black tracking-tight">Secure Terminal Mirror</h3>
            <p class="text-neutral-500 font-medium">Remote diagnostic session (Encrypted SSL)</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex flex-col items-end">
            <span class="text-[10px] font-black uppercase tracking-widest text-indigo-400">Connected To</span>
            <span class="text-sm font-bold text-white">Forecourt-POS-042 (Pretoria Hub)</span>
          </div>
          <button class="p-4 bg-red-600 rounded-2xl shadow-xl hover:scale-105 transition-all">
            <Power class="w-6 h-6" />
          </button>
        </div>
      </div>

      <div class="flex-1 bg-black/40 rounded-[48px] border border-white/5 p-12 font-mono text-sm overflow-hidden relative group flex flex-col">
        <div
          bind:this={terminalScrollEl}
          class="flex-1 space-y-3 opacity-80 overflow-y-auto custom-scrollbar mb-6 scroll-smooth"
        >
          {#each terminalLogs as log, i}
            <div class={
              log.startsWith('$') ? 'text-emerald-400 font-bold' :
              log.startsWith('[SUCCESS]') ? 'text-emerald-500 font-bold' :
              log.startsWith('[ERROR]') ? 'text-red-500 font-bold' :
              log.startsWith('[WARN]') ? 'text-amber-400' :
              log.startsWith('[HELP]') || log.startsWith('[STATUS]') || log.startsWith('[AUDIT]') || log.startsWith('[REPAIR]') || log.startsWith('[LOG]') ? 'text-indigo-400' :
              log.startsWith('[SYSTEM]') ? 'text-neutral-500 italic' :
              'text-neutral-400'
            }>
              {log}
            </div>
          {/each}
          <div class="flex items-center gap-2 pt-2">
            <span class="text-emerald-400 font-bold animate-pulse">$</span>
            <form onsubmit={handleTerminalCommand} class="flex-1">
              <input
                bind:this={terminalInputEl}
                type="text"
                spellcheck={false}
                class="bg-transparent border-none outline-none text-white w-full font-mono placeholder:text-neutral-700 focus:ring-0"
                bind:value={terminalInput}
                onkeydown={handleKeyDown}
                placeholder="type 'help' to begin..."
              />
            </form>
          </div>
        </div>

        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
        <div class="absolute bottom-10 right-10 flex gap-4">
          <button
            onclick={() => terminalLogs = []}
            class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Clear Logs
          </button>
          <button
            onclick={() => {
              terminalInput = 'repair';
              setTimeout(() => executeCommand('repair'), 150);
            }}
            class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all"
          >
            Run Repair Script
          </button>
        </div>
      </div>

      <div class="mt-12 grid grid-cols-4 gap-6">
        <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
          <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Session Duration</p>
          <p class="text-xl font-black">12m 45s</p>
        </div>
        <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
          <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Enc. Bitrate</p>
          <p class="text-xl font-black">4.2 Mbps</p>
        </div>
        <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
          <p class="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">SLA Level</p>
          <p class="text-xl font-black">Tier 1 Elite</p>
        </div>
        <div class="p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
          <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Security Status</p>
          <p class="text-xl font-black text-emerald-400">Fully Isolated</p>
        </div>
      </div>
    </div>
  {/if}
</div>
