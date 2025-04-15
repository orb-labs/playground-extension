import { CreateOperationsStatus, OperationSet } from '@orb-labs/orby-core';
import { useMemo } from 'react';

import { DAppStatus } from '~/core/graphql/__generated__/metadata';
import { i18n } from '~/core/languages';
import { ActiveSession } from '~/core/state/appSessions';

export const useApproveAppRequestValidations = ({
  dappStatus,
  operationSet,
}: {
  session: ActiveSession;
  dappStatus?: DAppStatus;
  operationSet?: OperationSet;
}) => {
  const enoughNativeAssetForGas = true;

  const buttonLabel = useMemo(() => {
    if (dappStatus === DAppStatus.Scam)
      return i18n.t('approve_request.send_transaction_anyway');

    if (operationSet?.status == CreateOperationsStatus.INSUFFICIENT_FUNDS) {
      return i18n.t('send.button_label.insufficient_asset');
    }

    if (
      operationSet?.status == CreateOperationsStatus.INSUFFICIENT_FUNDS_FOR_GAS
    ) {
      return i18n.t('send.button_label.insufficient_gas_funds');
    }

    if (operationSet?.status == CreateOperationsStatus.NO_EXECUTION_PATH) {
      return i18n.t('send.button_label.no_execution_path');
    }

    if (operationSet?.status == CreateOperationsStatus.SUCCESS) {
      return i18n.t('send.button_label.review');
    }

    return i18n.t('approve_request.send_transaction');
  }, [dappStatus, operationSet?.status]);

  return {
    enoughNativeAssetForGas,
    buttonLabel,
  };
};
