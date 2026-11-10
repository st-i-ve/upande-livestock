/**
 * Describes this app to @upande/mobile-kit. Imported once, first thing, by
 * app/_layout.tsx. Written by `npx upande-mobile-kit init`.
 *
 * `useAuth`, `api` and `storage` should be the app's OWN (init wires them when it
 * can find them): on the kit's stand-ins the Settings page looks fine, but
 * sign-out, the biometric switch and the device register are not connected to
 * the real session.
 */
import { configureMobileKit } from '@upande/mobile-kit';
import { useAuthStore } from './auth/authStore';

configureMobileKit({
  appName: 'Upande Livestock', // the "Mobile App" record on the server
  githubRepo: 'st-i-ve/upande-livestock', // owner/repo that publishes the GitHub Releases (APKs)
  site: 'https://mutara.fsn.frappe.cloud',
  // Add a local one with  site: { production: 'https://your.site', development: 'http://localhost:8000' }
  // apk: { autoDownload: 'wifi' }, // 'wifi' (default) | 'always' | 'never'
  // fab: true, // the floating Settings button: true (default) | false | 'dev' | { initialSide: 'left', bottom: 96 }
  //
  // Crash & API monitoring is ON by default. The person can turn it off in Settings. Defaults shown:
  // monitor: {
  //   enabled: true,            // false installs nothing
  //   captureConsoleErrors: true, // console.error(err) calls that carry an Error
  //   captureBodies: true,      // request/response bodies of FAILED calls (secrets redacted, capped)
  //   maxBodyBytes: 8192,
  //   redactKeys: [],           // extra key names to hide, on top of password/token/authorization/cookie/...
  //   ignoreUrls: [],           // strings or RegExps never recorded
  //   sampleSuccess: 0,         // 0-1: share of successful calls recorded (metadata only)
  //   breadcrumbs: 30,
  //   consoleBreadcrumbs: false,
  //   errorBoundary: false,     // true wraps the app in <MonitorErrorBoundary>
  //   showToggle: true,         // the "Send crash reports" row in Settings
  // },
  //
  // Wired to this app's own modules (found by `npx upande-mobile-kit init`):
  useAuth: () => {
    const roles = useAuthStore((s) => s.roles);
    const fullName = useAuthStore((s) => s.fullname);
    const email = useAuthStore((s) => s.email);
    const instanceUrl = useAuthStore((s) => s.instanceUrl);
    const logout = useAuthStore((s) => s.logout);
    return {
      isSystemManager: (roles ?? []).includes('System Manager'),
      roles: roles ?? undefined,
      fullName,
      email,
      instanceUrl,
      user: email ?? null,
      biometricEnabled: false, // your auth state has no biometric flag, so the kit's switch cannot persist (use biometric: 'host' if your app owns the lock),
      setBiometricEnabled: async () => {},
      logout: async () => {
        await logout();
      },
    };
  },
  //
  // Still on the kit's stand-ins (uncomment to wire them):
  // storage,    // { get, set, remove }; default AsyncStorage, else memory
  // theme: { primary: '#...' },
});
