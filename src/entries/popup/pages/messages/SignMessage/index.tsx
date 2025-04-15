import { OperationStatus, OperationStatusType } from '@orb-labs/orby-core';
import {
  useGetOperationsToSignTransactionOrSignTypedData,
  useOrby,
} from '@orb-labs/orby-react';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import config from '~/core/firebase/remoteConfig';
import { i18n } from '~/core/languages';
import { useDappMetadata } from '~/core/resources/metadata/dapp';
import { useFlashbotsEnabledStore } from '~/core/state/currentSettings';
import { useFeatureFlagsStore } from '~/core/state/currentSettings/featureFlags';
import { ProviderRequestPayload } from '~/core/transports/providerRequestTransport';
import { ChainId } from '~/core/types/chains';
import { RPCMethod } from '~/core/types/rpcMethods';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { signOperation, signSVMTransaction } from '~/core/utils/orb';
import { getSigningRequestDisplayDetails } from '~/core/utils/signMessages';
import { Bleed, Box, Stack } from '~/design-system';
import { triggerAlert } from '~/design-system/components/Alert/Alert';
import { TransactionFee } from '~/entries/popup/components/TransactionFee/TransactionFee';
import { showLedgerDisconnectedAlertIfNeeded } from '~/entries/popup/handlers/ledger';
import { useAppSession } from '~/entries/popup/hooks/useAppSession';
import { useWallets } from '~/entries/popup/hooks/useWallets';
import { RainbowError, logger } from '~/logger';

import * as wallet from '../../../handlers/wallet';
import { GasTokenInput } from '../../send';
import { AccountSigningWith } from '../AccountSigningWith';

import { SignMessageActions } from './SignMessageActions';
import { SignMessageInfo } from './SignMessageInfo';

interface ApproveRequestProps {
  approveRequest: (payload: unknown) => void;
  rejectRequest: () => void;
  request: ProviderRequestPayload;
}

const getWalletActionMethod = (
  method: RPCMethod,
): 'personal_sign' | 'sign_typed_data' | undefined => {
  switch (method) {
    case 'personal_sign':
      return 'personal_sign';
    case 'eth_signTypedData':
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4':
      return 'sign_typed_data';
  }
};

export function SignMessage({
  approveRequest,
  rejectRequest,
  request,
}: ApproveRequestProps) {
  const [loading, setLoading] = useState(false);
  const [waitingForDevice, setWaitingForDevice] = useState(false);
  const [selectedGasToken, setSelectedGasToken] = useState<GasTokenInput>({
    name: 'no gas abstraction',
    standardizedTokenId: undefined,
    isDefault: true,
  });

  const { data: dappMetadata } = useDappMetadata({
    url: request?.meta?.sender?.url,
  });
  const { featureFlags } = useFeatureFlagsStore();
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const { watchedWallets } = useWallets();

  const selectedWallet = activeSession?.address;

  const requestPayload = useMemo(() => {
    return getSigningRequestDisplayDetails(request);
  }, [request]);

  const { accountCluster, baseMainnetClient, getVirtualNodeRpcUrl } = useOrby();

  const gasToken = useMemo(() => {
    return selectedGasToken?.standardizedTokenId
      ? { standardizedTokenId: selectedGasToken.standardizedTokenId }
      : undefined;
  }, [selectedGasToken]);

  const { operations, operationSet, virtualNode, isLoading, aggregateFee } =
    useGetOperationsToSignTransactionOrSignTypedData(
      requestPayload.orbyCallData ?? '',
      undefined,
      undefined,
      activeSession?.address?.toLowerCase(),
      activeSession?.chainId ? BigInt(activeSession.chainId) : undefined,
      gasToken,
    );

  const operationStatusesUpdated = useCallback(
    async (
      statusSummary: OperationStatusType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _finalTransactionStatus?: OperationStatus,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _statuses?: OperationStatus[],
    ) => {
      if (statusSummary == OperationStatusType.WAITING_PRECONDITION) {
        return;
      } else if (
        activeSession &&
        [OperationStatusType.FAILED, OperationStatusType.NOT_FOUND].includes(
          statusSummary,
        )
      ) {
        approveRequest(undefined);
      } else if (
        activeSession &&
        [OperationStatusType.SUCCESSFUL, OperationStatusType.PENDING].includes(
          statusSummary,
        )
      ) {
        let result = null;
        // this is for signing Solana Transaction
        if (request.method == 'signTransaction') {
          const txRpcUrl = getVirtualNodeRpcUrl(
            activeSession?.address,
            BigInt(activeSession?.chainId),
          );

          result = await signSVMTransaction(
            txRpcUrl.virtualNodeRpcUrl,
            requestPayload.msgData,
            activeSession?.address,
          );
        } else {
          result = await wallet.signTypedData(
            requestPayload.msgData,
            activeSession?.address,
          );
        }

        approveRequest(result);
      }
    },
    [
      activeSession,
      approveRequest,
      getVirtualNodeRpcUrl,
      request.method,
      requestPayload.msgData,
    ],
  );

  const onAcceptRequest = useCallback(async () => {
    const walletAction = getWalletActionMethod(request?.method);
    const requestPayload = getSigningRequestDisplayDetails(request);
    if (!requestPayload.msgData || !requestPayload.address || !selectedWallet)
      return;
    const { type } = await wallet.getWallet(selectedWallet);

    setLoading(true);
    try {
      // Change the label while we wait for confirmation
      if (type === 'HardwareWalletKeychain') {
        setWaitingForDevice(true);
      }

      if (walletAction === 'personal_sign') {
        const result = await wallet.personalSign(
          requestPayload.msgData,
          requestPayload.address,
        );

        analytics.track(event.dappPromptSignMessageApproved, {
          dappURL: dappMetadata?.appHost || '',
          dappName: dappMetadata?.appName,
        });

        approveRequest(result);
      } else if (walletAction === 'sign_typed_data') {
        if (!accountCluster || !virtualNode || !operationSet) {
          console.error('Missing data for sign typed data');
          approveRequest(null);
          return;
        }

        const { success, operationResponses } =
          await virtualNode.sendOperationSet(
            accountCluster,
            operationSet,
            signOperation,
            undefined,
            signOperation,
          );

        if (!success) {
          console.error('Error sending operation set');
          approveRequest(null);
          return;
        }

        if (operationResponses && operationResponses.length === 0) {
          operationStatusesUpdated(OperationStatusType.SUCCESSFUL);
        } else {
          const ids = operationResponses
            ?.map((op) => op.id)
            .filter((id) => !_.isUndefined(id));
          baseMainnetClient?.subscribeToOperationStatuses(
            ids,
            operationStatusesUpdated,
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      showLedgerDisconnectedAlertIfNeeded(e);
      logger.info('error in sign message');
      logger.error(new RainbowError(e.name), { message: e.message });
    } finally {
      setWaitingForDevice(false);
      setLoading(false);
    }
  }, [
    request,
    selectedWallet,
    dappMetadata?.appHost,
    dappMetadata?.appName,
    approveRequest,
    accountCluster,
    virtualNode,
    operationSet,
    baseMainnetClient,
    operationStatusesUpdated,
  ]);

  const onRejectRequest = useCallback(() => {
    rejectRequest();
    const walletAction = getWalletActionMethod(request?.method);
    if (walletAction === 'personal_sign') {
      analytics.track(event.dappPromptSignMessageRejected, {
        dappURL: dappMetadata?.appHost || '',
        dappName: dappMetadata?.appName,
      });
    } else if (walletAction === 'sign_typed_data') {
      analytics.track(event.dappPromptSignTypedDataRejected, {
        dappURL: dappMetadata?.appHost || '',
        dappName: dappMetadata?.appName,
      });
    }
  }, [
    dappMetadata?.appHost,
    dappMetadata?.appName,
    rejectRequest,
    request?.method,
  ]);

  const isWatchingWallet = useMemo(() => {
    const watchedAddresses = watchedWallets?.map(({ address }) => address);
    return selectedWallet && watchedAddresses?.includes(selectedWallet);
  }, [selectedWallet, watchedWallets]);

  useEffect(() => {
    if (!featureFlags.full_watching_wallets && isWatchingWallet) {
      triggerAlert({
        text: i18n.t('alert.wallet_watching_mode'),
        callback: rejectRequest,
      });
    }
  }, [featureFlags.full_watching_wallets, isWatchingWallet, rejectRequest]);

  const chainId = useMemo(() => {
    return activeSession?.chainId || ChainId.mainnet;
  }, [activeSession?.chainId]);

  const selectGasToken = useCallback(
    (gasToken?: GasTokenInput) => {
      if (gasToken) {
        setSelectedGasToken(gasToken);
      }
    },
    [setSelectedGasToken],
  );

  const { flashbotsEnabled } = useFlashbotsEnabledStore();
  const flashbotsEnabledGlobally = useMemo(() => {
    return (
      config.flashbots_enabled &&
      flashbotsEnabled &&
      activeSession?.chainId === ChainId.mainnet
    );
  }, [activeSession?.chainId, flashbotsEnabled]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      style={{ height: POPUP_DIMENSIONS.height, overflow: 'hidden' }}
    >
      <SignMessageInfo
        request={request}
        operationSet={operationSet}
        operations={operations}
      />
      <Stack space="20px" padding="20px">
        <Bleed vertical="4px">
          <AccountSigningWith session={activeSession} noFee />
        </Bleed>
        <TransactionFee
          analyticsEvents={{
            customGasClicked: event.dappPromptSendTransactionCustomGasClicked,
            transactionSpeedSwitched:
              event.dappPromptSendTransactionSpeedSwitched,
            transactionSpeedClicked:
              event.dappPromptSendTransactionSpeedClicked,
          }}
          chainId={chainId}
          address={activeSession?.address}
          transactionRequest={{}}
          flashbotsEnabled={flashbotsEnabledGlobally}
          selectedGasToken={selectedGasToken}
          setSelectedGasToken={selectGasToken}
          aggregateFee={aggregateFee}
        />
        <SignMessageActions
          waitingForDevice={waitingForDevice}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          loading={loading || isLoading}
          dappStatus={dappMetadata?.status}
        />
      </Stack>
    </Box>
  );
}
