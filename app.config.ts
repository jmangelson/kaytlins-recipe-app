import { existsSync, readFileSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// google-services.json is downloaded from the Firebase console and kept out of
// git (see README). Cloud builds get it from the secret EAS file variable
// GOOGLE_SERVICES_JSON (its path on the build server). Google Sign-In needs
// its web OAuth client id (type 3).
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

type GoogleServices = {
  client: { oauth_client: { client_id: string; client_type: number }[] }[];
};

function readGoogleWebClientId(): string | undefined {
  if (!existsSync(GOOGLE_SERVICES_FILE)) return undefined;
  const services = JSON.parse(readFileSync(GOOGLE_SERVICES_FILE, 'utf8')) as GoogleServices;
  return services.client
    .flatMap((client) => client.oauth_client)
    .find((oauth) => oauth.client_type === 3)?.client_id;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Kaytlin's Recipes",
  slug: config.slug ?? 'kaytlins-recipe-app',
  android: {
    ...config.android,
    googleServicesFile: GOOGLE_SERVICES_FILE,
  },
  extra: {
    ...config.extra,
    googleWebClientId: readGoogleWebClientId(),
    // Photo scan Worker (worker/); SCAN_URL overrides it for local testing.
    scanUrl: process.env.SCAN_URL ?? 'https://kaytlins-recipe-scan.joshuagm55.workers.dev',
  },
});
