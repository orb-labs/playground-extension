import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { isEqual, update } from 'lodash';
import { useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import { flushQueuedEvents } from '~/analytics/flushQueuedEvents';
// !!!! DO NOT REMOVE THE NEXT 2 LINES BELOW !!!!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import config from '~/core/firebase/remoteConfig';
import { initializeMessenger } from '~/core/messengers';
import { persistOptions, queryClient } from '~/core/react-query';
import { initializeSentry, setSentryUser } from '~/core/sentry';
import {
  useCurrentAddressStore,
  useCurrentLanguageStore,
  useDeviceIdStore,
} from '~/core/state';
import { useCurrentThemeStore } from '~/core/state/currentSettings/currentTheme';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { WagmiConfigUpdater, wagmiConfig } from '~/core/wagmi';
import { Box, ThemeProvider } from '~/design-system';

import { Routes } from './Routes';
import { HWRequestListener } from './components/HWRequestListener/HWRequestListener';
import { IdleTimer } from './components/IdleTimer/IdleTimer';
import { OnboardingKeepAlive } from './components/OnboardingKeepAlive';
import { AuthProvider } from './hooks/useAuth';
import { useExpiryListener } from './hooks/useExpiryListener';
import { useIsFullScreen } from './hooks/useIsFullScreen';
import usePrevious from './hooks/usePrevious';
import { useRainbowChains } from './hooks/useRainbowChains';

import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';

import {
  updateVirtualNodeRpcUrl,
  updateConnectedAppStatus,
  useCreateClusterId,
  useVirtualNodeRpcUrl,
} from '~/core/utils/orb';

const backgroundMessenger = initializeMessenger({ connect: 'background' });

export function App() {
  const { currentLanguage, setCurrentLanguage } = useCurrentLanguageStore();
  const { deviceId } = useDeviceIdStore();
  const { rainbowChains } = useRainbowChains();
  const prevChains = usePrevious(rainbowChains);
  const { currentAddress } = useCurrentAddressStore();
  const { testnetMode } = useTestnetModeStore();
  const clusterId = useCreateClusterId(currentAddress);
  const virtualNodeRpcUrl = useVirtualNodeRpcUrl(
    clusterId,
    currentAddress,
    testnetMode,
  );

  useExpiryListener();

  useEffect(() => {
    if (!isEqual(prevChains, rainbowChains)) {
      backgroundMessenger.send('rainbow_updateWagmiClient', {
        rpcProxyEnabled: config.rpc_proxy_enabled,
      });
    }
  }, [prevChains, rainbowChains]);

  useEffect(() => {
    if (!isEqual(prevChains, rainbowChains)) {
      backgroundMessenger.send('rainbow_updateWagmiClient', {
        rpcProxyEnabled: config.rpc_proxy_enabled,
      });
    }
  }, [prevChains, rainbowChains]);

  useEffect(() => {
    // Disable analytics & sentry for e2e and dev mode
    if (process.env.IS_TESTING !== 'true' && process.env.IS_DEV !== 'true') {
      initializeSentry('popup');
      setSentryUser(deviceId);
      analytics.setDeviceId(deviceId);
      analytics.identify();
      analytics.track(event.popupOpened);
      setTimeout(() => flushQueuedEvents(), 1000);
    }
    // Init trezor once globally
    window.TrezorConnect?.init({
      manifest: {
        email: 'support@rainbow.me',
        appUrl: 'https://rainbow.me',
      },
      lazyLoad: true,
    });

    // if (process.env.IS_DEV !== 'true') {
    //   document.addEventListener('contextmenu', (e) => e.preventDefault());
    // }

    // prevent trackpad double tap zoom
    const app = document.getElementById('app');
    app?.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentLanguage(currentLanguage);
  }, [currentLanguage, setCurrentLanguage]);

  const { currentTheme } = useCurrentThemeStore();
  const isFullScreen = useIsFullScreen();

  /* INJECTOR CODE HERE */
  const ORBY_PUBLIC_API_BASE_URL = 'https://api-rpc-dev.orblabs.xyz'; // "http://localhost:4001";
  const [apiKey, setApiKey] = useState('4ff141e9-98c5-43ee-8b0e-d552f831b68e');
  const [connectedApps, setConnectedApps] = useState(new Map());
  const [currentTabUrl, setCurrentTabUrl] = useState('');

  // Function to load the button state from chrome.storage.local
  const loadPageState = async () => {
    chrome.storage.local.get('orbyVirtualNodeRpcUrl', (result) => {
      setVirtualNodeRpcUrl(result.orbyVirtualNodeRpcUrl || '');
    });

    fetchConnectedApps().then((response) => {
      setConnectedApps(new Map(Object.entries(response || {})));
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          setCurrentTabUrl(new URL(tabs[0].url).hostname);
        }
      });
    });
  };

  // Function that sends data injection request to background service worker to be processed
  const fetchConnectedApps = function () {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'fetchConnectedApps',
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        },
      );
    });
  };

  // Load the button state when the component mounts
  useEffect(() => {
    loadPageState();
  }, []);

  useEffect(() => {
    if (virtualNodeRpcUrl) {
      updateVirtualNodeRpcUrl(virtualNodeRpcUrl);
    }
  }, [virtualNodeRpcUrl]);

  // const handleConnect = async () => {
  //   const response = await fetch(`${ORBY_PUBLIC_API_BASE_URL}/${apiKey}`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       id: 2,
  //       jsonrpc: '2.0',
  //       method: 'orby_getVirtualNodeRpcUrl',
  //       params: [
  //         {
  //           accountClusterId: clusterId,
  //           entrypointAccountAddress: currentAddress,
  //           chainId: 'EIP155-1',
  //         },
  //       ],
  //     }),
  //   });

  //   const data = await response.json();
  //   updateVirtualNodeRpcUrl(data.result.virtualNodeRpcUrl);
  //   setVirtualNodeRpcUrl(data.result.virtualNodeRpcUrl);
  // };

  const handleDisconnect = async () => {
    [...connectedApps].map(([key, value]) =>
      updateConnectedAppStatus(key, false),
    );
    fetchConnectedApps().then((response) => {
      setConnectedApps(new Map(Object.entries(response || {})));
    });
    updateVirtualNodeRpcUrl('');
    setVirtualNodeRpcUrl('');
  };

  const handleAppConnectionStatusUpdate = async (
    appDomain: string,
    isConnected: boolean,
  ) => {
    updateConnectedAppStatus(appDomain, isConnected);
    fetchConnectedApps().then((response) => {
      setConnectedApps(new Map(Object.entries(response || {})));
    });
  };

  function isConnectedAppEmptyExcludingCurrentDomain() {
    const filteredEntries = Array.from(connectedApps).filter(
      ([key]) => key !== currentTabUrl,
    );
    return filteredEntries.length === 0;
  }

  console.log('connectedApps', connectedApps);
  console.log('currentTabUrl', currentTabUrl);

  /* TODO: something like this...

  useEffect(() => {
    handleAppConnectionStatusUpdate(currentTabUrl, isConnected);
  }, [isConnected, currentTabUrl]);

  */

  return (
    <>
      <WagmiProvider config={wagmiConfig}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={currentTheme}>
              <AuthProvider>
                <Box
                  id="main"
                  background="surfacePrimaryElevated"
                  style={{
                    maxWidth: !isFullScreen
                      ? `${POPUP_DIMENSIONS.width}px`
                      : undefined,
                  }}
                >
                  <Routes />
                </Box>
                <IdleTimer />
                <OnboardingKeepAlive />
                <WagmiConfigUpdater />
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PersistQueryClientProvider>
      </WagmiProvider>
      <HWRequestListener />
    </>
  );
}
