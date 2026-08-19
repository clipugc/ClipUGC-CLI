import chalk from 'chalk';
import type { Command } from 'commander';
import { createApiClient } from '../services/api.js';
import { getCredits, getCreditTransactions } from '../services/user.service.js';
import { logger } from '../utils/logger.js';
import { isJsonMode, printJson, printPagination, printTable } from '../utils/output.js';

/**
 * Human-readable labels for the per-action cost keys returned by GET /credits.
 * Unknown keys fall back to a humanized version of the raw key.
 */
const COST_LABELS: Record<string, string> = {
  image: 'image',
  clip: 'clip (5s)',
  clip_10s: 'clip (10s)',
  motion_per_second: 'motion control (per second)',
  scene_staged: 'scene-staged clip',
  merge: 'merge',
};

/** Preferred display order for known cost keys; unknown keys follow, sorted. */
const COST_ORDER = ['image', 'clip', 'clip_10s', 'scene_staged', 'motion_per_second', 'merge'];

function costLabel(action: string): string {
  return COST_LABELS[action] ?? action.replace(/_/g, ' ');
}

/** Order cost entries: known keys by COST_ORDER, then any unknown keys sorted. */
function orderedCosts(costs: Record<string, number | undefined>): Array<{ action: string; cost: number }> {
  const entries = Object.entries(costs).filter(
    (e): e is [string, number] => typeof e[1] === 'number',
  );
  return entries.sort(([a], [b]) => {
    const ia = COST_ORDER.indexOf(a);
    const ib = COST_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  }).map(([action, cost]) => ({ action, cost }));
}

/** "+3" for a top-up/refund, "-7" for a spend (server already signs the amount). */
function signedAmount(amount: number | undefined): string | undefined {
  if (typeof amount !== 'number') return undefined;
  return amount > 0 ? `+${amount}` : String(amount);
}

interface CreditPack {
  slug?: string;
  name?: string;
  credits?: number;
  checkout_url?: string;
  prices?: Array<{ amount?: number; currency?: string }>;
  [key: string]: unknown;
}

export function registerCreditsCommands(program: Command): void {
  const credits = program
    .command('credits')
    .description('Show your credit balance and the credit cost of each action')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      const api = await createApiClient();
      const info = await getCredits(api);

      if (isJsonMode(cmd)) {
        printJson(info);
        return;
      }

      logger.plain(`\n  Balance: ${chalk.bold(String(info.balance))} credits\n`);

      const rows = orderedCosts(info.costs ?? {});
      printTable(rows, [
        { header: 'action', value: (row) => costLabel(row.action) },
        { header: 'credits', value: (row) => row.cost },
      ]);
      logger.hint('See your ledger: clipugc credits history   ·   Buy more: clipugc credits packs');
    });

  credits
    .command('history')
    .description('Show your credit transaction history (spends, top-ups, refunds)')
    .option('--per-page <n>', 'Results per page (max 100)')
    .option('--page <n>', 'Page number')
    .action(async (opts: { perPage?: string; page?: string }, cmd: Command) => {
      const api = await createApiClient();
      const perPage = opts.perPage !== undefined ? Number.parseInt(opts.perPage, 10) : undefined;
      const page = opts.page !== undefined ? Number.parseInt(opts.page, 10) : undefined;
      const result = await getCreditTransactions(api, { perPage, page });

      if (isJsonMode(cmd)) {
        printJson(result);
        return;
      }

      printTable(result.transactions, [
        { header: 'Date', value: (t) => t.created_at },
        { header: 'Description', value: (t) => t.description ?? t.action ?? t.type },
        { header: 'Amount', value: (t) => signedAmount(t.amount) },
        { header: 'Balance', value: (t) => t.balance_after },
      ]);
      printPagination(result.pagination);
    });

  credits
    .command('packs')
    .description('List purchasable credit packs (buy on the web dashboard)')
    .action(async (_options: Record<string, never>, cmd: Command) => {
      const api = await createApiClient();
      const data = await api.get<{ packs?: CreditPack[] }>('/credits/packs');
      const packs = Array.isArray(data?.packs) ? data.packs : [];

      if (isJsonMode(cmd)) {
        printJson(packs);
        return;
      }

      if (packs.length === 0) {
        logger.info('No credit packs are available yet.');
        return;
      }

      printTable(packs, [
        { header: 'Credits', value: (p) => (p.credits !== undefined ? String(p.credits) : undefined) },
        { header: 'Name', value: (p) => p.name },
        {
          header: 'Price',
          value: (p) => {
            const price = p.prices?.[0];
            return price?.amount !== undefined
              ? `${(price.amount / 100).toFixed(2)} ${price.currency ?? ''}`.trim()
              : undefined;
          },
        },
        { header: 'Buy at', value: (p) => p.checkout_url },
      ]);
      logger.hint('Open the "Buy at" link in your browser to complete the purchase; then check `clipugc credits`.');
    });
}
