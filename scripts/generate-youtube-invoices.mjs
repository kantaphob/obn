// Local operations command: node --conditions=react-server scripts/generate-youtube-invoices.mjs
// Uses the same issuing service as the application. Does not confirm cash payments.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve(pathToFileURL(path.join(root, 'node_modules/next/dist/compiled/server-only/empty.js')).href, context);
    let target;
    if (specifier.startsWith('@/')) target = path.resolve(root, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith(pathToFileURL(root + path.sep).href) && !context.parentURL.includes('/node_modules/')) target = fileURLToPath(new URL(specifier, context.parentURL));
    if (target) {
      for (const candidate of [target, `${target}.ts`, `${target}.js`]) {
        if (existsSync(candidate) && /\.(ts|js|mjs)$/.test(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { generateYoutubeBillingDocuments } = await import('../lib/youtube-invoices.ts');
const { prisma } = await import('../lib/prisma.ts');
try {
  await generateYoutubeBillingDocuments();
  const [invoices, payables] = await Promise.all([
    prisma.youtubeInvoice.groupBy({ by: ['status'], _count: true, _sum: { amountSatang: true } }),
    prisma.youtubePayable.groupBy({ by: ['status'], where: { source: 'GROUP_PAYMENT' }, _count: true, _sum: { amountSatang: true } }),
  ]);
  console.log(JSON.stringify({ invoices, groupPayables: payables }, null, 2));
} finally { await prisma.$disconnect(); }
