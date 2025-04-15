import { usePortfolio } from '@orb-labs/orby-react';
import { useCallback, useMemo, useState } from 'react';

import {
  selectUserAssetsList,
  selectUserAssetsListByChainId,
  selectorFilterByUserChains,
} from '~/core/resources/_selectors/assets';
import { useUserAssets } from '~/core/resources/assets';
import { useCustomNetworkAssets } from '~/core/resources/assets/customNetworkAssets';
import { useCurrentAddressStore, useCurrentCurrencyStore } from '~/core/state';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';
import { AddressOrEth, ParsedUserAsset } from '~/core/types/assets';
import { ChainId } from '~/core/types/chains';
import {
  convertFungibleTokenAmountsToParsedUserAssets,
  convertStandardizedBalanceToParsedUserAssets,
} from '~/core/utils/orb';
import { isLowerCaseMatch } from '~/core/utils/strings';

export type SortMethod = 'token' | 'chain';

const sortBy = (by: SortMethod) => {
  switch (by) {
    case 'token':
      return selectUserAssetsList;
    case 'chain':
      return selectUserAssetsListByChainId;
  }
};

export const useSendAsset = () => {
  const { currentAddress: address } = useCurrentAddressStore();
  const { currentCurrency } = useCurrentCurrencyStore();
  const [sortMethod, setSortMethod] = useState<SortMethod>('token');

  const [selectedAssetAddress, setSelectedAssetAddress] = useState<
    AddressOrEth | ''
  >('');
  const [selectedAssetChain, setSelectedAssetChain] = useState<
    ChainId | undefined
  >(undefined);

  const { data: assets = [] } = useUserAssets(
    {
      address,
      currency: currentCurrency,
    },
    {
      select: (data) =>
        selectorFilterByUserChains({ data, selector: sortBy(sortMethod) }),
    },
  );

  const { data: customNetworkAssets = [] } = useCustomNetworkAssets(
    {
      address,
      currency: currentCurrency,
    },
    {
      select: (data) =>
        selectorFilterByUserChains({ data, selector: sortBy(sortMethod) }),
    },
  );

  const selectAssetAddressAndChain = useCallback(
    (address: AddressOrEth | '', chainId: ChainId) => {
      setSelectedAssetAddress(address);
      setSelectedAssetChain(chainId);
    },
    [],
  );

  let combinedAssets = useMemo(
    () =>
      Array.from(
        new Map(
          [...customNetworkAssets, ...assets].map((item) => [
            item.uniqueId,
            item,
          ]),
        ).values(),
      ),
    [assets, customNetworkAssets],
  );

  const { testnetMode } = useTestnetModeStore();
  const { portfolio } = usePortfolio(testnetMode);

  combinedAssets = useMemo(() => {
    if (!portfolio) {
      return [];
    }

    return convertStandardizedBalanceToParsedUserAssets(portfolio);
  }, [portfolio]);

  const allAssets = useMemo(
    () =>
      combinedAssets.sort(
        (a: ParsedUserAsset, b: ParsedUserAsset) =>
          parseFloat(b?.native?.balance?.amount) -
          parseFloat(a?.native?.balance?.amount),
      ),
    [combinedAssets],
  );

  const flattenedAssets = useMemo(() => {
    if (!portfolio) {
      return [];
    }

    return convertFungibleTokenAmountsToParsedUserAssets(portfolio);
  }, [portfolio]);

  const asset = useMemo(
    () =>
      flattenedAssets?.find(
        ({ address, chainId }) =>
          isLowerCaseMatch(address, selectedAssetAddress) &&
          chainId === selectedAssetChain,
      ) || null,
    [flattenedAssets, selectedAssetAddress, selectedAssetChain],
  );

  return {
    selectAssetAddressAndChain,
    setSelectedAssetAddress,
    setSelectedAssetChain,
    asset,
    assets: allAssets,
    sortMethod,
    setSortMethod,
    portfolio,
    chainId: selectedAssetChain,
  };
};
