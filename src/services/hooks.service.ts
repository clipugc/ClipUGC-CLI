import type { ApiClient } from './api.js';

/**
 * POST /character-videos/hook-suggestions — AI-generated hook text ideas.
 * Returns both the parsed hooks list and the raw payload (for --json mode).
 */
export async function suggestHooks(
  api: ApiClient,
  context?: string,
): Promise<{ hooks: string[]; raw: unknown }> {
  const body: Record<string, unknown> = {};
  if (context !== undefined && context.trim() !== '') {
    body.context = context;
  }

  const raw = await api.post<unknown>('/character-videos/hook-suggestions', { body });

  let hooks: string[] = [];
  if (Array.isArray(raw)) {
    hooks = raw.filter((h): h is string => typeof h === 'string');
  } else if (raw && typeof raw === 'object') {
    const candidate = (raw as Record<string, unknown>).hooks;
    if (Array.isArray(candidate)) {
      hooks = candidate.filter((h): h is string => typeof h === 'string');
    }
  }
  return { hooks, raw };
}
