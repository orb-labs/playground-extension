import { Account, AccountType, VMType } from '@orb-labs/orby-core';
import { bulkResetConnectedAppSessions } from '@orb-labs/orby-core-mini';
import { useOrby } from '@orb-labs/orby-react';
import { OrbyActions } from '@orb-labs/orby-viem-extension';
import * as React from 'react';
import { Client, HttpTransport, PublicRpcSchema } from 'viem';

import { useAppSessionsStore } from '~/core/state';

export function useConnectAppSessions() {
  const { appSessions } = useAppSessionsStore();

  const activeSessions = React.useMemo(() => {
    return Array.from(Object.keys(appSessions)).map((host) => {
      return { host, address: appSessions[host].activeSessionAddress };
    });
  }, [appSessions]);

  const { isLoading, isConnected } = useBulkConnectAppSessions(activeSessions);
  return { isLoading, isConnected };
}

export function useBulkConnectAppSessions(
  activeSessions: { host: string; address: `0x${string}` }[],
) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isConnected, setIsConnected] = React.useState<boolean>(false);
  const { baseMainnetClient } = useOrby();

  // A ref to track the previous count value
  const prevCountRef = React.useRef<{ host: string; address: `0x${string}` }[]>(
    [],
  );

  React.useEffect(() => {
    const resetConnectedAppSessions = async () => {
      setIsLoading(true);
      try {
        if (
          activeSessions.length == 0 ||
          !baseMainnetClient ||
          prevCountRef.current.sort((a, b) => b.host.localeCompare(a.host)) ==
            activeSessions.sort((a, b) => b.host.localeCompare(a.host))
        ) {
          return;
        }

        const connected = await connectAppSessions(
          activeSessions,
          // @ts-ignore
          baseMainnetClient,
        );

        prevCountRef.current = activeSessions.map((session) => ({
          ...session,
        }));

        // Update the previous value after render
        setIsConnected(connected);
      } catch (error) {
        console.error('Failed to reset connected app', error);
      } finally {
        setIsLoading(false);
      }
    };

    resetConnectedAppSessions();
  }, [activeSessions, baseMainnetClient]);

  return { isLoading, isConnected };
}

export async function connectAppSessions(
  activeSessions?: { host: string; address: string }[],
  baseMainnetClient?: Client<
    HttpTransport,
    undefined,
    undefined,
    PublicRpcSchema,
    OrbyActions
  >,
) {
  if (!activeSessions || !baseMainnetClient) {
    return false;
  }

  const promises = activeSessions?.map(
    async ({ host, address }: { host: string; address: string }) => {
      const account = new Account(
        address?.toLowerCase(),
        AccountType.EOA,
        VMType.EVM,
        undefined,
      );

      const accountCluster = await baseMainnetClient.createAccountCluster([
        account,
      ]);

      return {
        appUrl: host,
        activeAccountClusterId: accountCluster.accountClusterId,
      };
    },
  );

  const sessions = await Promise.all(promises);
  bulkResetConnectedAppSessions(sessions);
  return true;
}
