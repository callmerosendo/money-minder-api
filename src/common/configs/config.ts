import type { Config } from "./config.interface";

const DEFAULT_ORIGINS = [
  "http://localhost:4321",
  "http://localhost:4200",
  "http://127.0.0.1:4200",
  "http://localhost:3000",
  "https://money-minder-xi.vercel.app",
  "https://rosendo-garcia.vercel.app",
];

/**
 * Builds the config object lazily.
 *
 * ConfigModule runs every entry in `load` only after it has loaded the
 * environment file, so reading `process.env` inside this factory (rather
 * than at module import time) means local `.env` values for PORT /
 * CORS_ORIGINS are actually honored. On Render no `.env` exists, but the
 * platform injects PORT (default 10000) into the real process environment,
 * which is read the same way.
 */
const configure = (): Config => {
  const originsFromEnv = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : [];

  const frontendUrl = process.env.FRONTEND_URL;

  return {
    nest: {
      port: +(process.env.PORT || "7373"),
    },
    cors: {
      origins: Array.from(
        new Set([...DEFAULT_ORIGINS, ...(frontendUrl ? [frontendUrl] : []), ...originsFromEnv]),
      ),
    },
  };
};

export default configure;
