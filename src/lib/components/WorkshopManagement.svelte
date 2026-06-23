<script lang="ts">
  import {
    Wrench,
    ClipboardList,
    Clock,
    User,
    Car,
    CheckCircle2,
    AlertCircle,
    Plus,
    Search,
    ChevronRight,
    Calendar,
    History,
    FileText,
    ShieldCheck,
    TrendingUp,
    Settings,
    MoreHorizontal,
    Loader2
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';

  interface JobCard {
    id: string;
    vehicle: string;
    reg: string;
    customer: string;
    mechanic: string;
    status: 'Pending' | 'In Progress' | 'Awaiting Parts' | 'Completed';
    startTime: string;
    priority: 'Normal' | 'Urgent' | 'SLA';
    tasks: string[];
  }

  let activeTab = $state<'jobs' | 'mechanics' | 'parts' | 'scheduler'>('jobs');
  let showAddJob = $state(false);
  let loading = $state(false);

  let jobs = $state<JobCard[]>([]);

  let newJob = $state({
    vehicle: '',
    reg: '',
    customer: '',
    mechanic: 'Pieter V.',
    priority: 'Normal',
    tasks: ''
  });

  let mechanics = $state([
    { name: 'Pieter V.', efficiency: 94, jobs: 3, status: 'Active', role: 'Master Technician', weekly: 12 },
    { name: 'Dumisani Z.', efficiency: 88, jobs: 1, status: 'Active', role: 'Senior Mechanic', weekly: 8 },
    { name: 'Lerato M.', efficiency: 92, jobs: 0, status: 'Off-duty', role: 'Diagnostic Specialist', weekly: 10 },
    { name: 'John D.', efficiency: 75, jobs: 2, status: 'Active', role: 'Apprentice', weekly: 5 },
  ]);

  $effect(() => {
    loadJobs();
  });

  const loadJobs = async () => {
    try {
      loading = true;
      const data = await api.getJobCards('merchant:M3');
      if (Array.isArray(data)) jobs = data;
    } catch (e) {
      toast.error('Failed to load job cards');
    } finally {
      loading = false;
    }
  };

  const handleCreateJob = async () => {
    try {
      const jobData = {
        ...newJob,
        status: 'Pending',
        startTime: new Date().toLocaleTimeString(),
        tasks: newJob.tasks.split(',').map(t => t.trim()),
        merchantId: 'merchant:M3'
      };

      await api.saveJobCard(jobData);
      toast.success('Job Card Created');
      showAddJob = false;
      newJob = { vehicle: '', reg: '', customer: '', mechanic: 'Pieter V.', priority: 'Normal', tasks: '' };
      loadJobs();
    } catch (e) {
      toast.error('Failed to create job');
    }
  };

  const handleStatusChange = (id: string, newStatus: JobCard['status']) => {
    jobs = jobs.map(j => j.id === id ? { ...j, status: newStatus } : j);
    toast.success(`Job ${id} status updated to ${newStatus}.`);
  };

  const tabs = [
    { id: 'jobs', label: 'Active Jobs', icon: ClipboardList },
    { id: 'mechanics', label: 'Technicians', icon: User },
    { id: 'scheduler', label: 'SLA Schedule', icon: Calendar },
  ];
</script>

<div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div>
      <div class="flex items-center gap-2 mb-2 text-indigo-500">
        <Wrench class="w-4 h-4" />
        <span class="text-[10px] font-black uppercase tracking-widest">Workshop Specialized Module</span>
      </div>
      <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Workshop Management</h2>
      <p class="text-neutral-500 font-medium">Service Scheduling â€¢ Technician Velocity â€¢ Parts Logistics</p>
    </div>

    <div class="flex items-center gap-3">
      <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        {#each tabs as tab}
          {@const TabIcon = tab.icon}
          <button
            onclick={() => activeTab = tab.id as any}
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all {activeTab === tab.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-lg' : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'}"
          >
            <TabIcon class="w-4 h-4" />
            {tab.label}
          </button>
        {/each}
      </div>
      <button
        onclick={() => showAddJob = true}
        class="flex items-center gap-2 px-8 py-4 bg-neutral-900 text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
      >
        <Plus class="w-4 h-4" /> New Job Card
      </button>
    </div>
  </div>

  {#if activeTab === 'jobs'}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
            <div class="relative flex-1 max-w-md">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"></Search>
              <input type="text" placeholder="Search Registration or Customer..." class="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold text-sm outline-none shadow-sm focus:ring-4 focus:ring-neutral-100 transition-all dark:text-neutral-100 dark:placeholder-neutral-500" />
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                <tr>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Vehicle & Customer</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Technician</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Priority</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Status</th>
                  <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
                {#if loading}
                  <tr><td colspan="5" class="p-10 text-center"><Loader2 class="animate-spin mx-auto text-neutral-300" /></td></tr>
                {:else if jobs.length === 0}
                  <tr><td colspan="5" class="p-10 text-center text-neutral-400 font-bold text-xs uppercase">No active job cards</td></tr>
                {:else}
                  {#each jobs as job}
                    <tr class="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-all cursor-pointer">
                      <td class="px-8 py-6">
                        <div class="flex items-center gap-4">
                          <div class="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <Car class="w-6 h-6" />
                          </div>
                          <div>
                            <p class="font-black text-neutral-900 dark:text-neutral-100 leading-none mb-1">{job.vehicle}</p>
                            <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{job.reg} â€¢ {job.customer}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-8 py-6">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span class="text-xs font-bold text-neutral-700 dark:text-neutral-300">{job.mechanic}</span>
                        </div>
                      </td>
                      <td class="px-8 py-6">
                        <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest {job.priority === 'SLA' ? 'bg-indigo-600 text-white shadow-lg' : job.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-500'}">
                          {job.priority}
                        </span>
                      </td>
                      <td class="px-8 py-6">
                        <select
                          bind:value={job.status}
                          onchange={() => handleStatusChange(job.id, job.status)}
                          class="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer {job.status === 'In Progress' ? 'bg-emerald-50 text-emerald-600' : job.status === 'Awaiting Parts' ? 'bg-amber-50 text-amber-600' : job.status === 'Completed' ? 'bg-indigo-50 text-indigo-600' : 'bg-neutral-100 text-neutral-500'}"
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Awaiting Parts</option>
                          <option>Completed</option>
                        </select>
                      </td>
                      <td class="px-8 py-6 text-right">
                        <button class="p-3 bg-neutral-50 dark:bg-neutral-700 text-neutral-400 rounded-xl hover:text-neutral-900 dark:hover:text-neutral-100 border border-neutral-100 dark:border-neutral-600 transition-all">
                          <ChevronRight class="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>

        <div class="bg-neutral-900 rounded-[48px] p-10 text-white relative overflow-hidden shadow-2xl">
          <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div class="max-w-md">
              <h3 class="text-2xl font-black tracking-tight mb-2">Automated Parts Ordering</h3>
              <p class="text-neutral-500 text-sm font-medium leading-relaxed italic">Inventory velocity syncs with Job Card requirements to trigger automatic supplier POs (FR-52).</p>
            </div>
            <div class="flex gap-4">
              <div class="p-6 bg-white/5 border border-white/5 rounded-3xl text-center min-w-[120px]">
                <p class="text-[10px] font-black uppercase text-indigo-400 mb-1">Pending POs</p>
                <p class="text-3xl font-black">04</p>
              </div>
              <div class="p-6 bg-white/5 border border-white/5 rounded-3xl text-center min-w-[120px]">
                <p class="text-[10px] font-black uppercase text-emerald-400 mb-1">In Transit</p>
                <p class="text-3xl font-black">12</p>
              </div>
            </div>
          </div>
          <div class="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>

      <div class="space-y-8">
        <div class="bg-white dark:bg-neutral-800/50 rounded-[48px] border border-neutral-200 dark:border-neutral-700 p-10 shadow-sm space-y-8">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-black tracking-tight flex items-center gap-3 dark:text-neutral-100">
              <User class="w-5 h-5 text-indigo-500" /> Technician Load
            </h3>
            <TrendingUp class="w-5 h-5 text-emerald-500" />
          </div>
          <div class="space-y-6">
            {#each mechanics.slice(0, 3) as m, i}
              <div class="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 space-y-4 group hover:bg-white dark:hover:bg-neutral-700 hover:shadow-xl transition-all">
                <div class="flex justify-between items-center">
                  <div>
                    <p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{m.name}</p>
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{m.status}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-black text-indigo-600">{m.efficiency}%</p>
                    <p class="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Efficiency</p>
                  </div>
                </div>
                <div class="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div class="h-full bg-indigo-600 transition-all duration-1000" style="width: {m.efficiency}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#key showAddJob}
    {#if showAddJob}
      <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" transition:fade={{ duration: 200 }}>
        <div
          transition:fly={{ y: 20, scale: 0.9, opacity: 0, duration: 200 }}
          class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-2xl w-full shadow-2xl space-y-8"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-2xl font-black tracking-tight dark:text-neutral-100">Create Job Card (FR-50)</h3>
            <button onclick={() => showAddJob = false} class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"><Plus class="w-6 h-6 rotate-45 dark:text-neutral-400" /></button>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <label for="workshop-vehicle-model" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Vehicle Model</label>
              <input type="text" placeholder="e.g. Toyota Hilux GD-6"
                id="workshop-vehicle-model"
                class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={newJob.vehicle}
              />
            </div>
            <div class="space-y-2">
              <label for="workshop-reg-number" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Reg Number</label>
              <input type="text" placeholder="e.g. AB 12 CD GP"
                id="workshop-reg-number"
                class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={newJob.reg}
              />
            </div>
            <div class="space-y-2">
              <label for="workshop-customer-name" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Customer Name</label>
              <input type="text" placeholder="e.g. John Doe"
                id="workshop-customer-name"
                class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={newJob.customer}
              />
            </div>
            <div class="space-y-2">
              <label for="workshop-priority" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Priority</label>
              <select
                id="workshop-priority"
                class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none dark:text-neutral-100"
                bind:value={newJob.priority}
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
                <option value="SLA">SLA Critical</option>
              </select>
            </div>
            <div class="col-span-2 space-y-2">
              <label for="workshop-tasks" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Initial Tasks (Comma separated)</label>
              <input type="text" placeholder="e.g. Oil Change, Brake Inspection"
                id="workshop-tasks"
                class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={newJob.tasks}
              />
            </div>
          </div>

          <button
            onclick={handleCreateJob}
            class="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl"
          >
            Dispatch Job Card
          </button>
        </div>
      </div>
    {/if}
  {/key}
</div>
