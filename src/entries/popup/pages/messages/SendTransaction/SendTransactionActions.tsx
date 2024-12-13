import { CreateOperationsStatus, OperationSet } from '@orb-labs/orby-core';
import { useMemo } from 'react';

import { DAppStatus } from '~/core/graphql/__generated__/metadata';
import { i18n } from '~/core/languages';
import { shortcuts } from '~/core/references/shortcuts';
import { ActiveSession } from '~/core/state/appSessions';
import { Inline } from '~/design-system';
import { useApproveAppRequestValidations } from '~/entries/popup/hooks/approveAppRequest/useApproveAppRequestValidations';
import useKeyboardAnalytics from '~/entries/popup/hooks/useKeyboardAnalytics';
import { useKeyboardShortcut } from '~/entries/popup/hooks/useKeyboardShortcut';

import { AcceptRequestButton, RejectRequestButton } from '../BottomActions';

export const SendTransactionActions = ({
  session,
  onAcceptRequest,
  onRejectRequest,
  waitingForDevice,
  loading = false,
  dappStatus,
  operationSet,
}: {
  session: ActiveSession;
  onAcceptRequest: () => void;
  onRejectRequest: () => void;
  waitingForDevice: boolean;
  loading: boolean;
  dappStatus?: DAppStatus;
  operationSet?: OperationSet;
}) => {
  const { buttonLabel } = useApproveAppRequestValidations({
    session,
    dappStatus,
  });

  const disabled = useMemo(() => {
    return operationSet?.status != CreateOperationsStatus.SUCCESS;
  }, [operationSet]);

  const { trackShortcut } = useKeyboardAnalytics();
  useKeyboardShortcut({
    handler: (e: KeyboardEvent) => {
      if (e.key === shortcuts.transaction_request.CANCEL.key) {
        trackShortcut({
          key: shortcuts.transaction_request.CANCEL.display,
          type: 'send.cancel',
        });
        e.preventDefault();
        onRejectRequest();
      }
    },
  });

  return (
    <Inline space="12px" wrap={false}>
      <RejectRequestButton
        onClick={onRejectRequest}
        label={i18n.t('common_actions.cancel')}
        dappStatus={dappStatus}
      />
      <AcceptRequestButton
        onClick={onAcceptRequest}
        label={buttonLabel}
        waitingForDevice={waitingForDevice}
        loading={loading}
        dappStatus={dappStatus}
        disabled={disabled}
      />
    </Inline>
  );
};
