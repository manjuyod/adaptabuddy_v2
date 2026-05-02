import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return;

  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(filePath);
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length) : line;
    const eqIndex = normalizedLine.indexOf("=");
    if (eqIndex === -1) continue;

    const key = normalizedLine.slice(0, eqIndex).trim();
    if (!key) continue;
    const existing = process.env[key];
    if (existing !== undefined && existing !== "" && existing !== "null" && existing !== "undefined") {
      continue;
    }

    let value = normalizedLine.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadRepoRootEnv() {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(thisDir, "../..");

  loadEnvFileIfExists(path.join(repoRoot, ".env.local"));
  loadEnvFileIfExists(path.join(repoRoot, ".env"));
}

loadRepoRootEnv();

const buildRequiredEnvKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

const normalizeEnvValue = (value) => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }

  return trimmed;
};

const validateBuildEnv = () => {
  const shouldValidate =
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_PHASE === "phase-production-build";
  if (!shouldValidate) return;

  const missing = buildRequiredEnvKeys.filter((key) => !normalizeEnvValue(process.env[key]));
  if (missing.length > 0) {
    throw new Error(
      [
        "[next.config] Missing required environment variables for production build:",
        missing.map((key) => `- ${key}`).join("\n"),
        "Add values in repo-root .env or .env.local before running `next build`."
      ].join("\n")
    );
  }

  const serverUrl = normalizeEnvValue(process.env.SUPABASE_URL);
  const clientUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serverAnon = normalizeEnvValue(process.env.SUPABASE_ANON_KEY);
  const clientAnon = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (serverUrl && clientUrl && serverUrl !== clientUrl) {
    throw new Error(
      "[next.config] SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must match for production builds."
    );
  }

  if (serverAnon && clientAnon && serverAnon !== clientAnon) {
    throw new Error(
      "[next.config] SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY must match for production builds."
    );
  }
};

validateBuildEnv();

const baseCspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co",
  "font-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'"
];

const devCspDirectives = [
  ...baseCspDirectives.filter((directive) => !directive.startsWith("script-src ")),
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      process.env.NODE_ENV === "development"
        ? devCspDirectives.join("; ")
        : baseCspDirectives.join("; ")
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typedRoutes: true,
  transpilePackages: ["@adaptabuddy/contracts", "@adaptabuddy/core"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
