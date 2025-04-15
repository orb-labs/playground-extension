import { CreateOperationsStatus, OperationSet } from '@orb-labs/orby-core';
import { useMemo } from 'react';

import { i18n } from '~/core/languages';
import { ParsedSearchAsset } from '~/core/types/assets';
import { ChainId } from '~/core/types/chains';
import { GasFeeLegacyParams, GasFeeParams } from '~/core/types/gas';
import { getChain } from '~/core/utils/chains';
import { toWei } from '~/core/utils/ethereum';
import {
  convertAmountToRawAmount,
  lessOrEqualThan,
} from '~/core/utils/numbers';

export const useSwapValidations = ({
  assetToSell,
  assetToSellValue,
  selectedGas,
  operationSet,
}: {
  assetToSell?: ParsedSearchAsset | null;
  assetToSellValue?: string;
  selectedGas?: GasFeeParams | GasFeeLegacyParams;
  operationSet?: OperationSet | null;
}) => {
  const enoughAssetBalance = useMemo(() => {
    if (assetToSellValue) {
      if (!assetToSell?.isNativeAsset) {
        return lessOrEqualThan(
          convertAmountToRawAmount(
            assetToSellValue,
            assetToSell?.decimals || 18,
          ),
          convertAmountToRawAmount(
            assetToSell?.balance?.amount || '0',
            assetToSell?.decimals || 18,
          ),
        );
      } else {
        return lessOrEqualThan(
          toWei(assetToSellValue || '0'),
          toWei(assetToSell?.balance?.amount || '0'),
        );
      }
    }
    return true;
  }, [assetToSell, assetToSellValue]);

  const enoughNativeAssetBalanceForGas = useMemo(() => {
    return operationSet?.status != CreateOperationsStatus.INSUFFICIENT_FUNDS;
  }, [operationSet]);

  const buttonLabel = useMemo(() => {
    if (!enoughAssetBalance)
      return i18n.t('send.button_label.insufficient_asset', {
        symbol: assetToSell?.symbol,
      });
    if (!enoughNativeAssetBalanceForGas)
      return i18n.t('send.button_label.insufficient_native_asset_for_gas', {
        symbol: getChain({ chainId: assetToSell?.chainId || ChainId.mainnet })
          .nativeCurrency.symbol,
      });
    return '';
  }, [
    assetToSell?.chainId,
    assetToSell?.symbol,
    enoughAssetBalance,
    enoughNativeAssetBalanceForGas,
  ]);

  const enoughAssetsForSwap =
    Boolean(enoughAssetBalance) && Boolean(enoughNativeAssetBalanceForGas);

  return {
    buttonLabel,
    enoughAssetBalance,
    enoughNativeAssetBalanceForGas,
    enoughAssetsForSwap,
    readyForReview: enoughAssetsForSwap && selectedGas?.gasFee?.amount,
  };
};
