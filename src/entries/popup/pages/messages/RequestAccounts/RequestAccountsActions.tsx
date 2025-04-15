import { VMType } from '@orb-labs/orby-core';
import { Address } from 'viem';

import { DAppStatus } from '~/core/graphql/__generated__/metadata';
import { i18n } from '~/core/languages';
import { ChainId } from '~/core/types/chains';
import { Box, Column, Columns, Stack } from '~/design-system';

import {
  AcceptRequestButton,
  BottomSwitchNetwork,
  BottomSwitchWallet,
  RejectRequestButton,
} from '../BottomActions';

export const RequestAccountsActions = ({
  selectedWallet,
  setSelectedWallet,
  selectedChainId,
  setSelectedChainId,
  onAcceptRequest,
  onRejectRequest,
  appName,
  loading = false,
  dappStatus,
  vmType,
}: {
  appName?: string;
  selectedWallet: Address;
  setSelectedWallet: (value: Address) => void;
  selectedChainId: ChainId;
  setSelectedChainId: (value: ChainId) => void;
  onAcceptRequest: () => void;
  onRejectRequest: () => void;
  loading?: boolean;
  dappStatus?: DAppStatus;
  vmType?: VMType;
}) => {
  const isScamDapp = dappStatus === DAppStatus.Scam;
  return (
    <Box padding="20px">
      <Stack space="24px">
        <Columns alignVertical="center" alignHorizontal="justify">
          <Column>
            <BottomSwitchWallet
              selectedWallet={selectedWallet}
              setSelectedWallet={setSelectedWallet}
              setSelectedChainId={setSelectedChainId}
            />
          </Column>
          <Column>
            <BottomSwitchNetwork
              selectedChainId={selectedChainId}
              setSelectedChainId={setSelectedChainId}
              vmType={vmType}
            />
          </Column>
        </Columns>
        <Stack
          space="8px"
          flexDirection={isScamDapp ? 'column-reverse' : 'column'}
        >
          <AcceptRequestButton
            dappStatus={dappStatus}
            onClick={onAcceptRequest}
            label={
              isScamDapp
                ? i18n.t('approve_request.connect_anyway')
                : i18n.t('approve_request.connect', { appName })
            }
            loading={loading}
          />
          <RejectRequestButton
            dappStatus={dappStatus}
            onClick={onRejectRequest}
            label={i18n.t('common_actions.cancel')}
          />
        </Stack>
      </Stack>
    </Box>
  );
};
