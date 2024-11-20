import { uuid4 } from '@sentry/utils';

import { initFCM } from '~/core/firebase/fcm';
import { initializeMessenger } from '~/core/messengers';
import { initializeSentry } from '~/core/sentry';
import { syncStores } from '~/core/state/internal/syncStores';
import { getRainbowChains } from '~/core/utils/rainbowChains';
import { updateWagmiConfig } from '~/core/wagmi';

import { handleDisconnect } from './handlers/handleDisconnect';
import { handleInstallExtension } from './handlers/handleInstallExtension';
import { handleKeepAlive } from './handlers/handleKeepAlive';
import { handlePrefetchDappMetadata } from './handlers/handlePrefetchMetadata';
import { handleProviderRequest } from './handlers/handleProviderRequest';
import { handleSetupInpage } from './handlers/handleSetupInpage';
import { handleTabAndWindowUpdates } from './handlers/handleTabAndWindowUpdates';
import { handleWallets } from './handlers/handleWallets';
require('../../core/utils/lockdown');

import { useUnifiedBalancesOnApps } from '~/core/utils/orb';

initializeSentry('background');

const popupMessenger = initializeMessenger({ connect: 'popup' });
const inpageMessenger = initializeMessenger({ connect: 'inpage' });

handleInstallExtension();
handleProviderRequest({ popupMessenger, inpageMessenger });
handleTabAndWindowUpdates();
handlePrefetchDappMetadata();
handleSetupInpage();
handleWallets();
handleDisconnect();
syncStores();
uuid4();
initFCM();
handleKeepAlive();

popupMessenger.reply('rainbow_updateWagmiClient', async () => {
  const { rainbowChains } = getRainbowChains();
  updateWagmiConfig(rainbowChains);
});

/* DATA INJECTION CODE BELOW */
let connectedApps: any;

useUnifiedBalancesOnApps(
  true,
  'assets/lite-weight-data-injection-script.js',
  (response) => {
    console.log('Current configs', response);
    connectedApps = response.connectedApps;
  },
);

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type && message.type === 'fetchConnectedApps') {
    sendResponse(Object.fromEntries(connectedApps));
  }
});
