/**
 * Describes this app to @upande/mobile-kit. Imported once, first thing, by
 * app/_layout.tsx. Written by `npx upande-mobile-kit init`.
 *
 * `useAuth`, `api` and `storage` should be the app's OWN (init wires them when it
 * can find them): on the kit's stand-ins the Settings page looks fine, but
 * sign-out, the biometric switch and the device register are not connected to
 * the real session.
 */
import { configureMobileKit, getConfig, type KitTheme, type KitUi } from '@upande/mobile-kit';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { DARK, FONT_FAMILY, LIGHT, type Palette } from '@/constants/theme';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { showAppAlert } from '@/src/ui/alert';
import { useAuthStore } from './auth/authStore';
import { kitApi } from './kit/kitServer';

/**
 * Everything the kit draws (the connection banner, its Settings and Devices
 * pages, its dialogs) goes through this app's theme, as the Android dialogs
 * do: our palette, Poppins, and light or dark as the phone is set
 * (applyKitTheme, from the root layout).
 */
export function kitTheme(p: Palette): KitTheme {
  return {
    primary: p.primary,
    text: p.text,
    textSecondary: p.textMuted,
    textMuted: p.textSubtle,
    textOnPrimary: p.bg,
    surface: p.bg,
    surfaceAlt: p.bgMuted,
    background: p.bgSubtle,
    border: p.borderSubtle,
    danger: p.danger,
    success: p.success,
    warning: p.warning,
    fontRegular: FONT_FAMILY.regular,
    fontMedium: FONT_FAMILY.medium,
    fontSemiBold: FONT_FAMILY.semibold,
    fontBold: FONT_FAMILY.bold,
  };
}

/** The kit reads its theme as it draws, so switching it in place re-themes whatever it draws next. */
export function applyKitTheme(scheme: 'light' | 'dark'): void {
  Object.assign(getConfig().theme, kitTheme(scheme === 'dark' ? DARK : LIGHT));
}

type KitButtonProps = React.ComponentProps<NonNullable<KitUi['Button']>>;
type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/** The kit's buttons as ours (its "ghost" is our link). */
function KitButton({ label, onPress, variant, loading, disabled, iconLeft, style }: KitButtonProps) {
  const icon = iconLeft && iconLeft in MaterialCommunityIcons.glyphMap ? (iconLeft as Glyph) : undefined;
  return React.createElement(Button, {
    label,
    onPress,
    variant: variant === 'ghost' ? 'link' : variant ?? 'primary',
    loading,
    disabled,
    icon,
    style,
  });
}

const ui: KitUi = {
  // The kit's dialogs are our alert card (pill buttons), never the system dialog.
  showDialog: (title, message, buttons) => showAppAlert(title, message, buttons),
  useOnline: () => useNetworkStatus() !== false,
  Button: KitButton,
};

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
  theme: kitTheme(LIGHT),
  ui,
  // Through the app's own signed-in client, and never to Upande Mobile until the
  // site has it (src/kit/kitServer.ts): monitoring, support and push start off.
  api: kitApi,
  monitor: { enabled: false },
  support: false,
  push: false,
});
