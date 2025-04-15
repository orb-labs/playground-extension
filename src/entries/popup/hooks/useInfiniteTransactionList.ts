import {
  ActivityStatus,
  Category,
  OperationStatus,
  OperationType,
} from '@orb-labs/orby-core';
import { useGetActivity } from '@orb-labs/orby-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { queryClient } from '~/core/react-query';
import { shortcuts } from '~/core/references/shortcuts';
import { selectTransactionsByDate } from '~/core/resources/_selectors';
import {
  consolidatedTransactionsQueryKey,
  useConsolidatedTransactions,
} from '~/core/resources/transactions/consolidatedTransactions';
import { fetchTransaction } from '~/core/resources/transactions/transaction';
import { useCurrentAddressStore, useCurrentCurrencyStore } from '~/core/state';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';
import { useCustomNetworkTransactionsStore } from '~/core/state/transactions/customNetworkTransactions';
import { RainbowTransaction } from '~/core/types/transactions';
import { truncateAddress } from '~/core/utils/address';
import { useSupportedChains } from '~/core/utils/chains';

import useComponentWillUnmount from './useComponentWillUnmount';
import { useKeyboardShortcut } from './useKeyboardShortcut';
import { useUserChains } from './useUserChains';

const PAGES_TO_CACHE_LIMIT = 2;

interface UseInfiniteTransactionListParams {
  getScrollElement: () => HTMLDivElement | null;
}

export const useInfiniteTransactionList = ({
  getScrollElement,
}: UseInfiniteTransactionListParams) => {
  const { currentAddress: address } = useCurrentAddressStore();
  const { currentCurrency: currency } = useCurrentCurrencyStore();
  const [manuallyRefetching, setManuallyRefetching] = useState(false);
  const [transactions, setTransactions] = useState<
    RainbowTransaction[] | undefined
  >(undefined);

  const customNetworkTransactions = useCustomNetworkTransactionsStore(
    (s) => s.customNetworkTransactions,
  );

  const currentAddressCustomNetworkTransactions = useMemo(
    () => Object.values(customNetworkTransactions[address] || {}).flat(),
    [address, customNetworkTransactions],
  );

  const { testnetMode } = useTestnetModeStore();
  const { chains } = useUserChains();
  const userChainIds = chains.map(({ id }) => id);
  const supportedChainIds = useSupportedChains({ testnets: testnetMode })
    .map(({ id }) => id)
    .filter((id) => userChainIds.includes(id));

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isInitialLoading,
    refetch,
    status,
  } = useConsolidatedTransactions({
    address,
    currency,
    userChainIds: supportedChainIds,
  });

  const pages = data?.pages;
  const cutoff = pages?.length ? pages[pages.length - 1]?.cutoff : null;

  const { activity, isLoading } = useGetActivity(testnetMode);

  useEffect(() => {
    const getActivity = async () => {
      if (!activity) return;

      const promises = activity?.activities?.map(async (ac) => {
        const final = ac.operationStatuses.find(
          (status) => status.type == OperationType.FINAL_TRANSACTION,
        ) as OperationStatus;

        if (!final) {
          return;
        } else if (!final.hash) {
          return;
        } else if (!final.chainId) {
          return;
        } else if (
          !['SUCCESSFUL', ActivityStatus.PENDING].includes(ac.overallStatus)
        ) {
          return;
        }

        const transaction = await fetchTransaction({
          hash: final.hash as `0x${string}`,
          address: address,
          chainId: Number(final.chainId),
          currency: currency,
        });

        if (!transaction) {
          return;
        }

        let description = '';
        const formattedAddress = truncateAddress(transaction.to || '0x');
        if (ac.category == Category.SEND) {
          description = `Send funds to ${formattedAddress}`;
        } else if (ac.category == Category.RECEIVE) {
          description = `Receive funds from ${formattedAddress}`;
        } else if (ac.category == Category.SWAP) {
          description = `Swap funds on ${formattedAddress}`;
        } else if (ac.category == Category.REBALANCE) {
          description = `Rebalance funds on ${formattedAddress}`;
        } else if (ac.category == Category.BRIDGE) {
          description = `Bridge funds on ${formattedAddress}`;
        } else if (ac.category == Category.FUNCTION_CALL) {
          description = `Calling contract ${formattedAddress}`;
        } else {
          description = 'Unknown';
        }

        return { ...transaction, description };
      });

      const transactions = await Promise.all(promises);
      setTransactions(transactions.filter((tx) => tx) as RainbowTransaction[]);
    };

    getActivity();
  }, [activity, address, currency]);

  const transactionsAfterCutoff = useMemo(() => {
    const allTransactions = (transactions ?? []).concat(
      currentAddressCustomNetworkTransactions,
    );
    if (!cutoff) return allTransactions;
    const cutoffIndex = allTransactions.findIndex(
      (tx) => tx.status !== 'pending' && tx.minedAt < cutoff,
    );
    if (!cutoffIndex || cutoffIndex === -1) return allTransactions;

    const transactionsAfterCutoff = [...allTransactions].slice(0, cutoffIndex);
    return transactionsAfterCutoff;
  }, [currentAddressCustomNetworkTransactions, cutoff, transactions]);

  const formattedTransactions = useMemo(
    () =>
      Object.entries(
        selectTransactionsByDate([
          // ...pendingTransactions,
          ...transactionsAfterCutoff,
        ]),
      ).flat(2),
    [transactionsAfterCutoff],
  );

  const infiniteRowVirtualizer = useVirtualizer({
    count: formattedTransactions?.length,
    getScrollElement,
    estimateSize: (i) =>
      typeof formattedTransactions[i] === 'string' ? 34 : 52,
    overscan: 30,
    getItemKey: useCallback(
      (i: number) => {
        const txOrLabel = formattedTransactions[i];
        return typeof txOrLabel === 'string'
          ? txOrLabel
          : txOrLabel.hash + txOrLabel.chainId;
      },
      [formattedTransactions],
    ),
    paddingEnd: 64,
  });
  const rows = infiniteRowVirtualizer.getVirtualItems();

  const cleanupPages = useCallback(() => {
    if (data && data?.pages) {
      queryClient.setQueryData(
        consolidatedTransactionsQueryKey({
          address,
          currency,
          userChainIds: supportedChainIds,
        }),
        {
          ...data,
          pages: [...data.pages].slice(0, PAGES_TO_CACHE_LIMIT),
        },
      );
    }
  }, [address, currency, data, supportedChainIds]);

  useComponentWillUnmount(cleanupPages);

  useEffect(() => {
    const [lastRow] = [...rows].reverse();
    if (!lastRow) return;
    if (
      lastRow.index >= (transactions ?? []).length - 1 &&
      hasNextPage &&
      !isFetching &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    } else if (
      // BE does not guarantee a particular number of transactions per page
      // BE grabs a group from our data providers then filters for various reasons
      // there are rare cases where BE filters out so many transactions on a page
      // that we end up not filling the list UI, preventing the user from paginating via scroll
      // so we recursively paginate until we know the UI is full
      transactionsAfterCutoff.length < 8 &&
      hasNextPage &&
      !isFetching &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    transactionsAfterCutoff.length,
    rows,
    transactions,
  ]);

  const refetchTransactions = async () => {
    setManuallyRefetching(true);
    await refetch();
    setManuallyRefetching(false);
  };

  useKeyboardShortcut({
    handler: (e: KeyboardEvent) => {
      if (e.key === shortcuts.activity.REFRESH_TRANSACTIONS.key) {
        refetchTransactions();
      }
    },
    condition: () => !manuallyRefetching,
  });

  return {
    error,
    fetchNextPage,
    isFetching: isFetching || isLoading || !transactions,
    isFetchingNextPage,
    isInitialLoading,
    status,
    transactions: formattedTransactions,
    virtualizer: infiniteRowVirtualizer,
    isRefetching: manuallyRefetching,
  };
};
