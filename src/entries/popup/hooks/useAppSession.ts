import { removeConnectedAppSession } from '@orb-labs/orby-core-mini';
import { connectAppSession, useOrby } from '@orb-labs/orby-react';
import * as React from 'react';
import { Address } from 'viem';

import { initializeMessenger } from '~/core/messengers';
import { useAppSessionsStore } from '~/core/state';
import { useAppConnectionWalletSwitcherStore } from '~/core/state/appConnectionWalletSwitcher/appConnectionSwitcher';
import { toHex } from '~/core/utils/hex';
import { isLowerCaseMatch } from '~/core/utils/strings';

const messenger = initializeMessenger({ connect: 'inpage' });

export function useAppSession({ host = '' }: { host?: string }) {
  const {
    removeAppSession,
    removeSession,
    updateActiveSessionChainId: storeUpdateActiveSessionChainId,
    updateSessionChainId: storeUpdateSessionChainId,
    updateActiveSession: storeUpdateActiveSession,
    appSessions,
    addSession: storeAddSession,
    getActiveSession,
  } = useAppSessionsStore();

  const { baseMainnetClient, accountCluster } = useOrby();

  const activeSession = getActiveSession({ host });
  const clearAppHasInteractedWithNudgeSheet =
    useAppConnectionWalletSwitcherStore.use.clearAppHasInteractedWithNudgeSheet();

  const updateAppSessionAddress = React.useCallback(
    ({ address }: { address: Address }) => {
      if (!accountCluster?.accountClusterId) {
        return;
      }

      storeUpdateActiveSession({ host, address });
      messenger.send(`accountsChanged:${host}`, address);
      messenger.send(
        `chainChanged:${host}`,
        appSessions[host].sessions[address],
      );

      connectAppSession(
        accountCluster?.accountClusterId,
        host,
        baseMainnetClient,
      );
    },
    [
      appSessions,
      baseMainnetClient,
      host,
      storeUpdateActiveSession,
      accountCluster?.accountClusterId,
    ],
  );

  const addSession = React.useCallback(
    ({
      host,
      address,
      chainId,
      url,
    }: {
      host: string;
      address: Address;
      chainId: number;
      url: string;
    }) => {
      if (!accountCluster?.accountClusterId) {
        return;
      }

      const sessions = storeAddSession({ host, address, chainId, url });
      messenger.send(`accountsChanged:${host}`, address);
      if (Object.keys(sessions).length === 1) {
        messenger.send(`connect:${host}`, {
          address,
          chainId: toHex(String(chainId)),
        });
      }

      connectAppSession(
        accountCluster?.accountClusterId,
        host,
        baseMainnetClient,
      );
    },
    [accountCluster?.accountClusterId, storeAddSession, baseMainnetClient],
  );

  const updateAppSessionChainId = React.useCallback(
    (chainId: number) => {
      storeUpdateActiveSessionChainId({ host, chainId });
      messenger.send(`chainChanged:${host}`, chainId);
    },
    [host, storeUpdateActiveSessionChainId],
  );

  const updateActiveSessionChainId = React.useCallback(
    (chainId: number) => {
      storeUpdateActiveSessionChainId({ host, chainId });
      messenger.send(`chainChanged:${host}`, chainId);
    },
    [host, storeUpdateActiveSessionChainId],
  );

  const updateSessionChainId = React.useCallback(
    ({ address, chainId }: { address: Address; chainId: number }) => {
      storeUpdateSessionChainId({ host, address, chainId });
      if (isLowerCaseMatch(activeSession?.address, address)) {
        messenger.send(`chainChanged:${host}`, chainId);
      }
    },
    [activeSession?.address, host, storeUpdateSessionChainId],
  );

  const appSession = React.useMemo(
    () => appSessions[host],
    [appSessions, host],
  );

  const disconnectSession = React.useCallback(
    ({ address, host }: { address: Address; host: string }) => {
      const newActiveSession = removeSession({ host, address });
      if (newActiveSession && accountCluster?.accountClusterId) {
        connectAppSession(
          accountCluster?.accountClusterId,
          host,
          baseMainnetClient,
        );
        messenger.send(`accountsChanged:${host}`, newActiveSession?.address);
        messenger.send(`chainChanged:${host}`, newActiveSession?.chainId);
      } else {
        removeConnectedAppSession(host);
        messenger.send(`disconnect:${host}`, []);
        clearAppHasInteractedWithNudgeSheet({ host: host });
      }
    },
    [
      accountCluster?.accountClusterId,
      baseMainnetClient,
      clearAppHasInteractedWithNudgeSheet,
      removeSession,
    ],
  );

  const disconnectAppSession = React.useCallback(() => {
    messenger.send(`disconnect:${host}`, null);
    removeAppSession({ host });
    clearAppHasInteractedWithNudgeSheet({ host: host });
    removeConnectedAppSession(host);
  }, [host, removeAppSession, clearAppHasInteractedWithNudgeSheet]);

  return {
    addSession,
    updateAppSessionAddress,
    updateActiveSessionChainId,
    updateSessionChainId,
    updateAppSessionChainId,
    disconnectAppSession,
    disconnectSession,
    appSession,
    activeSession,
  };
}
