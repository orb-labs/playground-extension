import {
  TransactionRequest,
  TransactionResponse,
} from '@ethersproject/abstract-provider';
import {
  OperationStatus,
  OperationStatusType,
  OperationType,
} from '@orb-labs/orby-core';
import {
  useGetBlockchains,
  useGetOperationsToExecuteTransaction,
  useOrby,
} from '@orb-labs/orby-react';
import { useAnimationControls } from 'framer-motion';
import _ from 'lodash';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { Address, isAddress } from 'viem';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import config from '~/core/firebase/remoteConfig';
import { i18n } from '~/core/languages';
import { shortcuts } from '~/core/references/shortcuts';
import {
  useCurrentAddressStore,
  useFlashbotsEnabledStore,
  useGasStore,
} from '~/core/state';
import { useContactsStore } from '~/core/state/contacts';
import { useConnectedToHardhatStore } from '~/core/state/currentSettings/connectedToHardhat';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';
import {
  computeUniqueIdForHiddenAsset,
  useHiddenAssetStore,
} from '~/core/state/hiddenAssets/hiddenAssets';
import { usePopupInstanceStore } from '~/core/state/popupInstances';
import { useSelectedNftStore } from '~/core/state/selectedNft';
import { useSelectedTokenStore } from '~/core/state/selectedToken';
import {
  AddressOrEth,
  ParsedAsset,
  ParsedUserAsset,
} from '~/core/types/assets';
import { ChainId, chainNameToIdMapping } from '~/core/types/chains';
import {
  TransactionGasParams,
  TransactionLegacyGasParams,
} from '~/core/types/gas';
import { UniqueAsset } from '~/core/types/nfts';
import { NewTransaction, TxHash } from '~/core/types/transactions';
import { chainIdToUse } from '~/core/utils/chains';
import {
  getUniqueAssetImagePreviewURL,
  getUniqueAssetImageThumbnailURL,
} from '~/core/utils/nfts';
import { signOperation } from '~/core/utils/orb';
import { addNewTransaction } from '~/core/utils/transactions';
import {
  Box,
  Button,
  Column,
  Columns,
  Inline,
  Row,
  Rows,
  Symbol,
  Text,
} from '~/design-system';
import { triggerAlert } from '~/design-system/components/Alert/Alert';
import { AccentColorProvider } from '~/design-system/components/Box/ColorContext';
import { RainbowError, logger } from '~/logger';

import {
  ExplainerSheet,
  useExplainerSheetParams,
} from '../../components/ExplainerSheet/ExplainerSheet';
import { Navbar } from '../../components/Navbar/Navbar';
import { CursorTooltip } from '../../components/Tooltip/CursorTooltip';
import { TransactionFee } from '../../components/TransactionFee/TransactionFee';
import { isLedgerConnectionError } from '../../handlers/ledger';
import { getWallet, sendTransaction } from '../../handlers/wallet';
import { useSendAsset } from '../../hooks/send/useSendAsset';
import { useSendInputs } from '../../hooks/send/useSendInputs';
import { useSendState } from '../../hooks/send/useSendState';
import { useSendUniqueAsset } from '../../hooks/send/useSendUniqueAsset';
import { useSendValidations } from '../../hooks/send/useSendValidations';
import useKeyboardAnalytics from '../../hooks/useKeyboardAnalytics';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import usePrevious from '../../hooks/usePrevious';
import { useRainbowNavigate } from '../../hooks/useRainbowNavigate';
import { useWallets } from '../../hooks/useWallets';
import { ROUTES } from '../../urls';
import { clickHeaderRight } from '../../utils/clickHeader';
import { NFTThumbnail } from '../home/NFTs/NFTThumbnail';

import { ChainInput } from './ChainInput';
import { ContactAction, ContactPrompt } from './ContactPrompt';
import { NavbarContactButton } from './NavbarContactButton';
import { ReviewSheet } from './ReviewSheet';
import { SendTokenInput } from './SendTokenInput';
import { ToAddressInput } from './ToAddressInput';
import { ValueInput } from './ValueInput';

interface ChildInputAPI {
  blur: () => void;
  focus: () => void;
  isFocused?: () => boolean;
}

export interface GasTokenInput {
  name: string;
  standardizedTokenId?: string;
  isDefault: boolean;
  url?: string;
}

export interface OperationSetStatus {
  allOperationStatuses?: OperationStatus[];
  finalTransactionStatus?: OperationStatus;
  statusSummary: OperationStatusType;
}

export function Send() {
  const [waitingForDevice, setWaitingForDevice] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [contactSaveAction, setSaveContactAction] = useState<{
    show: boolean;
    action: ContactAction;
  }>({ show: false, action: 'save' });
  const [toAddressDropdownOpen, setToAddressDropdownOpen] = useState(false);

  const navigate = useRainbowNavigate();
  const { currentAddress: address } = useCurrentAddressStore();

  const isContact = useContactsStore.use.isContact();
  const { allWallets } = useWallets();
  const { hidden } = useHiddenAssetStore();
  const [urlSearchParams] = useSearchParams();

  const [operationSetStatus, setOperationSetStatus] = useState<
    OperationSetStatus | undefined
  >(undefined);

  const [selectedGasToken, setSelectedGasToken] = useState<GasTokenInput>({
    name: 'no gas abstraction',
    standardizedTokenId: undefined,
    isDefault: true,
  });

  const { testnetMode } = useTestnetModeStore();
  const { blockchains } = useGetBlockchains(testnetMode);

  const queryToAddress = urlSearchParams.get('to');
  const validatedQueryToAddress = isAddress(queryToAddress as Address)
    ? queryToAddress
    : null;

  const isHidden = useCallback(
    (asset: ParsedUserAsset) => {
      return !!hidden[address]?.[computeUniqueIdForHiddenAsset(asset)];
    },
    [address, hidden],
  );

  const isMyWallet = (address: Address) =>
    allWallets?.some((w) => w.address === address);

  const { connectedToHardhat, connectedToHardhatOp } =
    useConnectedToHardhatStore();

  const {
    asset,
    selectAssetAddressAndChain,
    setSelectedAssetAddress,
    setSelectedAssetChain,
    chainId,
    assets,
    setSortMethod,
    sortMethod,
    portfolio,
  } = useSendAsset();

  const unhiddenAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (chainId) {
          return (
            !isHidden(asset) &&
            asset.relatedChainIds?.includes(chainId.toString())
          );
        }

        return !isHidden(asset);
      }),
    [assets, isHidden, chainId],
  );

  const { nft, collections, nftSortMethod, setNftSortMethod, selectNft } =
    useSendUniqueAsset();

  const selectedGas = useGasStore.use.selectedGas();
  const clearCustomGasModified = useGasStore.use.clearCustomGasModified();

  const { selectedNft, setSelectedNft } = useSelectedNftStore();
  const { selectedToken, setSelectedToken } = useSelectedTokenStore();
  const { trackShortcut } = useKeyboardAnalytics();

  const toAddressInputRef = useRef<ChildInputAPI>(null);
  const sendTokenInputRef = useRef<ChildInputAPI>(null);
  const valueInputRef = useRef<ChildInputAPI>(null);

  const {
    assetAmount,
    rawMaxAssetBalanceAmount,
    independentAmount,
    independentField,
    independentFieldRef,
    dependentAmountDisplay,
    independentAmountDisplay,
    setIndependentAmount,
    switchIndependentField,
    setMaxAssetAmount,
  } = useSendInputs({ asset, selectedGas });

  const {
    currentCurrency,
    maxAssetBalanceParams,
    data,
    fromAddress,
    toAddress,
    toAddressOrName,
    toEnsName,
    txToAddress,
    value,
    setToAddressOrName,
  } = useSendState({ assetAmount, rawMaxAssetBalanceAmount, asset, nft });

  const controls = useAnimationControls();
  const transactionRequestForGas: TransactionRequest = useMemo(() => {
    if (nft) {
      return {
        to: nft.asset_contract.address,
        from: fromAddress,
        data,
      };
    }
    return {
      to: txToAddress,
      from: fromAddress,
      value,
      chainId,
      data,
      ...maxAssetBalanceParams,
    };
  }, [
    txToAddress,
    fromAddress,
    value,
    chainId,
    data,
    maxAssetBalanceParams,
    nft,
  ]);

  const handleToAddressChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setToAddressOrName(e.target.value);
    },
    [setToAddressOrName],
  );

  const clearToAddress = useCallback(
    () => setToAddressOrName(''),
    [setToAddressOrName],
  );

  const closeReviewSheet = useCallback(() => setShowReviewSheet(false), []);

  const {
    sendAddress,
    sendAmount,
    sendField,
    sendTokenAddressAndChain,
    resetSendValues,
    saveSendTokenAddressAndChain,
  } = usePopupInstanceStore();

  const activeChainId = chainIdToUse(
    connectedToHardhat,
    connectedToHardhatOp,
    chainId ?? 0, // TODO(felix): this should be 1
  );

  const { flashbotsEnabled } = useFlashbotsEnabledStore();
  const flashbotsEnabledGlobally =
    config.flashbots_enabled &&
    flashbotsEnabled &&
    asset?.chainId === ChainId.mainnet;

  const buildNftAssetObject = useCallback((nft: UniqueAsset) => {
    return {
      address: (nft.asset_contract.address || '') as AddressOrEth,
      chainId: chainNameToIdMapping[nft.network],
      chainName: nft.network,
      isNativeAsset: false,
      name: nft.name,
      symbol: nft.collection.name,
      uniqueId: `${nft.asset_contract.address || ''}_${
        chainNameToIdMapping[nft.network]
      }`,
      decimals: 0,
      native: {
        price: {
          amount: 0,
          change: '',
          display: '$0.00',
        },
      },
    } as ParsedAsset;
  }, []);

  const buildPendingTransaction = useCallback(
    (result: TransactionResponse) => {
      return {
        changes: [
          nft
            ? { direction: 'out', asset: buildNftAssetObject(nft) }
            : {
                direction: 'out',
                asset,
                value: assetAmount,
              },
        ],
        asset: nft ? buildNftAssetObject(nft) : asset,
        data: result.data,
        flashbots: flashbotsEnabledGlobally,
        value: result.value.toString(),
        from: fromAddress,
        to: txToAddress,
        hash: result.hash as TxHash,
        chainId: activeChainId,
        status: 'pending',
        type: 'send',
        nonce: result.nonce,
        gasPrice: (
          selectedGas.transactionGasParams as TransactionLegacyGasParams
        )?.gasPrice,
        maxFeePerGas: (selectedGas.transactionGasParams as TransactionGasParams)
          ?.maxFeePerGas,
        maxPriorityFeePerGas: (
          selectedGas.transactionGasParams as TransactionGasParams
        )?.maxPriorityFeePerGas,
      } as NewTransaction;
    },
    [
      activeChainId,
      asset,
      assetAmount,
      buildNftAssetObject,
      flashbotsEnabledGlobally,
      fromAddress,
      nft,
      selectedGas.transactionGasParams,
      txToAddress,
    ],
  );

  const { accountCluster, baseMainnetClient } = useOrby();

  const to = useMemo(() => {
    if (nft) {
      return nft.asset_contract.address;
    }

    return txToAddress;
  }, [nft, txToAddress]);

  const { operations, operationSet, virtualNode, aggregateFee, isLoading } =
    useGetOperationsToExecuteTransaction(
      fromAddress as string,
      activeChainId ? BigInt(activeChainId as number) : undefined,
      to,
      data as string,
      value ? BigInt(value.toString()) : undefined,
      selectedGasToken.standardizedTokenId
        ? { standardizedTokenId: selectedGasToken.standardizedTokenId }
        : undefined,
    );

  const {
    buttonLabel,
    isValidToAddress,
    readyForReview,
    validateToAddress,
    toAddressIsSmartContract,
  } = useSendValidations({
    asset,
    assetAmount,
    nft,
    selectedGas,
    toAddress,
    toAddressOrName,
    operationSet,
    isLoading,
  });

  const openReviewSheet = useCallback(() => {
    if (readyForReview) {
      setShowReviewSheet(true);
    } else {
      controls.start({
        rotate: [1, -1.4, 0, 1, -1.4, 0],
        transition: { duration: 0.2 },
      });
      independentFieldRef?.current?.focus();
    }
  }, [readyForReview, controls, independentFieldRef]);

  const operationStatusesUpdated = useCallback(
    (
      statusSummary: OperationStatusType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _finalTransactionStatus?: OperationStatus,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _statuses?: OperationStatus[],
    ) => {
      if (
        operations &&
        [OperationStatusType.SUCCESSFUL, OperationStatusType.PENDING].includes(
          statusSummary,
        )
      ) {
        const finalTransaction = operations[operations.length - 1];

        navigate(ROUTES.HOME, {
          state: { tab: 'activity' },
        });
        // callback?.();
        analytics.track(event.sendSubmitted, {
          assetSymbol: asset?.symbol,
          assetName: asset?.name,
          assetAddress: asset?.address,
          assetAmount,
          chainId: Number(finalTransaction.chainId ?? 0),
        });
      }
    },
    [
      asset?.address,
      asset?.name,
      asset?.symbol,
      assetAmount,
      navigate,
      operations,
    ],
  );

  const handleSend = useCallback(
    async (callback?: () => void) => {
      if (!config.send_enabled) return;

      try {
        if (
          asset &&
          operations &&
          accountCluster &&
          operationSet &&
          virtualNode
        ) {
          setOperationSetStatus({
            statusSummary: OperationStatusType.PENDING,
            finalTransactionStatus: {
              type: OperationType.FINAL_TRANSACTION,
              status: OperationStatusType.WAITING_PRECONDITION,
              errorReason: '',
            },
          });

          const { type } = await getWallet(fromAddress);
          // Change the label while we wait for confirmation
          if (type === 'HardwareWalletKeychain') {
            setWaitingForDevice(true);
          }
          resetSendValues();

          const { operationResponses, primaryOperationStatus } =
            await virtualNode.sendOperationSet(
              accountCluster.accountClusterId,
              operationSet,
              signOperation,
            );

          setOperationSetStatus({
            allOperationStatuses: operationResponses,
            finalTransactionStatus: primaryOperationStatus,
            statusSummary: OperationStatusType.PENDING,
          });

          const ids = operationResponses
            ?.map((op) => op.id)
            .filter((id) => !_.isUndefined(id));
          baseMainnetClient?.subscribeToOperationStatuses(
            ids,
            operationStatusesUpdated,
          );
        } else if (nft) {
          const { type } = await getWallet(fromAddress);
          // Change the label while we wait for confirmation
          if (type === 'HardwareWalletKeychain') {
            setWaitingForDevice(true);
          }
          resetSendValues();
          const result = await sendTransaction({
            from: fromAddress,
            to: nft.asset_contract.address,
            chainId: activeChainId,
            data,
          });

          if (result && nft && chainId) {
            const transaction: NewTransaction = buildPendingTransaction(result);
            addNewTransaction({
              address: fromAddress,
              chainId: activeChainId,
              transaction,
            });
            callback?.();
            navigate(ROUTES.HOME, {
              state: { tab: 'activity' },
            });
            analytics.track(event.sendSubmitted, {
              assetSymbol: nft.collection.name,
              assetName: nft.name,
              assetAddress: nft.asset_contract.address,
              assetAmount: '0',
              chainId,
            });
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!isLedgerConnectionError(e)) {
          const extractedError = (e as Error).message.split('[')[0];
          triggerAlert({
            text: i18n.t('errors.sending_transaction'),
            description: extractedError,
          });
        }
        logger.error(new RainbowError('send: error executing send'), {
          message: (e as Error)?.message,
        });
      } finally {
        setWaitingForDevice(false);
      }
    },
    [
      asset,
      operations,
      accountCluster,
      operationSet,
      virtualNode,
      nft,
      fromAddress,
      resetSendValues,
      operationStatusesUpdated,
      baseMainnetClient,
      chainId,
      buildPendingTransaction,
      activeChainId,
      data,
      navigate,
    ],
  );

  const selectAsset = useCallback(
    (address: AddressOrEth | '', chainId: ChainId) => {
      selectAssetAddressAndChain(address, chainId);
      saveSendTokenAddressAndChain({
        address,
        chainId,
      });
      setIndependentAmount('');
      setTimeout(() => {
        valueInputRef?.current?.focus();
      }, 300);
    },
    [
      saveSendTokenAddressAndChain,
      selectAssetAddressAndChain,
      setIndependentAmount,
    ],
  );

  const onSelectAssetAddressAndChain = useCallback(
    (asset?: ParsedUserAsset | null) => {
      if (asset) {
        const token = portfolio
          ?.find((sBalance) => sBalance.standardizedTokenId == asset?.uniqueId)
          ?.tokenBalancesOnChains.find(
            (tBalance) => chainId && tBalance.token.chainId == BigInt(chainId),
          )?.token;

        if (token) {
          selectAsset(token?.address as Address, Number(token.chainId));
        }
      } else {
        setSelectedAssetAddress('');
      }
    },
    [chainId, portfolio, selectAsset, setSelectedAssetAddress],
  );

  useEffect(() => {
    return () => {
      clearCustomGasModified();
    };
  }, [clearCustomGasModified]);

  const { explainerSheetParams, showExplainerSheet, hideExplainerSheet } =
    useExplainerSheetParams();

  const showToContractExplainer = useCallback(() => {
    showExplainerSheet({
      show: true,
      title: i18n.t('explainers.send.to_smart_contract.title'),
      description: [
        i18n.t('explainers.send.to_smart_contract.description_1'),
        i18n.t('explainers.send.to_smart_contract.description_2'),
        i18n.t('explainers.send.to_smart_contract.description_3'),
      ],
      actionButton: {
        label: i18n.t('explainers.send.action_label'),
        variant: 'tinted',
        labelColor: 'blue',
        action: hideExplainerSheet,
      },
      header: { emoji: '✋' },
    });
  }, [hideExplainerSheet, showExplainerSheet]);

  useEffect(() => {
    const token = portfolio
      ?.find(
        (sBalance) => sBalance.standardizedTokenId == selectedToken?.uniqueId,
      )
      ?.tokenBalancesOnChains.find(
        (tBalance) => chainId && tBalance.token.chainId == BigInt(chainId),
      )?.token;

    // navigating from token row
    if (token) {
      selectAsset(token?.address as Address, Number(token.chainId));
      // clear selected token
      setSelectedToken();
    } else if (selectedNft) {
      // clear any saved token amounts
      setIndependentAmount('');
      // navigating from nft details
      selectNft(selectedNft);
      // clear selected nft
      setSelectedNft();
    } else if (sendTokenAddressAndChain) {
      selectAsset(
        sendTokenAddressAndChain.address,
        sendTokenAddressAndChain.chainId,
      );
    }

    if (validatedQueryToAddress) {
      setToAddressOrName(validatedQueryToAddress);
    } else if (sendAddress && sendAddress.length) {
      setToAddressOrName(sendAddress);
    }
    if (sendField !== independentField) {
      switchIndependentField();
    }
    if (sendAmount) {
      setIndependentAmount(sendAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevToAddressIsSmartContract = usePrevious(toAddressIsSmartContract);
  useEffect(() => {
    if (
      !prevToAddressIsSmartContract &&
      toAddressIsSmartContract &&
      !toEnsName?.includes('argent.xyz')
    ) {
      showToContractExplainer();
    }
  }, [
    prevToAddressIsSmartContract,
    showToContractExplainer,
    toAddressIsSmartContract,
    toEnsName,
  ]);

  useKeyboardShortcut({
    handler: (e: KeyboardEvent) => {
      if (!explainerSheetParams.show && !contactSaveAction.show) {
        if (e.altKey) {
          if (e.key === shortcuts.send.FOCUS_TO_ADDRESS.key) {
            trackShortcut({
              key: shortcuts.send.FOCUS_TO_ADDRESS.display,
              type: 'send.focusToAddress',
            });
            toAddressInputRef?.current?.focus();
            sendTokenInputRef?.current?.blur();
          }
          if (e.key === shortcuts.send.FOCUS_ASSET.key) {
            trackShortcut({
              key: shortcuts.send.FOCUS_ASSET.display,
              type: 'send.focusAsset',
            });
            toAddressInputRef?.current?.blur();
            sendTokenInputRef.current?.focus();
          }
        } else {
          if (!toAddressInputRef.current?.isFocused?.()) {
            if (e.key === shortcuts.send.SET_MAX_AMOUNT.key) {
              trackShortcut({
                key: shortcuts.send.SET_MAX_AMOUNT.display,
                type: 'send.setMax',
              });
              setMaxAssetAmount();
            }
            if (e.key === shortcuts.send.SWITCH_CURRENCY_LABEL.key) {
              trackShortcut({
                key: shortcuts.send.SWITCH_CURRENCY_LABEL.display,
                type: 'send.switchCurrency',
              });
              switchIndependentField();
            }
          }
          if (
            e.key === shortcuts.send.OPEN_CONTACT_MENU.key &&
            !valueInputRef.current?.isFocused?.()
          ) {
            trackShortcut({
              key: shortcuts.send.OPEN_CONTACT_MENU.display,
              type: 'send.openContactMenu',
            });
            clickHeaderRight();
          }
        }
      }
    },
  });

  const assetAccentColor =
    nft?.predominantColor || asset?.colors?.primary || asset?.colors?.fallback;

  return (
    <>
      <ExplainerSheet
        show={explainerSheetParams.show}
        header={explainerSheetParams.header}
        title={explainerSheetParams.title}
        description={explainerSheetParams.description}
        actionButton={explainerSheetParams.actionButton}
      />
      {toAddress && (
        <>
          <ContactPrompt
            address={toAddress}
            show={contactSaveAction?.show}
            action={contactSaveAction?.action}
            onSaveContactAction={setSaveContactAction}
            handleClose={() =>
              setSaveContactAction({ show: false, action: 'save' })
            }
          />
          <AccentColorProvider color={assetAccentColor}>
            <ReviewSheet
              show={showReviewSheet}
              onCancel={closeReviewSheet}
              operationSet={operationSet}
              onSend={handleSend}
              toAddress={toAddress}
              asset={asset}
              nft={nft}
              primaryAmountDisplay={independentAmountDisplay.display}
              secondaryAmountDisplay={dependentAmountDisplay.display}
              onSaveContactAction={setSaveContactAction}
              waitingForDevice={waitingForDevice}
              operationSetStatus={operationSetStatus}
            />
          </AccentColorProvider>
        </>
      )}
      <Navbar
        title={i18n.t('send.title')}
        background={'surfaceSecondary'}
        leftComponent={<Navbar.CloseButton />}
        rightComponent={
          !toAddress || isMyWallet(toAddress) ? undefined : (
            <CursorTooltip
              align="end"
              arrowAlignment="right"
              arrowCentered
              text={i18n.t('tooltip.save_to_contacts')}
              textWeight="bold"
              textSize="12pt"
              textColor="labelSecondary"
              arrowDirection={'up'}
            >
              <NavbarContactButton
                onSaveAction={setSaveContactAction}
                toAddress={toAddress}
                action={isContact({ address: toAddress }) ? 'edit' : 'save'}
                enabled={!!toAddress}
                chainId={asset?.chainId}
              />
            </CursorTooltip>
          )
        }
      />
      <Box
        background="surfaceSecondary"
        style={{ height: 535 }}
        paddingBottom="20px"
        paddingHorizontal="12px"
      >
        <Rows space="8px" alignVertical="top">
          <Rows space="8px" alignVertical="top">
            <Row height="content">
              <ToAddressInput
                toAddress={toAddress}
                toEnsName={toEnsName}
                toAddressOrName={toAddressOrName}
                queryToAddress={validatedQueryToAddress}
                clearToAddress={clearToAddress}
                handleToAddressChange={handleToAddressChange}
                setToAddressOrName={setToAddressOrName}
                onDropdownOpen={setToAddressDropdownOpen}
                validateToAddress={validateToAddress}
                ref={toAddressInputRef}
              />
            </Row>

            <Row height="content">
              <ChainInput
                availableChains={blockchains}
                selectedChain={blockchains?.find(
                  (c) => Number(c.chainId) === chainId,
                )}
                onSelectChain={(chain) =>
                  setSelectedAssetChain(
                    chain?.chainId ? Number(chain.chainId) : undefined,
                  )
                }
                onDropdownOpen={() => {}}
                onClearSelection={() => setSelectedAssetChain(undefined)}
              />
            </Row>

            <Row height="content">
              <AccentColorProvider color={assetAccentColor}>
                <Box
                  background="surfaceSecondaryElevated"
                  borderRadius="24px"
                  width="full"
                >
                  <SendTokenInput
                    asset={asset}
                    assets={unhiddenAssets}
                    selectAssetAddressAndChain={onSelectAssetAddressAndChain}
                    dropdownClosed={toAddressDropdownOpen}
                    setSortMethod={setSortMethod}
                    sortMethod={sortMethod}
                    ref={sendTokenInputRef}
                    nft={nft}
                    collections={collections}
                    nftSortMethod={nftSortMethod}
                    setNftSortMethod={setNftSortMethod}
                    selectNft={selectNft}
                  />
                  {asset ? (
                    <ValueInput
                      asset={asset}
                      currentCurrency={currentCurrency}
                      dependentAmount={dependentAmountDisplay}
                      independentAmount={independentAmount}
                      independentField={independentField}
                      independentFieldRef={independentFieldRef}
                      setIndependentAmount={setIndependentAmount}
                      setMaxAssetAmount={setMaxAssetAmount}
                      switchIndependentField={switchIndependentField}
                      inputAnimationControls={controls}
                      ref={valueInputRef}
                    />
                  ) : null}
                </Box>
              </AccentColorProvider>
            </Row>
          </Rows>

          {nft && (
            <Row>
              <Box paddingBottom="14px">
                <Columns alignHorizontal="center">
                  <Column width="content">
                    <NFTThumbnail
                      size={232}
                      imageSrc={getUniqueAssetImageThumbnailURL(nft)}
                      placeholderSrc={getUniqueAssetImagePreviewURL(nft)}
                      borderRadius="16px"
                      index={0}
                    />
                  </Column>
                </Columns>
              </Box>
            </Row>
          )}

          <Row height="content">
            {isValidToAddress && (!!asset || !!nft) && chainId ? (
              <AccentColorProvider color={assetAccentColor}>
                <Box paddingHorizontal="8px">
                  <Rows space="20px">
                    <Row>
                      <TransactionFee
                        disableShortcuts={contactSaveAction.show}
                        chainId={chainId}
                        transactionRequest={transactionRequestForGas}
                        accentColor={assetAccentColor}
                        flashbotsEnabled={flashbotsEnabledGlobally}
                        selectedGasToken={selectedGasToken}
                        setSelectedGasToken={(token) => {
                          if (token) {
                            setSelectedGasToken(token);
                          }
                        }}
                        aggregateFee={aggregateFee}
                      />
                    </Row>
                    <Row>
                      <Button
                        onClick={openReviewSheet}
                        height="44px"
                        variant="flat"
                        color="accent"
                        width="full"
                        testId="send-review-button"
                        tabIndex={0}
                      >
                        <Inline space="8px" alignVertical="center">
                          {readyForReview && (
                            <Symbol
                              symbol="doc.text.magnifyingglass"
                              weight="bold"
                              size={16}
                            />
                          )}
                          <Text color="label" size="16pt" weight="bold">
                            {buttonLabel}
                          </Text>
                        </Inline>
                      </Button>
                    </Row>
                  </Rows>
                </Box>
              </AccentColorProvider>
            ) : (
              <Box paddingHorizontal="8px">
                <Button
                  height="44px"
                  variant="flat"
                  color="surfaceSecondary"
                  width="full"
                  disabled
                >
                  <Text color="labelQuaternary" size="14pt" weight="bold">
                    {buttonLabel}
                  </Text>
                </Button>
              </Box>
            )}
          </Row>
        </Rows>
      </Box>
    </>
  );
}
