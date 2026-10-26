import type { CapacitorConfig } from '@capacitor/cli'

/** Android shell (npm run android). Ships the built web app from dist/; see README "Desktop and Android". */
const config: CapacitorConfig = {
  appId: 'com.jasonwong.muscleexplorer',
  appName: 'Muscle Explorer',
  webDir: 'dist',
  // Matches the app, so no white flash before it draws.
  backgroundColor: '#0f131a',
}

export default config
