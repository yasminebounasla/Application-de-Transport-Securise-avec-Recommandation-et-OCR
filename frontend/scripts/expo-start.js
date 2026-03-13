const path = require('path');
const { spawn } = require('child_process');

// Ensure EXPO_PUBLIC_* vars are loaded the same way Expo CLI does.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function hostnameFromUrl(value) {
  if (!value) return null;
  try {
    return new URL(value.trim()).hostname;
  } catch {
    return null;
  }
}

const host =
  hostnameFromUrl(process.env.EXPO_PUBLIC_API_URL_SANS_API) ||
  hostnameFromUrl(process.env.EXPO_PUBLIC_API_URL) ||
  null;

if (!host) {
  console.warn(
    '[expo-start] Could not derive host from EXPO_PUBLIC_API_URL(_SANS_API). Falling back to Expo defaults.'
  );
} else {
  // These env vars influence what URL Metro advertises to Expo Go.
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
  process.env.EXPO_PACKAGER_HOSTNAME = host;
  console.log(`[expo-start] Using packager host: ${host}`);
}

const expoCmd = process.platform === 'win32' ? 'expo.cmd' : 'expo';
const args = ['start', '-c', '--lan'];

const child = spawn(expoCmd, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));

