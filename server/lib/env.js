/* global process */

export function getEnv(name) {
  return process.env[name] || "";
}

export function requireEnv(name) {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing ${name} in environment.`);
  return value;
}

export function requireAnyEnv(names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  throw new Error(`Missing environment variable (expected one of: ${names.join(", ")}).`);
}

export function getOptionalAnyEnv(names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return "";
}

