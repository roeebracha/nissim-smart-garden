// CORS for the Vite dashboard (decision 24). The allowed browser origin
// comes from FRONTEND_ORIGIN (12-factor). When the variable is unset the
// API does not open a wildcard — local Compose sets the Vite origin.
export function resolveCorsOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const origin = env.FRONTEND_ORIGIN?.trim();
  if (!origin) {
    return undefined;
  }
  return origin;
}
