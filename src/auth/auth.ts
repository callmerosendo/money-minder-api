import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { Pool } from "pg";

/**
 * Inferred from the factory so every `auth.api.*` call site keeps full type
 * information instead of degrading to `any`.
 */
type AuthInstance = ReturnType<typeof createBetterAuth>;

let authInstance: AuthInstance | null = null;
let authPool: Pool | null = null;

/**
 * Origins allowed to start and complete the OAuth flow.
 *
 * The SPA runs on a different origin than the API, so every origin the app is
 * served from must be listed here. Otherwise Better Auth rejects the callback
 * URL with `INVALID_CALLBACK_URL`.
 *
 * Built lazily on first use so `FRONTEND_URL` from `.env` is visible (the env
 * file is loaded by ConfigModule after module imports run).
 */
const buildTrustedOrigins = (): string[] => [
  "http://localhost:4200",
  "http://127.0.0.1:4200",
  "https://money-minder-xi.vercel.app",
  "https://rosendo-garcia.vercel.app",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

/**
 * Fails fast when a required environment variable is missing instead of
 * silently falling back to an insecure default. Read lazily (on first use)
 * rather than at module load so ConfigModule has already loaded `.env`.
 *
 * `minLength` enforces Better Auth's requirements (e.g. the secret must be at
 * least 32 characters) so a weak value is caught at boot, not in production.
 */
const requireEnv = (name: string, minLength = 1): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Set it in .env before starting the app.`,
    );
  }
  if (value.length < minLength) {
    throw new Error(
      `Environment variable "${name}" must be at least ${minLength} characters (got ${value.length}).`,
    );
  }
  return value;
};

/**
 * Builds the Better Auth `socialProviders` map from the environment.
 * A provider is registered only when both its id and secret are set; setting
 * only one of them is a misconfiguration and throws instead of silently
 * registering broken credentials.
 */
const buildSocialProviders = (): Record<string, { clientId: string; clientSecret: string }> => {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};

  for (const name of ["GOOGLE", "GITHUB"] as const) {
    const clientId = process.env[`${name}_CLIENT_ID`];
    const clientSecret = process.env[`${name}_CLIENT_SECRET`];

    if (!clientId && !clientSecret) continue; // Provider disabled.

    if (!clientId || !clientSecret) {
      throw new Error(
        `Both ${name}_CLIENT_ID and ${name}_CLIENT_SECRET must be set to enable ${name.toLowerCase()} sign-in.`,
      );
    }

    providers[name.toLowerCase()] = { clientId, clientSecret };
  }

  return providers;
};

const createBetterAuth = () => {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  authPool = pool;

  // In production a missing BETTER_AUTH_URL would silently point OAuth
  // callbacks at localhost, so fail fast there. Dev keeps the local fallback.
  const baseURL =
    process.env.NODE_ENV === "production"
      ? requireEnv("BETTER_AUTH_URL")
      : process.env.BETTER_AUTH_URL || "http://localhost:7373";
  const isSecure = baseURL.startsWith("https://");

  return betterAuth({
    baseURL,
    basePath: process.env.BETTER_AUTH_BASE_PATH || "/api/v1/auth",
    secret: requireEnv("BETTER_AUTH_SECRET", 32),
    database: pool,
    trustedOrigins: buildTrustedOrigins(),
    // Better Auth's tables live in the `neon_auth` schema (managed by Neon),
    // while the application tables live in `public`. Kysely understands
    // schema-qualified table names, so the adapter can target them directly.
    user: { modelName: "neon_auth.user" },
    session: { modelName: "neon_auth.session" },
    account: { modelName: "neon_auth.account" },
    verification: { modelName: "neon_auth.verification" },
    socialProviders: buildSocialProviders(),
    advanced: {
      database: {
        validateSchema: false,
        // The Neon-managed `neon_auth` tables use `uuid` primary keys, while
        // Better Auth defaults to 32-char random strings. Generate UUIDs so
        // inserts satisfy the column type.
        generateId: "uuid",
      },
      useSecureCookies: isSecure,
      // The SPA and the API are cross-site in production, so the session
      // cookie must be sent with SameSite=None; Secure.
      ...(isSecure ? { defaultCookieAttributes: { sameSite: "none" as const, secure: true } } : {}),
      ipAddress: {
        // Render proxies through Cloudflare, which overwrites these headers
        // with the real client IP — they cannot be spoofed by the client.
        // X-Forwarded-For is only a last-resort fallback: Render appends to
        // it without stripping client-supplied values, and Better Auth trusts
        // it only when it carries a single entry. Without this, production
        // requests collapse into one shared rate-limit bucket per path.
        ipAddressHeaders: ["cf-connecting-ip", "true-client-ip", "x-forwarded-for"],
      },
    },
    plugins: [bearer()],
  });
};

export const getBetterAuthInstance = () => {
  if (authInstance) return authInstance;

  authInstance = createBetterAuth();

  return authInstance;
};

/**
 * Releases the Better Auth connection pool so tests and scripts can exit
 * without dangling database handles.
 */
export const closeBetterAuthInstance = async () => {
  if (authPool) {
    await authPool.end();
    authPool = null;
  }
  authInstance = null;
};
