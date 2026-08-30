import React from 'react';
import type { InterfaceLanguage } from '@arlo-doc/shared';
import i18n, { resolveLanguage } from './index';

/**
 * Reflects the chosen interface language onto i18next and the document root.
 *
 * The parallel to useTheme is deliberate: application settings decide this, it
 * has to apply on launch, and it must survive the settings dialog closing. A
 * `system` choice is resolved against the OS locale here rather than being
 * stored, so moving the OS to a new language is picked up on next launch
 * without the setting having to change.
 */
export function useInterfaceLanguage(setting: InterfaceLanguage | undefined): void {
  React.useEffect(() => {
    const lng = resolveLanguage(setting);
    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
    document.documentElement.lang = lng === 'zh-Hant' ? 'zh-Hant' : lng;
  }, [setting]);
}
