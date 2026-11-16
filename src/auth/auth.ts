import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { Pool } from "pg";

let authInstance: any = null;
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
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Set it in .env before starting the app.`,
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

export const getBetterAuthInstance = () => {
  if (authInstance) return authInstance;

  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  authPool = pool;

  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:7373";
  const isSecure = baseURL.startsWith("https://");

  authInstance = betterAuth({
    baseURL,
    basePath: process.env.BETTER_AUTH_BASE_PATH || "/api/v1/auth",
    secret: requireEnv("BETTER_AUTH_SECRET"),
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
    },
    plugins: [bearer()],
  });

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
