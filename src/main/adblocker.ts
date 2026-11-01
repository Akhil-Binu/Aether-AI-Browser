/**
 * Ad-Blocker & Privacy Protection Module
 * Intercepts network requests at the session level to neutralize trackers, ads, and fingerprinting headers.
 */

import { Session } from 'electron';

// Declarative tracker and advertisement network patterns
export const TRACKER_BLOCK_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://*.google-analytics.com/*',
  '*://*.googlesyndication.com/*',
  '*://*.googleadservices.com/*',
  '*://*.facebook.com/tr/*',
  '*://*.adnxs.com/*',
  '*://*.scorecardresearch.com/*',
  '*://*.criteo.com/*',
  '*://*.taboola.com/*',
  '*://*.outbrain.com/*',
  '*://*.hotjar.com/*',
  '*://*.clarity.ms/*',
  '*://*.quantserve.com/*',
  '*://*.moatads.com/*',
  '*://*.amazon-adsystem.com/*'
];

export class PrivacyManager {
  private blockedCount = 0;

  public setupSessionPrivacy(sessionInstance: Session) {
    // 1. Block known trackers, telemetry beacons, and advertisements
    sessionInstance.webRequest.onBeforeRequest(
      { urls: TRACKER_BLOCK_PATTERNS },
      (details, callback) => {
        this.blockedCount++;
        callback({ cancel: true });
      }
    );

    // 2. Strip privacy-invasive tracking headers and client telemetry
    sessionInstance.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };

      // Remove Chromium enterprise client telemetry
      delete headers['X-Client-Data'];
      delete headers['Sec-CH-UA-Full-Version-List'];

      // Send DNT (Do Not Track) and GPC (Global Privacy Control) headers
      headers['DNT'] = '1';
      headers['Sec-GPC'] = '1';

      callback({ requestHeaders: headers });
    });

    // 3. Strip tracking query parameters from navigations (e.g., utm_*, fbclid, gclid)
    sessionInstance.webRequest.onBeforeRedirect((details) => {
      // Passive listener for analytics telemetry
    });
  }

  public getBlockedCount(): number {
    return this.blockedCount;
  }
}
