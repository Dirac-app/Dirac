/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at startup.
 * Fails fast with clear error messages if any required variable is missing.
 */

export interface EnvConfig {
  // Required server-side
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AZURE_CLIENT_ID: string;
  AZURE_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
  OPENROUTER_API_KEY: string;
  ADMIN_SECRET: string;
  TESTER_JWT_SECRET: string;
  
  // Optional
  AUTH_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_PUBLIC_MODE?: string;
}

/**
 * List of required environment variables with descriptions
 */
const REQUIRED_ENV_VARS: Array<{ key: keyof EnvConfig; description: string }> = [
  { key: 'NEXTAUTH_SECRET', description: 'Secret for NextAuth.js session encryption' },
  { key: 'NEXTAUTH_URL', description: 'Base URL for NextAuth (e.g., http://localhost:3000)' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key for admin operations' },
  { key: 'GOOGLE_CLIENT_ID', description: 'Google OAuth client ID for Gmail integration' },
  { key: 'GOOGLE_CLIENT_SECRET', description: 'Google OAuth client secret' },
  { key: 'AZURE_CLIENT_ID', description: 'Microsoft Azure client ID for Outlook integration' },
  { key: 'AZURE_CLIENT_SECRET', description: 'Microsoft Azure client secret' },
  { key: 'DISCORD_CLIENT_ID', description: 'Discord OAuth client ID' },
  { key: 'DISCORD_CLIENT_SECRET', description: 'Discord OAuth client secret' },
  { key: 'DISCORD_BOT_TOKEN', description: 'Discord bot token' },
  { key: 'OPENROUTER_API_KEY', description: 'OpenRouter API key for AI features' },
  { key: 'ADMIN_SECRET', description: 'Secret for admin authentication' },
  { key: 'TESTER_JWT_SECRET', description: 'JWT secret for tester authentication' },
];

/**
 * Validates all required environment variables
 * @throws Error with detailed message if any required variable is missing
 */
export function validateEnv(): void {
  const missing: Array<{ key: string; description: string }> = [];
  
  for (const { key, description } of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    
    if (!value || value.trim() === '') {
      missing.push({ key, description });
    }
  }
  
  if (missing.length > 0) {
    const errorLines = [
      '',
      '============================================================',
      'MISSING REQUIRED ENVIRONMENT VARIABLES',
      '============================================================',
      '',
      'The following required environment variables are not set:',
      '',
      ...missing.map(({ key, description }) => `  - ${key}`),
      '',
      'Descriptions:',
      ...missing.map(({ key, description }) => `  - ${key}: ${description}`),
      '',
      'Please add these variables to your .env.local file or environment.',
      'See .env.local.example for a template.',
      '============================================================',
      '',
    ];
    
    throw new Error(errorLines.join('\n'));
  }
}

/**
 * Gets a required environment variable or throws if missing
 */
export function getRequiredEnv(key: keyof EnvConfig): string {
  const value = process.env[key];
  
  if (!value || value.trim() === '') {
    throw new Error(
      `Required environment variable ${key} is not set. ` +
      `Please add ${key} to your .env.local file.`
    );
  }
  
  return value;
}

/**
 * Gets an optional environment variable, returns undefined if not set
 */
export function getOptionalEnv(key: keyof EnvConfig): string | undefined {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : undefined;
}

/**
 * Gets an optional public environment variable for client-side
 */
export function getPublicEnv(key: keyof EnvConfig): string | undefined {
  // Only allow NEXT_PUBLIC_ prefixed keys
  if (!key.startsWith('NEXT_PUBLIC_')) {
    return undefined;
  }
  return getOptionalEnv(key);
}

/**
 * Validates environment and returns a summary object
 */
export function getEnvSummary(): { valid: boolean; missing: string[]; count: number } {
  const missing: string[] = [];
  
  for (const { key } of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    count: REQUIRED_ENV_VARS.length,
  };
}

// Run validation on import in development
// This provides early feedback during development
if (process.env.NODE_ENV === 'development') {
  try {
    validateEnv();
  } catch (error) {
    // Log but don't crash during development - allow the app to start
    // so developers can see the error in the browser console
    console.warn('Environment validation warning:', (error as Error).message);
  }
}
