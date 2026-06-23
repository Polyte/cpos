<script lang="ts">
  import { Shield, X, Loader2, Eye, EyeOff } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';

  /**
   * SupervisorOverrideModal Component
   *
   * Prompts for supervisor authorization for sensitive cashier operations.
   * Validates against actual user data in the system.
   *
   * DEFAULT SUPERVISOR PINs (for seeded users):
   * - Admin role: 9999
   * - Manager role: 1111
   * - Supervisor role: 2222
   *
   * To authorize, enter:
   * - Supervisor ID: Use their email (e.g., retail.supervisor@roxton.com)
   * - PIN: Use the role-based PIN above (e.g., 2222 for Supervisors)
   *
   * The system will:
   * 1. Verify the user exists
   * 2. Confirm they have Admin/Manager/Supervisor role
   * 3. Validate the PIN matches their stored PIN
   * 4. Log the override to the forensic audit trail
   */

  let {
    action,
    actionDescription,
    onApprove,
    onReject
  }: {
    action: string;
    actionDescription: string;
    onApprove: (supervisorId: string, supervisorName: string) => void | Promise<void>;
    onReject: () => void;
  } = $props();

  let supervisorId = $state('');
  let supervisorPin = $state('');
  let loading = $state(false);
  let showPin = $state(false);

  async function handleAuthorize() {
    if (!supervisorId.trim()) {
      toast.error('Supervisor ID required');
      return;
    }
    if (!supervisorPin.trim()) {
      toast.error('Supervisor PIN required');
      return;
    }

    loading = true;
    try {
      const result = await api.verifySupervisorPin(supervisorId, supervisorPin);

      if (result.success && result.supervisor) {
        toast.success('Supervisor Authorization Granted', {
          description: `Authorized by ${result.supervisor.name} (${result.supervisor.role})`
        });

        await onApprove(result.supervisor.id, result.supervisor.name);
      } else {
        toast.error('Authorization Failed', {
          description: result.error || 'Invalid supervisor credentials'
        });
      }
    } catch (e: any) {
      toast.error('Authorization Error', {
        description: e?.message || 'Failed to verify supervisor credentials'
      });
    } finally {
      loading = false;
    }
  }
</script>

{#key loading}
  <div class="fixed inset-0 z-[600] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 font-mono" style="font-family: 'JetBrains Mono', monospace" in:fly={{ opacity: 0, y: 20 }} out:fade>
    <div class="bg-gradient-to-br from-neutral-900 to-black border-2 border-amber-500/40 rounded-[40px] shadow-2xl max-w-md w-full p-8 relative overflow-hidden shadow-amber-500/10">
      <!-- Background glow -->
      <div class="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-rose-500/10 pointer-events-none"></div>

      <!-- Close button -->
      <button
        onclick={onReject}
        disabled={loading}
        class="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
      >
        <X class="w-5 h-5 text-white" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-4 mb-6 relative">
        <div class="p-4 bg-gradient-to-br from-amber-500 to-rose-500 rounded-2xl shadow-lg">
          <Shield class="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 class="text-xl font-black text-white">Supervisor Authorization Required</h3>
          <p class="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-1">
            Security Override â€¢ {action}
          </p>
        </div>
      </div>

      <!-- Action Description -->
      <div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 relative">
        <p class="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">
          Action Requested
        </p>
        <p class="text-sm font-bold text-white">{actionDescription}</p>
      </div>

      <!-- Warning -->
      <div class="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-6">
        <p class="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-1">
          âš ï¸ Security Alert
        </p>
        <p class="text-xs font-medium text-neutral-300">
          This action requires supervisor approval. All overrides are logged to the forensic audit trail.
        </p>
      </div>

      <!-- Supervisor ID Input -->
      <div class="mb-4">
        <label for="supervisor-id" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">
          Supervisor ID / Email
        </label>
        <input
          type="text"
          id="supervisor-id"
          bind:value={supervisorId}
          placeholder="e.g., retail.supervisor@roxton.com"
          disabled={loading}
          class="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
        />
        <p class="text-[8px] text-neutral-500 mt-1 font-medium">
          Enter email or user ID of supervisor/manager/admin
        </p>
      </div>

      <!-- Supervisor PIN Input -->
      <div class="mb-6">
        <label for="supervisor-pin" class="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">
          Supervisor PIN
        </label>
        <div class="relative">
          <input
            type={showPin ? 'text' : 'password'}
            id="supervisor-pin"
            bind:value={supervisorPin}
            placeholder="4-6 digit PIN"
            disabled={loading}
            maxlength={6}
            class="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-lg tracking-widest outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all disabled:opacity-50 pr-12"
            onkeydown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleAuthorize();
              }
            }}
          />
          <button
            type="button"
            onclick={() => showPin = !showPin}
            class="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            {#if showPin}
              <EyeOff class="w-4 h-4 text-neutral-400" />
            {:else}
              <Eye class="w-4 h-4 text-neutral-400" />
            {/if}
          </button>
        </div>
        <p class="text-[8px] text-neutral-500 mt-1 font-medium">
          Default PINs: Admin=9999, Manager=1111, Supervisor=2222
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button
          onclick={onReject}
          disabled={loading}
          class="flex-1 py-4 px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onclick={handleAuthorize}
          disabled={loading || !supervisorId.trim() || !supervisorPin.trim()}
          class="flex-1 py-4 px-6 bg-gradient-to-br from-amber-500 to-rose-500 hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] border border-amber-500/30 rounded-2xl text-white font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2"
        >
          {#if loading}
            <Loader2 class="w-4 h-4 animate-spin" />
            Verifying...
          {:else}
            <Shield class="w-4 h-4" />
            Authorize
          {/if}
        </button>
      </div>

      <!-- Forensic Notice -->
      <div class="mt-6 pt-6 border-t border-white/10">
        <p class="text-[8px] font-bold text-neutral-500 uppercase tracking-widest text-center">
          ðŸ”’ Supervisor Override Logged â€¢ Forensic Audit Trail Active
        </p>
      </div>
    </div>
  </div>
{/key}
