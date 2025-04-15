import {
  CreateOperationsStatus,
  OperationSet,
  OperationStatus,
  OperationStatusType,
  OperationType,
} from '@orb-labs/orby-core';
import { useOrby } from '@orb-labs/orby-react';
import { OrbyActions } from '@orb-labs/orby-viem-extension';
import { CrosschainQuote, Quote, QuoteError } from '@rainbow-me/swaps';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import { Client, HttpTransport, PublicRpcSchema } from 'viem';

import { ParsedSearchAsset } from '~/core/types/assets';
import { KeychainType } from '~/core/types/keychainTypes';
import { signOperation } from '~/core/utils/orb';
import { Bleed, Box, Inline, Symbol } from '~/design-system';
import { TextStyles } from '~/design-system/styles/core.css';
import {
  BackgroundColor,
  ButtonColor,
  TextColor,
} from '~/design-system/styles/designTokens';

import { ChevronRightDouble } from '../../components/ChevronRightDouble';
import { CoinIcon } from '../../components/CoinIcon/CoinIcon';
import { ExplainerSheetProps } from '../../components/ExplainerSheet/ExplainerSheet';
import { Spinner } from '../../components/Spinner/Spinner';
import { useCurrentWalletTypeAndVendor } from '../../hooks/useCurrentWalletType';
import { useRainbowNavigate } from '../../hooks/useRainbowNavigate';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { ROUTES } from '../../urls';

import { onSwap } from './onSwap';
import { SwapTimeEstimate } from './swapTimeEstimate';

interface UseSwapButtonArgs {
  quote?: Quote | CrosschainQuote | QuoteError;
  isLoading: boolean;
  assetToSell?: ParsedSearchAsset | null;
  assetToSellValue?: string;
  assetToBuy?: ParsedSearchAsset | null;
  enoughAssetsForSwap?: boolean;
  validationButtonLabel: string;
  hideExplainerSheet: () => void;
  showExplainerSheet: (params: ExplainerSheetProps) => void;
  showSwapReviewSheet: () => void;
  isDegenModeEnabled: boolean;
  timeEstimate: SwapTimeEstimate | null;
  operationSet?: OperationSet | null;
  virtualNode?: Client<
    HttpTransport,
    undefined,
    undefined,
    PublicRpcSchema,
    OrbyActions
  >;
}

interface SwapButton {
  buttonColor: BackgroundColor | ButtonColor | TextColor;
  buttonLabelColor: TextStyles['color'];
  buttonDisabled: boolean;
  buttonLabel: string;
  buttonIcon: React.ReactElement | null;
  status: 'loading' | 'ready' | 'error';
  buttonAction: () => void;
}

export const useSwapButton = ({
  quote,
  operationSet,
  isLoading,
  assetToSell,
  assetToBuy,
  validationButtonLabel,
  hideExplainerSheet,
  showExplainerSheet,
  showSwapReviewSheet,
  isDegenModeEnabled,
  timeEstimate,
  virtualNode,
}: UseSwapButtonArgs): SwapButton => {
  const [status, setStatus] = useState<'idle' | 'degen_swapping'>('idle');
  const [isSendingFinalTransaction, setIsSendSendingFinalTransaction] =
    useState<boolean>(false);
  const t = useTranslationContext();
  const navigate = useRainbowNavigate();
  const { type } = useCurrentWalletTypeAndVendor();
  const { accountCluster, baseMainnetClient } = useOrby();
  const isHardwareWallet = type === KeychainType.HardwareWalletKeychain;

  const operationStatusesUpdated = useCallback(
    async (
      statusSummary: OperationStatusType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _finalTransactionStatus?: OperationStatus,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _statuses?: OperationStatus[],
    ) => {
      if (
        !isSendingFinalTransaction &&
        [
          (OperationStatusType.SUCCESSFUL, OperationStatusType.PENDING),
        ].includes(statusSummary)
      ) {
        setIsSendSendingFinalTransaction(true);
        const swapExecutedSuccessfully = await onSwap({
          quote: quote as Quote,
          assetToSell,
          assetToBuy,
          degenMode: true,
        });

        if (swapExecutedSuccessfully) {
          navigate(ROUTES.HOME, { state: { tab: 'activity' } });
        }
      }
    },
    [isSendingFinalTransaction, navigate, quote, assetToSell, assetToBuy],
  );

  if (isLoading) {
    return {
      buttonColor: 'surfaceSecondary',
      buttonLabelColor: 'labelQuaternary',
      buttonDisabled: true,
      buttonLabel: t('swap.actions.loading'),
      buttonIcon: (
        <Box
          width="fit"
          alignItems="center"
          justifyContent="center"
          style={{ margin: 'auto' }}
        >
          <Spinner size={16} color="labelQuaternary" />
        </Box>
      ),
      buttonAction: () => null,
      status: 'loading',
    };
  }

  if (!quote) {
    return {
      buttonColor: 'surfaceSecondary',
      buttonDisabled: true,
      buttonLabel: t('swap.actions.enter_an_amount'),
      buttonLabelColor: 'labelQuaternary',
      buttonIcon: null,
      buttonAction: () => null,
      status: 'error',
    };
  }

  if (!(quote as QuoteError).error) {
    if (operationSet?.status == CreateOperationsStatus.INSUFFICIENT_FUNDS) {
      return {
        buttonColor: 'fillSecondary',
        buttonDisabled: true,
        buttonLabel: validationButtonLabel,
        buttonLabelColor: 'label',
        buttonIcon: null,
        buttonAction: () => null,
        status: 'ready',
      };
    }

    if (isDegenModeEnabled) {
      if (status === 'degen_swapping') {
        return {
          buttonColor: 'surfaceSecondary',
          buttonDisabled: true,
          buttonLabel: isHardwareWallet
            ? t('swap.actions.waiting_signature')
            : t('swap.actions.swapping'),
          buttonLabelColor: 'labelQuaternary',
          buttonIcon: (
            <Box
              width="fit"
              alignItems="center"
              justifyContent="center"
              style={{ margin: 'auto' }}
            >
              <Spinner size={16} color="labelQuaternary" />
            </Box>
          ),
          buttonAction: () => null,
          status: 'ready',
        };
      }

      return {
        buttonColor: 'accent',
        buttonDisabled: false,
        buttonLabel: t('swap.actions.swap'),
        buttonLabelColor: 'label',
        buttonIcon: null,
        buttonAction: async () => {
          setStatus('degen_swapping');
          if (virtualNode && accountCluster && operationSet) {
            operationSet.primaryOperation = undefined;

            const operation = operationSet.intents
              ?.map((intent) => intent.intentOperations)
              ?.flat()
              ?.find(
                (operation) => operation?.type == OperationType.SUBMIT_INTENT,
              );

            if (operation) {
              operation.type = OperationType.FINAL_TRANSACTION;
            }

            const { operationResponses } = await virtualNode.sendOperationSet(
              accountCluster,
              operationSet,
              signOperation,
              undefined,
              signOperation,
            );

            const ids = operationResponses
              ?.map((op) => op.id)
              .filter((id) => !_.isUndefined(id));

            baseMainnetClient?.subscribeToOperationStatuses(
              ids,
              operationStatusesUpdated,
            );
          }

          setStatus('idle');
        },
        status: 'ready',
      };
    }

    return {
      buttonColor: 'accent',
      buttonDisabled: false,
      buttonLabel: t('swap.actions.review'),
      buttonLabelColor: 'label',
      buttonIcon: (
        <Symbol symbol="doc.text.magnifyingglass" weight="bold" size={16} />
      ),
      buttonAction: timeEstimate?.isLongWait
        ? () =>
            showExplainerSheet({
              show: true,
              header: {
                icon: (
                  <Box>
                    <Box>
                      <CoinIcon
                        asset={assetToSell}
                        size={40}
                        isParent={false}
                      />
                    </Box>
                    <Box width="full">
                      <Inline alignHorizontal="right">
                        <Bleed right="10px" top="19px">
                          <Symbol
                            symbol="exclamationmark.triangle.fill"
                            size={20}
                            color="orange"
                            weight="bold"
                          />
                        </Bleed>
                      </Inline>
                    </Box>
                  </Box>
                ),
              },
              title: t('swap.explainers.long_wait.title'),
              description: [t('swap.explainers.long_wait.description')],
              actionButton: {
                label: t('swap.explainers.long_wait.action_label'),
                variant: 'tinted',
                labelColor: 'blue',
                action: () => {
                  hideExplainerSheet();
                  showSwapReviewSheet();
                },
              },
              testId: 'swap-long-wait',
            })
        : () => {
            showSwapReviewSheet();
          },
      status: 'ready',
    };
  }

  switch ((quote as QuoteError).error_code) {
    case 502:
      // insufficient liquidity
      return {
        buttonColor: 'fillSecondary',
        buttonDisabled: false,
        buttonLabel: t('swap.actions.insufficient_liquidity'),
        buttonLabelColor: 'label',
        buttonIcon: (
          <Symbol
            symbol="exclamationmark.circle.fill"
            weight="bold"
            size={16}
          />
        ),
        buttonAction: () =>
          showExplainerSheet({
            show: true,
            header: { emoji: '🏦' },
            title: t('swap.explainers.insufficient_liquidity.title'),
            description: [
              t('swap.explainers.insufficient_liquidity.description'),
            ],
            footerLinkText: {
              openText: t(
                'explainers.insufficient_liquidity.footer_text.open_text',
              ),
              linkText: t(
                'explainers.insufficient_liquidity.footer_text.link_text',
              ),
              closeText: t(
                'explainers.insufficient_liquidity.footer_text.close_text',
              ),
              link: 'https://learn.rainbow.me/a-beginners-guide-to-liquidity-providing',
            },
            actionButton: {
              label: t('swap.explainers.insufficient_liquidity.action_label'),
              variant: 'tinted',
              labelColor: 'blue',
              action: hideExplainerSheet,
            },
            testId: 'swap-liquidity',
          }),
        status: 'ready',
      };
    case 503:
      // fee on transfer
      return {
        buttonColor: 'fillSecondary',
        buttonDisabled: false,
        buttonLabel: t('swap.actions.fee_on_transfer_token'),
        buttonLabelColor: 'label',
        buttonIcon: (
          <Symbol
            symbol="exclamationmark.circle.fill"
            weight="bold"
            size={16}
          />
        ),
        buttonAction: () =>
          showExplainerSheet({
            show: true,
            header: {
              icon: <CoinIcon asset={assetToSell} size={32} isParent={false} />,
            },

            title: t('swap.explainers.fee_on_transfer_token.title'),
            description: [
              t('swap.explainers.fee_on_transfer_token.description', {
                tokenName: assetToSell?.name,
              }),
            ],
            footerLinkText: {
              openText: t(
                'swap.explainers.fee_on_transfer_token.footer_text.open_text',
              ),
              linkText: t(
                'swap.explainers.fee_on_transfer_token.footer_text.link_text',
              ),
              closeText: t(
                'swap.explainers.fee_on_transfer_token.footer_text.close_text',
              ),
              link: 'https://support.rainbow.me/en/articles/8324868-fee-on-transfer-tokens',
            },
            actionButton: {
              label: t('swap.explainers.fee_on_transfer_token.action_label'),
              variant: 'tinted',
              labelColor: 'blue',
              action: hideExplainerSheet,
            },
            testId: 'fee-on-transfer',
          }),
        status: 'ready',
      };

    case 504:
      // no route
      return {
        buttonColor: 'fillSecondary',
        buttonDisabled: false,
        buttonLabel: t('swap.actions.no_route'),
        buttonLabelColor: 'label',
        buttonIcon: (
          <Symbol
            symbol="exclamationmark.circle.fill"
            weight="bold"
            size={16}
          />
        ),
        buttonAction: () =>
          showExplainerSheet({
            show: true,
            header: {
              icon: (
                <Inline space="8px" alignVertical="center">
                  <Box>
                    <CoinIcon asset={assetToSell} size={40} isParent={false} />
                  </Box>
                  <ChevronRightDouble
                    colorLeft="separatorSecondary"
                    colorRight="separator"
                  />
                  <Box>
                    <CoinIcon asset={assetToBuy} size={40} isParent={false} />
                  </Box>
                </Inline>
              ),
            },
            title: t('swap.explainers.no_route.title'),
            description: [t('swap.explainers.no_route.description')],
            actionButton: {
              label: t('swap.explainers.no_route.action_label'),
              variant: 'tinted',
              labelColor: 'blue',
              action: hideExplainerSheet,
            },
            testId: 'swap-no-route',
          }),
        status: 'error',
      };
    case 501:
    default:
      // no quote available
      return {
        buttonColor: 'fillSecondary',
        buttonDisabled: false,
        buttonLabel: t('swap.actions.no_quote'),
        buttonLabelColor: 'label',
        buttonIcon: (
          <Symbol
            symbol="exclamationmark.circle.fill"
            weight="bold"
            size={16}
          />
        ),
        buttonAction: () =>
          showExplainerSheet({
            show: true,
            header: { emoji: '🚧' },
            title: t('swap.explainers.no_quote.title'),
            description: [t('swap.explainers.no_quote.description')],

            actionButton: {
              label: t('swap.explainers.no_quote.action_label'),
              variant: 'tinted',
              labelColor: 'blue',
              action: hideExplainerSheet,
            },
            testId: 'swap-no-quote',
          }),
        status: 'error',
      };
  }
};
