const { PrismaClient } = require('@prisma/client');

// The provider limits sessions to 15 (session-pool mode). Prisma's default pool
// size is derived from CPU count and can exceed that on multi-core hosts, which
// starves every other short-lived connection (migrate deploy, tooling, restarts).
// Enforce an explicit, safe cap + a wait timeout unless the DATABASE_URL already
// carries its own values. The cap is kept well under 15 so a brief extra
// connection can never exhaust the pool.
function withPoolParams(url) {
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) return url;
  const hasParam = (name) => new RegExp(`[?&]${name}=`).test(url);
  if (hasParam('connection_limit') && hasParam('pool_timeout')) return url;
  const sep = url.includes('?') ? '&' : '?';
  const params = [];
  if (!hasParam('connection_limit')) params.push('connection_limit=5');
  // pool_timeout is in milliseconds — wait up to 20s for a free connection.
  if (!hasParam('pool_timeout')) params.push('pool_timeout=20000');
  return `${url}${sep}${params.join('&')}`;
}

const datasourceUrl = withPoolParams(process.env.DATABASE_URL);

const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;