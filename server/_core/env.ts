export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  appUrl: process.env.APP_URL ?? process.env.VITE_APP_URL ?? "",
};

/** Deployed origin, used when the app has to name itself inside an email. */
const FALLBACK_APP_URL = "https://closelooper.manus.space";

/**
 * Absolute public origin, no trailing slash.
 *
 * Links inside an email must be absolute — a relative href is dead once the
 * message leaves the app. `send()` previously interpolated an unset
 * `VITE_APP_URL` straight into the unsubscribe link and produced exactly that,
 * so this guards the value rather than trusting it: anything not starting with
 * http(s) falls back to the deployed origin and logs.
 */
export function getAppUrl(): string {
  const configured = ENV.appUrl.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  if (configured) {
    console.warn(`[env] APP_URL is not absolute ("${configured}"); falling back to ${FALLBACK_APP_URL}`);
  }
  return FALLBACK_APP_URL;
}
