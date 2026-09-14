import path from "node:path";
import { execSync } from "node:child_process";

const COMMIT_ENV_VARS = [
  "VERCEL_GIT_COMMIT_SHA",
  "RENDER_GIT_COMMIT",
  "COMMIT_REF",
  "SOURCE_VERSION",
  "GIT_COMMIT",
  "SOURCE_COMMIT",
  "GITHUB_SHA",
  "RAILWAY_GIT_COMMIT_SHA",
  "CF_PAGES_COMMIT_SHA",
];

function loadCommit(): { sha: string | null; source: string } {
  // 1. Host-provided commit refs (Vercel, Render, Netlify, Heroku, CI, …).
  for (const key of COMMIT_ENV_VARS) {
    const value = process.env[key]?.trim();
    if (value) return { sha: value, source: `env:${key}` };
  }

  // 2. Fall back to the actual git checkout present at runtime.
  const candidates = [process.cwd(), path.resolve(process.cwd(), "..")];
  for (const cwd of candidates) {
    try {
      const output = execSync("git rev-parse HEAD", {
        cwd,
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const sha = output.toString().trim();
      if (sha) return { sha, source: "git" };
    } catch (err) {
      // no git available in the deployed environment — try next candidate
    }
  }

  return { sha: null, source: "unavailable" };
}

const { sha, source } = loadCommit();

export function GET() {
  return Response.json({
    name: "alumni-frontend",
    commit: sha,
    short: sha ? sha.slice(0, 7) : null,
    source,
    deployedAt: new Date().toISOString(),
  });
}