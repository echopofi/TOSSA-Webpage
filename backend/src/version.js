const path = require('path');
const { execSync } = require('child_process');

const COMMIT_ENV_VARS = [
  'VERCEL_GIT_COMMIT_SHA',
  'RENDER_GIT_COMMIT',
  'COMMIT_REF',
  'SOURCE_VERSION',
  'GIT_COMMIT',
  'SOURCE_COMMIT',
  'GITHUB_SHA',
  'RAILWAY_GIT_COMMIT_SHA',
  'CF_PAGES_COMMIT_SHA',
];

function loadCommit() {
  // 1. Host-provided commit refs (Vercel, Render, Netlify, Heroku, CI, …).
  for (const key of COMMIT_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      const sha = value.trim();
      if (sha) return { sha, source: `env:${key}` };
    }
  }

  // 2. Fall back to the actual git checkout present at boot.
  try {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const output = execSync('git rev-parse HEAD', {
      cwd: repoRoot,
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const sha = output.toString().trim();
    if (sha) return { sha, source: 'git' };
  } catch (err) {
    // no git available in the deployed environment — report as unavailable
  }

  return { sha: null, source: 'unavailable' };
}

const { sha, source } = loadCommit();

module.exports = {
  name: 'alumni-backend',
  commit: sha,
  short: sha ? sha.slice(0, 7) : null,
  source,
  deployedAt: new Date().toISOString(),
};