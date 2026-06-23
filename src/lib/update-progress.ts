import manifest from './progress-manifest.json';
import fs from 'fs';
import path from 'path';

type Status = 'pending' | 'in_progress' | 'completed' | 'skipped';

interface FileEntry {
  path: string;
  from: string;
  status: Status;
}

interface Phase {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  files: FileEntry[];
}

interface Manifest {
  phases: Phase[];
}

const manifestPath = path.resolve(__dirname, 'progress-manifest.json');

export function markFile(filePath: string, status: Status) {
  const data: Manifest = structuredClone(manifest);
  for (const phase of data.phases) {
    for (const file of phase.files) {
      if (file.path === filePath || file.from === filePath || file.path.endsWith(filePath)) {
        file.status = status;
        fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
        updatePhaseStatuses(data);
        return true;
      }
    }
  }
  return false;
}

export function markPhase(phaseId: string, status: 'pending' | 'in_progress' | 'completed') {
  const data: Manifest = structuredClone(manifest);
  const phase = data.phases.find(p => p.id === phaseId);
  if (phase) {
    phase.status = status;
    if (status === 'in_progress') {
      // Mark all files in phase as in_progress too
      for (const file of phase.files) {
        if (file.status === 'pending') file.status = 'in_progress';
      }
    }
    if (status === 'completed') {
      for (const file of phase.files) {
        file.status = 'completed';
      }
    }
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
  }
}

function updatePhaseStatuses(data: Manifest) {
  for (const phase of data.phases) {
    const allDone = phase.files.every(f => f.status === 'completed');
    const anyDone = phase.files.some(f => f.status === 'completed' || f.status === 'in_progress');
    if (allDone) phase.status = 'completed';
    else if (anyDone) phase.status = 'in_progress';
    else phase.status = 'pending';
  }
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
}

export function getStats() {
  const data: Manifest = structuredClone(manifest);
  let total = 0, done = 0;
  for (const phase of data.phases) {
    for (const file of phase.files) {
      total++;
      if (file.status === 'completed') done++;
    }
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
