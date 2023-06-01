/* eslint-disable @typescript-eslint/no-explicit-any */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as React from 'react';
import { HashRouter } from 'react-router-dom';
import { WagmiConfig, useAccount } from 'wagmi';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import { flushQueuedEvents } from '~/analytics/flushQueuedEvents';
// !!!! DO NOT REMOVE THE NEXT 2 LINES BELOW !!!!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import config from '~/core/firebase/remoteConfig';
import { changeI18nLanguage } from '~/core/languages';
import { persistOptions, queryClient } from '~/core/react-query';
import { initializeSentry, setSentryUser } from '~/core/sentry';
import { useCurrentLanguageStore, useDeviceIdStore } from '~/core/state';
import { useCurrentThemeStore } from '~/core/state/currentSettings/currentTheme';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { createWagmiClient } from '~/core/wagmi';
import { Box, ThemeProvider } from '~/design-system';
import { Alert } from '~/design-system/components/Alert/Alert';

import { Routes } from './Routes';
import { HWRequestListener } from './components/HWRequestListener/HWRequestListener';
import { IdleTimer } from './components/IdleTimer/IdleTimer';
import { Toast } from './components/Toast/Toast';
import { AuthProvider } from './hooks/useAuth';
import { useIsFullScreen } from './hooks/useIsFullScreen';
import { usePendingTransactionWatcher } from './hooks/usePendingTransactionWatcher';
import { PlaygroundComponents } from './pages/_playgrounds';
import { RainbowConnector } from './wagmi/RainbowConnector';

const playground = process.env.PLAYGROUND as 'default' | 'ds';

const wagmiClient = createWagmiClient({
  autoConnect: true,
  connectors: ({ chains }) => [new RainbowConnector({ chains })],
  persist: true,
});

export function App() {
  const { currentLanguage } = useCurrentLanguageStore();
  const { address } = useAccount();
  const { deviceId } = useDeviceIdStore();

  usePendingTransactionWatcher({ address });

  React.useEffect(() => {
    // Disable analytics & sentry for e2e and dev mode
    changeI18nLanguage(currentLanguage);

    if (process.env.IS_TESTING !== 'true' && process.env.IS_DEV !== 'true') {
      initializeSentry('popup');
      setSentryUser(deviceId);
      analytics.setDeviceId(deviceId);
      analytics.identify();
      analytics.track(event.popupOpened);
      setTimeout(() => flushQueuedEvents(), 1000);
    }

    if (process.env.IS_DEV !== 'true') {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { currentTheme } = useCurrentThemeStore();
  const isFullScreen = useIsFullScreen();

  return (
    <>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <WagmiConfig client={wagmiClient}>
          <ThemeProvider theme={currentTheme}>
            {playground ? (
              PlaygroundComponents[playground]
            ) : (
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
                  <HashRouter>
                    <Routes>
                      <Toast />
                      <Alert />
                    </Routes>
                  </HashRouter>
                </Box>
                <IdleTimer />
              </AuthProvider>
            )}
          </ThemeProvider>
        </WagmiConfig>
      </PersistQueryClientProvider>
      <HWRequestListener />
    </>
  );
}
