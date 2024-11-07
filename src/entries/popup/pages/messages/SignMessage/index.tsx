import { useCallback, useEffect, useMemo, useState } from 'react';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import { i18n } from '~/core/languages';
import { useDappMetadata } from '~/core/resources/metadata/dapp';
import { useFeatureFlagsStore } from '~/core/state/currentSettings/featureFlags';
import { ProviderRequestPayload } from '~/core/transports/providerRequestTransport';
import { RPCMethod } from '~/core/types/rpcMethods';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { getSigningRequestDisplayDetails } from '~/core/utils/signMessages';
import { Bleed, Box, Stack } from '~/design-system';
import { triggerAlert } from '~/design-system/components/Alert/Alert';
import { showLedgerDisconnectedAlertIfNeeded } from '~/entries/popup/handlers/ledger';
import { useAppSession } from '~/entries/popup/hooks/useAppSession';
import { useWallets } from '~/entries/popup/hooks/useWallets';
import { RainbowError, logger } from '~/logger';

import * as wallet from '../../../handlers/wallet';
import { AccountSigningWith } from '../AccountSigningWith';

import { SignMessageActions } from './SignMessageActions';
import { SignMessageInfo } from './SignMessageInfo';
import {
  signOperationSet,
  useCreateClusterId,
  sendSignedOperations,
  useVirtualNodeRpcUrl,
  getOperationsToSignTypedData,
} from '~/core/utils/orb';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';

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
  const { data: dappMetadata } = useDappMetadata({
    url: request?.meta?.sender?.url,
  });
  const { featureFlags } = useFeatureFlagsStore();
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const { watchedWallets } = useWallets();

  const selectedWallet = activeSession?.address;

  const { testnetMode } = useTestnetModeStore();

  // TODO: create hook for orby_getOperationsToSignTypedData here and display the operations

  const clusterId = useCreateClusterId(selectedWallet);
  const virtualNodeRpcUrl = useVirtualNodeRpcUrl(
    clusterId,
    selectedWallet,
    testnetMode,
  );

  console.log('clusterId', clusterId);
  console.log('virtualNodeRpcUrl', virtualNodeRpcUrl);

  const [operations, setOperations] = useState(null);

  useEffect(() => {
    console.log('in useEffect');
    const getOperations = async ({
      virtualNodeRpcUrl,
      to,
      data,
      clusterId,
    }) => {
      const operationSet = await getOperationsToSignTypedData({
        to,
        data,
        clusterId,
        virtualNodeRpcUrl,
      });

      console.log('operationSet', operationSet);

      const operations = operationSet.intents
        .map((intent) => intent.intentOperations)
        .flat()
        ?.concat(operationSet.primaryOperation)
        .filter((value) => value !== undefined && value !== null);

      console.log('operations before setting', operations);

      setOperations(operations);
    };

    if (clusterId && virtualNodeRpcUrl && request) {
      console.log('before get operations');

      const requestPayload = getSigningRequestDisplayDetails(request);

      getOperations({
        clusterId,
        virtualNodeRpcUrl,
        to: requestPayload.address,
        data: requestPayload.msgData,
      });
    }
  }, [clusterId, virtualNodeRpcUrl, request, selectedWallet]);

  const onAcceptRequest = useCallback(async () => {
    const walletAction = getWalletActionMethod(request?.method);
    const requestPayload = getSigningRequestDisplayDetails(request);
    if (!requestPayload.msgData || !requestPayload.address || !selectedWallet)
      return;
    const { type } = await wallet.getWallet(selectedWallet);
    let result = null;

    setLoading(true);
    let hash;
    try {
      // Change the label while we wait for confirmation
      if (type === 'HardwareWalletKeychain') {
        setWaitingForDevice(true);
      }

      if (walletAction === 'personal_sign') {
        result = await wallet.personalSign(
          requestPayload.msgData,
          requestPayload.address,
        );
        analytics.track(event.dappPromptSignMessageApproved, {
          dappURL: dappMetadata?.appHost || '',
          dappName: dappMetadata?.appName,
        });
        hash = result;
        // TODO: use orby_sendSignedOperations
      } else if (walletAction === 'sign_typed_data') {
        const signedOperations = await signOperationSet(operations);
        console.log('signedOperations: ', signedOperations);
        const result = await sendSignedOperations({
          clusterId,
          signedOperations,
          virtualNodeRpcUrl,
        });
        console.log('result', result);
        hash = result.hash;

        // result = await wallet.signTypedData(
        //   requestPayload.msgData,
        //   requestPayload.address,
        // );
        analytics.track(event.dappPromptSignTypedDataApproved, {
          dappURL: dappMetadata?.appHost || '',
          dappName: dappMetadata?.appName,
        });
      }
      approveRequest(hash);
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
    approveRequest,
    dappMetadata?.appHost,
    dappMetadata?.appName,
    request,
    selectedWallet,
    clusterId,
    virtualNodeRpcUrl,
    operations,
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

  return (
    <Box
      display="flex"
      flexDirection="column"
      style={{ height: POPUP_DIMENSIONS.height, overflow: 'hidden' }}
    >
      <SignMessageInfo request={request} />
      <Stack space="20px" padding="20px">
        <Bleed vertical="4px">
          <AccountSigningWith session={activeSession} noFee />
        </Bleed>
        <SignMessageActions
          waitingForDevice={waitingForDevice}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          loading={loading}
          dappStatus={dappMetadata?.status}
        />
      </Stack>
    </Box>
  );
}
