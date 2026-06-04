/** NextAuth / Auth.js session secret (not TESTER_JWT_SECRET). */
export function getAuthSecret(): string | undefined {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  return secret && secret.trim() !== "" ? secret : undefined;
}
