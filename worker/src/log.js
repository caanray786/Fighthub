// Collects log lines so the whole run can be stored in public.ai_runs.

const lines = [];

export function log(...parts) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${parts.join(' ')}`;
  lines.push(line);
  console.log(line);
}

export function fullLog() {
  return lines.join('\n');
}
