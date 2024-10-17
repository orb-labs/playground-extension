import { useCallback, useMemo, useState } from 'react';

import {
  selectUserAssetsList,
  selectUserAssetsListByChainId,
  selectorFilterByUserChains,
} from '~/core/resources/_selectors/assets';
import { useUserAssets } from '~/core/resources/assets';
import { useCustomNetworkAssets } from '~/core/resources/assets/customNetworkAssets';
import { useCurrentAddressStore, useCurrentCurrencyStore } from '~/core/state';
import { AddressOrEth, ParsedUserAsset } from '~/core/types/assets';
import { ChainId } from '~/core/types/chains';
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

export const useSendAsset = (props: { assets?: ParsedUserAsset[] }) => {
  const { currentAddress: address } = useCurrentAddressStore();
  const { currentCurrency } = useCurrentCurrencyStore();
  const [sortMethod, setSortMethod] = useState<SortMethod>('token');

  const [selectedAssetAddress, setSelectedAssetAddress] = useState<
    AddressOrEth | ''
  >('');
  const [selectedAssetChain, setSelectedAssetChain] = useState<ChainId>(
    ChainId.mainnet,
  );
  // const { data: assets = [] } = useUserAssets(
  //   {
  //     address,
  //     currency: currentCurrency,
  //   },
  //   {
  //     select: (data) =>
  //       selectorFilterByUserChains({ data, selector: sortBy(sortMethod) }),
  //   },
  // );

  // console.log('assets', assets);

  // const { data: customNetworkAssets = [] } = useCustomNetworkAssets(
  //   {
  //     address,
  //     currency: currentCurrency,
  //   },
  //   {
  //     select: (data) =>
  //       selectorFilterByUserChains({ data, selector: sortBy(sortMethod) }),
  //   },
  // );

  const selectAssetAddressAndChain = useCallback(
    (address: AddressOrEth | '', chainId: ChainId) => {
      console.log('address', address);
      console.log('chainId', chainId);
      setSelectedAssetAddress(address);
      setSelectedAssetChain(chainId);
    },
    [],
  );

  // const combinedAssets = useMemo(
  //   () =>
  //     Array.from(
  //       new Map(
  //         [...customNetworkAssets, ...assets].map((item) => [
  //           item.uniqueId,
  //           item,
  //         ]),
  //       ).values(),
  //     ),
  //   [assets, customNetworkAssets],
  // );

  // const allAssets = useMemo(
  //   () =>
  //     combinedAssets.sort(
  //       (a: ParsedUserAsset, b: ParsedUserAsset) =>
  //         parseFloat(b?.native?.balance?.amount) -
  //         parseFloat(a?.native?.balance?.amount),
  //     ),
  //   [combinedAssets],
  // );

  // NOTE: we don't use the above allAssets anymore, just the orb assets passed in
  const asset = useMemo(
    () =>
      props.assets?.find(
        ({ address, chainId }) =>
          isLowerCaseMatch(address, selectedAssetAddress) &&
          chainId === selectedAssetChain,
      ) || null,
    [props.assets, selectedAssetAddress, selectedAssetChain],
  );

  return {
    selectAssetAddressAndChain,
    asset,
    assets: props.assets || [],
    sortMethod,
    setSortMethod,
  };
};
