import { Account, AccountType } from '@orb-labs/orby-core';
import { OrbyProvider } from '@orb-labs/orby-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { isEqual } from 'lodash';
import * as React from 'react';
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
import { getWalletVirtualEnvironment } from '~/core/utils/orb';
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

const backgroundMessenger = initializeMessenger({ connect: 'background' });

export function App() {
  const { currentLanguage, setCurrentLanguage } = useCurrentLanguageStore();
  const { deviceId } = useDeviceIdStore();
  const { rainbowChains } = useRainbowChains();
  const prevChains = usePrevious(rainbowChains);

  useExpiryListener();

  React.useEffect(() => {
    if (!isEqual(prevChains, rainbowChains)) {
      backgroundMessenger.send('rainbow_updateWagmiClient', {
        rpcProxyEnabled: config.rpc_proxy_enabled,
      });
    }
  }, [prevChains, rainbowChains]);

  React.useEffect(() => {
    if (!isEqual(prevChains, rainbowChains)) {
      backgroundMessenger.send('rainbow_updateWagmiClient', {
        rpcProxyEnabled: config.rpc_proxy_enabled,
      });
    }
  }, [prevChains, rainbowChains]);

  React.useEffect(() => {
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

    // prevent trackpad double tap zoom
    const app = document.getElementById('app');
    app?.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setCurrentLanguage(currentLanguage);
  }, [currentLanguage, setCurrentLanguage]);

  const { currentTheme } = useCurrentThemeStore();
  const isFullScreen = useIsFullScreen();

  const { currentAddresses } = useCurrentAddressStore();

  const orbyConfig = React.useMemo(() => {
    const accounts = currentAddresses?.map((address) => {
      const vm = getWalletVirtualEnvironment(address);
      return new Account(address, AccountType.EOA, vm!, undefined);
    });

    return {
      instancePrivateAPIKey: process.env.ORBY_PRIVATE_API_KEY as string,
      instancePublicAPIKey: process.env.ORBY_PUBLIC_API_KEY as string,
      appName: 'Rainbow',
      accounts,
    };
  }, [currentAddresses]);

  return (
    <>
      <WagmiProvider config={wagmiConfig}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={currentTheme}>
              <OrbyProvider config={orbyConfig}>
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
              </OrbyProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PersistQueryClientProvider>
      </WagmiProvider>
      <HWRequestListener />
    </>
  );
}
