<script lang="ts">
  import {
    UserPlus, Fingerprint, FileText, Search, MoreVertical, ShieldCheck, Mail, Phone, MapPin,
    Trash2, Edit3, CheckCircle2, X, CreditCard, Building, Clock, AlertCircle, History as HistoryIcon,
    Activity, UserCheck, Ban, UserCog, ChevronRight, Filter, TrendingUp, Lock, Loader2
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { api } from '../api';
  import { fade, fly } from 'svelte/transition';

  interface UserIdentity {
    id: string;
    name: string;
    email: string;
    role: string;
    status: 'Active' | 'Blocked';
    merchantId?: string;
    biometricRegistered?: boolean;
  }

  interface AttendanceRecord {
    id: string;
    userId: string;
    userName: string;
    clockIn: string;
    clockOut: string | null;
    status: 'On Time' | 'Late' | 'Absent';
    branch: string;
    date: string;
  }

  let { profile, role }: { profile: string; role: string } = $props();

  let activeSubTab = $state<'users' | 'attendance' | 'audits' | 'compliance'>('users');
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedUser = $state<UserIdentity | null>(null);
  let selectedBranch = $state('All Branches');
  let loading = $state(false);
  let users = $state<UserIdentity[]>([]);
  let searchQuery = $state('');

  let userForm = $state({
    name: '',
    email: '',
    password: '',
    role: 'Cashier',
    merchantId: 'merchant:M1',
    status: 'Active' as 'Active' | 'Blocked'
  });

  const complianceMatrix = [
    { id: 'PCI', label: 'PCI-DSS Level 1', status: 'Compliant', icon: ShieldCheck, desc: 'End-to-end encryption for EMV transactions and card data protection.' },
    { id: 'POPIA', label: 'POPIA / GDPR', status: 'Compliant', icon: Lock, desc: 'Personal employee and customer data encrypted with regional residency.' },
    { id: 'VAT', label: 'VAT Compliance', status: 'Active', icon: FileText, desc: 'Automatic 15% calculation and legal receipt generation with Tax ID.' },
    { id: 'AUDIT', label: 'Immutable Audit Trail', status: 'Active', icon: HistoryIcon, desc: 'Cryptographically hashed logs of all supervisor overrides and price changes.' },
  ];

  const isAdmin = $derived(role === 'Admin');
  const isManager = $derived(role === 'Manager');

  let attendance = $state<AttendanceRecord[]>([
    { id: 'A1', userId: 'U-002', userName: 'Sarah Mokoena', clockIn: '08:02 AM', clockOut: null, status: 'On Time', branch: 'Sandton #1024', date: '2026-02-01' },
    { id: 'A2', userId: 'U-001', userName: 'John Smith', clockIn: '07:45 AM', clockOut: null, status: 'On Time', branch: 'Sandton #1024', date: '2026-02-01' },
  ]);

  $effect(() => {
    loadUsers();
  });

  const loadUsers = async () => {
    try {
      loading = true;
      const data = await api.getUsers();
      if (Array.isArray(data)) {
        const branchData = role === 'Admin' ? data : data.filter((u: any) => {
          if (profile === 'Forecourt') return u.merchantId === 'merchant:M2';
          if (profile === 'Workshop') return u.merchantId === 'merchant:M3';
          if (profile === 'Restaurant') return u.merchantId === 'merchant:M4';
          return u.merchantId === 'merchant:M1' || !u.merchantId;
        });
        users = branchData;
      } else {
        users = [];
      }
    } catch (e) {
      console.error('loadUsers error:', e);
      users = [];
      toast.error('Failed to load users');
    } finally {
      loading = false;
    }
  };

  let isCapturing = $state(false);

  const simulateCapture = () => {
    isCapturing = true;
    setTimeout(() => {
      isCapturing = false;
      toast.success('Biometric Template Captured Successfully');
    }, 2000);
  };

  const handleCreateUser = async () => {
    try {
      loading = true;
      const res = await api.signup(userForm);
      if (res.error) throw new Error(res.error);
      toast.success('User Enrolled Successfully');
      showAddModal = false;
      userForm = { name: '', email: '', password: '', role: 'Cashier', merchantId: 'merchant:M1', status: 'Active' };
      loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create user');
    } finally {
      loading = false;
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (isManager && selectedUser.role === 'Admin') {
      toast.error('Insufficient Permissions: Managers cannot modify Admin accounts.');
      return;
    }
    try {
      loading = true;
      const res = await api.updateUser(selectedUser.id, userForm);
      if (res.error) throw new Error(res.error);
      toast.success('User updated successfully');
      showEditModal = false;
      selectedUser = null;
      loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update user');
    } finally {
      loading = false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (isManager && user?.role === 'Admin') {
      toast.error('Insufficient Permissions: Managers cannot delete Admin accounts.');
      return;
    }
    if (!confirm('Are you sure you want to delete this user? This action is irreversible and will remove all access.')) return;
    try {
      loading = true;
      const res = await api.deleteUser(id);
      if (res.error) throw new Error(res.error);
      toast.success('User removed from system');
      loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete user');
    } finally {
      loading = false;
    }
  };

  const toggleStatus = async (user: UserIdentity) => {
    if (!isAdmin && !isManager) return;
    const newStatus = user.status === 'Active' ? 'Blocked' : 'Active';
    try {
      await api.updateUser(user.id, { status: newStatus });
      users = users.map(u => u.id === user.id ? { ...u, status: newStatus } : u);
      toast.success(`User access ${newStatus === 'Active' ? 'restored' : 'suspended'}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const openEditModal = (user: UserIdentity) => {
    selectedUser = user;
    userForm = {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      merchantId: user.merchantId || 'merchant:M1',
      status: user.status
    };
    showEditModal = true;
  };

  const filteredUsers = $derived(
    users.filter((u: UserIdentity) =>
      (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.email?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedBranch === 'All Branches' || u.merchantId === selectedBranch) &&
      (role === 'Admin' || (
        (profile === 'Forecourt' && u.merchantId === 'merchant:M2') ||
        (profile === 'Workshop' && u.merchantId === 'merchant:M3') ||
        (profile === 'Retail' && u.merchantId === 'merchant:M1') ||
        (profile === 'Restaurant' && u.merchantId === 'merchant:M4')
      )) &&
      (!isManager || u.role !== 'Admin')
    )
  );

  const tabs = [
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'audits', label: 'Audit Logs', icon: Activity },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck }
  ];
</script>

<div class="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
    <div>
      <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Identity & Access Governance</h2>
      <p class="text-neutral-500 font-medium">Biometric Enrollment â€¢ Attendance Matrix â€¢ Supervisor Audit Logs</p>
    </div>
    <div class="flex items-center gap-3">
      {#if isAdmin}
        <div class="flex items-center gap-2 bg-white dark:bg-neutral-800 px-4 py-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <Building class="w-4 h-4 text-neutral-400" />
          <select
            bind:value={selectedBranch}
            class="bg-transparent text-xs font-black outline-none border-none uppercase tracking-widest dark:text-neutral-100"
          >
            <option value="All Branches">All Branches</option>
            <option value="merchant:M1">Sandton #1024</option>
            <option value="merchant:M2">Waterfront #201</option>
            <option value="merchant:M3">Workshop #04</option>
            <option value="merchant:M4">Melrose Arch Kitchen</option>
          </select>
        </div>
      {/if}

      <div class="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl">
        {#each tabs as tab}
          {@const TabIcon = tab.icon}
          <button
            onclick={() => activeSubTab = tab.id as any}
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all {activeSubTab === tab.id ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'}"
          >
            <TabIcon class="w-4 h-4" /> {tab.label}
          </button>
        {/each}
      </div>
      {#if isAdmin || isManager}
        <button
          onclick={() => {
            userForm = { name: '', email: '', password: '', role: 'Cashier', merchantId: 'merchant:M1', status: 'Active' };
            showAddModal = true;
          }}
          class="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:scale-105 transition-all"
        >
          <UserPlus class="w-4 h-4" />
          Enrol New User
        </button>
      {/if}
    </div>
  </div>

  {#if activeSubTab === 'users'}
    <div class="bg-white dark:bg-neutral-800/50 rounded-[40px] border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
      <div class="p-8 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
        <div class="relative flex-1 max-w-md">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"></Search>
          <input
            type="text"
            placeholder="Search by name, ID or role..."
            class="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
            bind:value={searchQuery}
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
            <tr>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">User Profile</th>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Branch Node</th>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Identity Details</th>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Biometrics</th>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-center">Status</th>
              <th class="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-50 dark:divide-neutral-800">
            {#if loading && users.length === 0}
              <tr><td colspan="6" class="p-10 text-center"><Loader2 class="animate-spin mx-auto text-neutral-300" /></td></tr>
            {:else if filteredUsers.length === 0}
              <tr><td colspan="6" class="p-10 text-center text-neutral-400 font-bold uppercase text-xs">No users found</td></tr>
            {:else}
              {#each filteredUsers as user (user.id)}
                <tr class="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                      <div class="w-12 h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center font-black">
                        {user.name?.[0]}
                      </div>
                      <div>
                        <p class="font-black text-neutral-900 dark:text-neutral-100">{user.name}</p>
                        <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <p class="text-xs font-bold text-neutral-500 uppercase tracking-tight">{user.merchantId || 'Global'}</p>
                  </td>
                  <td class="px-8 py-6">
                    <div class="space-y-1">
                      <p class="text-xs font-bold text-neutral-700">ID: {user.id.substring(0,8)}...</p>
                      <p class="text-[10px] font-bold text-neutral-400 uppercase">{user.email}</p>
                    </div>
                  </td>
                  <td class="px-8 py-6 text-center">
                    <div class="flex items-center justify-center gap-1.5 {user.biometricRegistered ? 'text-emerald-500' : 'text-neutral-300'}">
                      <Fingerprint class="w-5 h-5" />
                      <span class="text-[9px] font-black uppercase">{user.biometricRegistered ? 'Registered' : 'Pending'}</span>
                    </div>
                  </td>
                  <td class="px-8 py-6 text-center">
                    <button
                      disabled={(!isAdmin && !isManager) || loading}
                      onclick={() => toggleStatus(user)}
                      class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all {user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}"
                    >
                      {user.status || 'Active'}
                    </button>
                  </td>
                  <td class="px-8 py-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        onclick={() => openEditModal(user)}
                        class="p-2 hover:bg-indigo-50 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <Edit3 class="w-4 h-4" />
                      </button>
                      <button
                        onclick={() => handleDeleteUser(user.id)}
                        class="p-2 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if activeSubTab === 'attendance'}
    <div class="bg-white dark:bg-neutral-800/50 p-10 rounded-[48px] shadow-sm border border-neutral-200 dark:border-neutral-700">
      <h3 class="text-xl font-black mb-4 dark:text-neutral-100">Attendance Matrix</h3>
      <p class="text-neutral-400">Live attendance data.</p>
    </div>
  {/if}

  {#if activeSubTab === 'compliance'}
    <div class="space-y-12">
      <div class="bg-white dark:bg-neutral-800/50 p-12 rounded-[48px] border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <h3 class="text-2xl font-black mb-8 dark:text-neutral-100">Governance & Compliance</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          {#each complianceMatrix as item}
            {@const ItemIcon = item.icon}
            <div class="p-10 bg-neutral-50 dark:bg-neutral-800 rounded-[40px] flex gap-8 items-start">
              <ItemIcon class="w-8 h-8 text-neutral-400" />
              <div>
                <h4 class="text-lg font-black dark:text-neutral-100">{item.label}</h4>
                <p class="text-sm text-neutral-500">{item.desc}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#key showAddModal || showEditModal}
    {#if showAddModal || showEditModal}
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" transition:fade={{ duration: 200 }}>
        <div
          transition:fly={{ scale: 0.9, opacity: 0, duration: 200 }}
          class="bg-white dark:bg-neutral-900 rounded-[40px] p-10 max-w-2xl w-full shadow-2xl relative"
        >
          <button onclick={() => { showAddModal = false; showEditModal = false; }} class="absolute top-8 right-8 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"><X class="w-6 h-6 dark:text-neutral-400" /></button>
          <h3 class="text-2xl font-black mb-2 tracking-tight dark:text-neutral-100">{showEditModal ? 'Update Identity Profile' : 'Biometric User Enrollment'}</h3>
          <p class="text-neutral-400 text-sm mb-10">{showEditModal ? 'Modify user credentials and system access levels.' : 'Register identity details and capture unique biometric templates.'}</p>

          <div class="grid grid-cols-2 gap-6 mb-8">
            <div class="space-y-2">
              <label for="full-legal-name" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Full Legal Name</label>
              <input id="full-legal-name" type="text" placeholder="e.g. Nomvula Zulu" class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={userForm.name}
              />
            </div>
            <div class="space-y-2">
              <label for="email-address" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Email Address</label>
              <input id="email-address" type="email" placeholder="email@roxton.com" class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={userForm.email}
              />
            </div>
            <div class="space-y-2">
              <label for="password" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{showEditModal ? 'New Password (Optional)' : 'Initial Password'}</label>
              <input id="password" type="password" placeholder={showEditModal ? 'Leave blank to keep same' : 'Create Password'} class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100 dark:placeholder-neutral-500"
                bind:value={userForm.password}
              />
            </div>
            <div class="space-y-2">
              <label for="assigned-role" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Assigned Role</label>
              <select id="assigned-role" class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100"
                bind:value={userForm.role}
              >
                <option value="Cashier">Cashier</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Manager">Manager</option>
                <option value="Stock Controller">Stock Controller</option>
                {#if isAdmin}
                  <option value="Admin">Admin</option>
                {/if}
              </select>
            </div>

            <div class="space-y-2 col-span-2">
              <label for="merchant-branch-id" class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Merchant / Branch ID</label>
              <select id="merchant-branch-id" class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-neutral-100"
                bind:value={userForm.merchantId}
              >
                <option value="merchant:M1">Sandton Retail (M1)</option>
                <option value="merchant:M2">V&A Waterfront Fuels (M2)</option>
                <option value="merchant:M3">Roxton Workshop (M3)</option>
                <option value="merchant:M4">Melrose Arch Kitchen (M4)</option>
              </select>
            </div>
          </div>

          {#if !showEditModal}
            <div class="bg-neutral-50 dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between mb-8">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all {isCapturing ? 'bg-indigo-500 animate-pulse' : 'bg-white'}">
                  <Fingerprint class="w-6 h-6 {isCapturing ? 'text-white' : 'text-neutral-400'}" />
                </div>
                <div>
                  <p class="font-black text-neutral-900 dark:text-neutral-100">Biometric Template</p>
                  <p class="text-[10px] font-black uppercase tracking-widest {isCapturing ? 'text-indigo-500' : 'text-neutral-400'}">
                    {isCapturing ? 'Capturing...' : 'Pending Capture'}
                  </p>
                </div>
              </div>
              <button
                onclick={simulateCapture}
                disabled={isCapturing}
                class="px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 disabled:opacity-50 transition-all dark:text-neutral-200"
              >
                {isCapturing ? 'Capturing...' : 'Capture Now'}
              </button>
            </div>
          {/if}

          <button
            onclick={showEditModal ? handleUpdateUser : handleCreateUser}
            disabled={loading}
            class="w-full py-5 bg-indigo-600 text-white rounded-[28px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {#if loading}
              <Loader2 class="w-5 h-5 animate-spin" />
            {/if}
            {loading ? (showEditModal ? 'Updating...' : 'Enrolling...') : (showEditModal ? 'Save Profile Changes' : 'Complete Enrollment')}
          </button>
        </div>
      </div>
    {/if}
  {/key}
</div>
