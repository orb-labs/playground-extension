import { AddressZero } from '@ethersproject/constants';
import { usePortfolio } from '@orb-labs/orby-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MotionValue, motion, useTransform } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Address } from 'viem';

import { i18n } from '~/core/languages';
import { supportedCurrencies } from '~/core/references';
import { shortcuts } from '~/core/references/shortcuts';
import { fetchProviderWidgetUrl } from '~/core/resources/f2c';
import { FiatProviderName } from '~/core/resources/f2c/types';
import { useCurrentAddressStore, useCurrentCurrencyStore } from '~/core/state';
import { useCurrentThemeStore } from '~/core/state/currentSettings/currentTheme';
import { useHideAssetBalancesStore } from '~/core/state/currentSettings/hideAssetBalances';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';
import { usePinnedAssetStore } from '~/core/state/pinnedAssets';
import { ParsedUserAsset } from '~/core/types/assets';
import { truncateAddress } from '~/core/utils/address';
import { getCustomChainIconUrl } from '~/core/utils/assets';
import { isCustomChain } from '~/core/utils/chains';
import { convertStandardizedBalanceToParsedUserAssets } from '~/core/utils/orb';
import {
  Box,
  Column,
  Columns,
  Inline,
  Inset,
  Stack,
  Symbol,
  Text,
} from '~/design-system';
import { TextOverflow } from '~/design-system/components/TextOverflow/TextOverflow';
import { CoinRow } from '~/entries/popup/components/CoinRow/CoinRow';

import { Asterisks } from '../../components/Asterisks/Asterisks';
import { CoinbaseIcon } from '../../components/CoinbaseIcon/CoinbaseIcon';
import ExternalImage from '../../components/ExternalImage/ExternalImage';
import { QuickPromo } from '../../components/QuickPromo/QuickPromo';
import useKeyboardAnalytics from '../../hooks/useKeyboardAnalytics';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useSystemSpecificModifierKey } from '../../hooks/useSystemSpecificModifierKey';
import { useTokensShortcuts } from '../../hooks/useTokensShortcuts';

import { TokensSkeleton } from './Skeletons';
import { TokenContextMenu } from './TokenDetails/TokenContextMenu';
import { TokenMarkedHighlighter } from './TokenMarkedHighlighter';

const TokenRow = memo(function TokenRow({
  token,
  testId,
  onClickAsset,
}: {
  token: ParsedUserAsset;
  testId: string;
  onClickAsset: (standardizedTokenId?: string) => void;
}) {
  const openDetails = () => {
    onClickAsset(token.standardizedTokenId);
  };

  const isParent = useMemo(
    () => token?.relatedAssets && token?.relatedAssets.length > 0,
    [token],
  );

  return (
    <Box
      as={motion.div}
      whileTap={{ scale: 0.98 }}
      width="full"
      layoutScroll
      layout="position"
    >
      <TokenContextMenu token={token}>
        {isParent ? (
          <Box onClick={openDetails}>
            <AssetRow asset={token} testId={testId} />
          </Box>
        ) : (
          <Box onClick={openDetails} paddingLeft="16px">
            <AssetRow asset={token} testId={testId} />
          </Box>
        )}
      </TokenContextMenu>
    </Box>
  );
});

export function Tokens({ scrollY }: { scrollY: MotionValue<number> }) {
  const { currentAddress } = useCurrentAddressStore();
  const [manuallyRefetchingTokens, setManuallyRefetchingTokens] =
    useState(false);
  const { trackShortcut } = useKeyboardAnalytics();
  const { modifierSymbol } = useSystemSpecificModifierKey();
  const { pinned: pinnedStore } = usePinnedAssetStore();

  const [combinedAssets, setCombinedAssets] = useState<ParsedUserAsset[]>([]);
  const [isInCombinedList, setIsInCombinedList] = useState<
    Map<string, boolean>
  >(new Map<string, boolean>());

  const containerRef = useRef<HTMLDivElement>(null);

  const overflow = useTransform(scrollY, (p) => (p > 92 ? 'auto' : 'hidden'));

  const { testnetMode } = useTestnetModeStore();
  const { portfolio, isLoading } = usePortfolio(testnetMode);

  useEffect(() => {
    if (!portfolio) {
      return;
    }

    setCombinedAssets(convertStandardizedBalanceToParsedUserAssets(portfolio));
  }, [portfolio]);

  const onCombineLists = useCallback(
    (standardizedTokenId?: string) => {
      if (!standardizedTokenId) {
        return;
      }

      const index = combinedAssets.findIndex(
        (asset) => asset.uniqueId == standardizedTokenId,
      );

      const parentAsset = combinedAssets[index];

      if (isInCombinedList.get(standardizedTokenId) == true) {
        combinedAssets.splice(index + 1, parentAsset.relatedAssets!.length);
      } else {
        combinedAssets.splice(index + 1, 0, ...parentAsset.relatedAssets!);
      }

      setIsInCombinedList((prev) => {
        prev.set(
          standardizedTokenId,
          !isInCombinedList.get(standardizedTokenId),
        );
        return prev;
      });

      setCombinedAssets([...combinedAssets]);
    },
    [combinedAssets, isInCombinedList],
  );

  const assetsRowVirtualizer = useVirtualizer({
    count: combinedAssets.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 10,
    paddingEnd: 64,
    paddingStart: 8,
    // getItemKey: (index) => combinedAssets[index].uniqueId,
  });

  useKeyboardShortcut({
    handler: async (e: KeyboardEvent) => {
      if (e.key === shortcuts.tokens.REFRESH_TOKENS.key) {
        trackShortcut({
          key: shortcuts.tokens.REFRESH_TOKENS.display,
          type: 'tokens.refresh',
        });
        setManuallyRefetchingTokens(true);
        setManuallyRefetchingTokens(false);
      }
    },
    condition: () => !manuallyRefetchingTokens,
  });

  useTokensShortcuts();

  useEffect(() => {
    assetsRowVirtualizer?.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedAssets?.length]);

  if (isLoading || !portfolio || manuallyRefetchingTokens) {
    return <TokensSkeleton />;
  }

  if (!combinedAssets?.length) {
    return <TokensEmptyState depositAddress={currentAddress} />;
  }

  return (
    <Box
      as={motion.div}
      width="full"
      style={{
        maxHeight: `1200px`,
        overflow: overflow,
      }}
      ref={containerRef}
      paddingBottom="8px"
    >
      <QuickPromo
        text={i18n.t('command_k.quick_promo.text', { modifierSymbol })}
        textBold={i18n.t('command_k.quick_promo.text_bold')}
        style={{
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 10,
        }}
        symbol="sparkle"
        symbolColor="accent"
        promoType="command_k"
      />
      <Box
        width="full"
        style={{
          height: `${assetsRowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        <Box>
          {assetsRowVirtualizer.getVirtualItems().map((virtualItem) => {
            const { key, size, start, index } = virtualItem;
            const token = combinedAssets[index];
            const pinned =
              !!pinnedStore[currentAddress]?.[token.uniqueId]?.pinned;

            return (
              <Box
                key={`token-list-${token.uniqueId}-${key}`}
                layoutId={`token-list-${index}`}
                as={motion.div}
                position="absolute"
                width="full"
                style={{
                  height: size,
                  y: start,
                }}
              >
                {pinned && <TokenMarkedHighlighter />}
                <TokenRow
                  token={token}
                  testId={`coin-row-item-${index}`}
                  onClickAsset={onCombineLists}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

type AssetRowProps = {
  asset: ParsedUserAsset;
  testId?: string;
};

export const AssetRow = memo(function AssetRow({
  asset,
  testId,
}: AssetRowProps) {
  const name = asset?.name || asset?.symbol || truncateAddress(asset.address);
  const uniqueId = asset?.uniqueId;
  const { hideAssetBalances } = useHideAssetBalancesStore();
  const { currentCurrency } = useCurrentCurrencyStore();

  const isParent = useMemo(() => {
    if (!asset?.relatedAssets) {
      return false;
    }

    return asset.relatedAssets.length > 0;
  }, [asset]);

  const size = useMemo(() => {
    return isParent ? 36 : 24;
  }, [isParent]);

  const display = useMemo(() => {
    return isParent ? asset.balance.display : asset.balance.displayOnchain;
  }, [asset, isParent]);

  const balanceDisplay = useMemo(
    () =>
      hideAssetBalances ? (
        <Inline space="4px">
          <Asterisks color="labelTertiary" size={8} />
          <TextOverflow color="labelTertiary" size="12pt" weight="semibold">
            {asset?.symbol}
          </TextOverflow>
        </Inline>
      ) : (
        <TextOverflow color="labelTertiary" size="12pt" weight="semibold">
          {display}
        </TextOverflow>
      ),
    [display, asset?.symbol, hideAssetBalances],
  );

  const nativeBalanceDisplay = useMemo(
    () =>
      // eslint-disable-next-line no-nested-ternary
      hideAssetBalances ? (
        <Inline alignHorizontal="right">
          <TextOverflow size="14pt" weight="semibold" align="right">
            {supportedCurrencies[currentCurrency].symbol}
          </TextOverflow>
          <Asterisks color="label" size={10} />
        </Inline>
      ) : isCustomChain(asset.chainId) &&
        asset?.native?.balance?.amount === '0' ? null : (
        <Text size="14pt" weight="semibold" align="right">
          {asset?.native?.balance?.display}
        </Text>
      ),
    [
      hideAssetBalances,
      currentCurrency,
      asset.chainId,
      asset?.native?.balance?.amount,
      asset?.native?.balance?.display,
    ],
  );

  const topRow = useMemo(
    () => (
      <Columns>
        <Column>
          <Box paddingVertical="4px">
            <TextOverflow size="14pt" weight="semibold">
              {name}
            </TextOverflow>
          </Box>
        </Column>
        <Column width="content">
          <Box paddingVertical="4px">{nativeBalanceDisplay}</Box>
        </Column>
      </Columns>
    ),
    [name, nativeBalanceDisplay],
  );

  const chainsList = useMemo(() => {
    const tokenChains = asset.relatedAssets?.map((token) => {
      const src = getCustomChainIconUrl(token.chainId!, AddressZero);
      return (
        <ExternalImage
          key={token.uniqueId}
          src={src}
          width={16}
          height={16}
          borderRadius={0}
          style={{ padding: '2px' }}
        />
      );
    });

    return (
      <Box style={{ height: '12px', display: 'flex', flexDirection: 'row' }}>
        {tokenChains}
      </Box>
    );
  }, [asset]);

  const bottomRow = useMemo(
    () => (
      <Columns>
        <Column>
          <Box paddingVertical="4px" testId={`asset-name-${uniqueId}`}>
            {balanceDisplay}
          </Box>
        </Column>
        <Column width="content">{chainsList}</Column>
      </Columns>
    ),
    [balanceDisplay, chainsList, uniqueId],
  );

  return (
    <CoinRow
      testId={testId}
      asset={asset}
      topRow={topRow}
      bottomRow={bottomRow}
      size={size}
      isParent={isParent}
    />
  );
});

type EmptyStateProps = {
  depositAddress: Address;
};

function TokensEmptyState({ depositAddress }: EmptyStateProps) {
  const { currentTheme } = useCurrentThemeStore();
  const { testnetMode } = useTestnetModeStore();
  const handleCoinbase = useCallback(async () => {
    const { data } = await fetchProviderWidgetUrl({
      provider: FiatProviderName.Coinbase,
      depositAddress,
      defaultExperience: 'send',
    });
    window.open(data.url, '_blank');
  }, [depositAddress]);

  return (
    <Inset horizontal="20px" top="20px">
      <Stack space="12px">
        {!testnetMode && (
          <Box
            background="surfaceSecondaryElevated"
            borderRadius="16px"
            boxShadow="12px"
            cursor="pointer"
            onClick={handleCoinbase}
            style={{ overflow: 'hidden' }}
          >
            <Box
              background={{ default: 'transparent', hover: 'fillQuaternary' }}
              cursor="pointer"
              height="full"
              padding="16px"
              width="full"
            >
              <Stack space="12px">
                <Inline alignVertical="center" alignHorizontal="justify">
                  <Box>
                    <Inline alignVertical="center" space="7px">
                      <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="center"
                        style={{ height: 12, width: 18 }}
                      >
                        <CoinbaseIcon showBackground />
                      </Box>
                      <Text
                        as="p"
                        cursor="pointer"
                        size="14pt"
                        color="label"
                        weight="bold"
                      >
                        {i18n.t('tokens_tab.coinbase_title')}
                      </Text>
                    </Inline>
                  </Box>
                  <Symbol
                    cursor="pointer"
                    size={12}
                    symbol="arrow.up.forward.circle"
                    weight="semibold"
                    color="labelTertiary"
                  />
                </Inline>
                <Box alignItems="center" display="flex" style={{ height: 10 }}>
                  <Text
                    as="p"
                    cursor="pointer"
                    size="11pt"
                    color="labelTertiary"
                    weight="bold"
                  >
                    {i18n.t('tokens_tab.coinbase_description')}
                  </Text>
                </Box>
              </Stack>
            </Box>
          </Box>
        )}

        {!testnetMode && (
          <Box
            borderRadius="16px"
            padding="16px"
            style={{
              boxShadow: `0 0 0 1px ${
                currentTheme === 'dark'
                  ? 'rgba(245, 248, 255, 0.025)'
                  : 'rgba(9, 17, 31, 0.03)'
              } inset`,
            }}
          >
            <Stack space="12px">
              <Inline alignVertical="center" space="7px">
                <Box
                  alignItems="center"
                  display="flex"
                  justifyContent="center"
                  style={{ height: 12, width: 18 }}
                >
                  <Symbol
                    color="accent"
                    size={16}
                    symbol="creditcard.fill"
                    weight="bold"
                  />
                </Box>
                <Text as="p" size="14pt" color="label" weight="bold">
                  {i18n.t('tokens_tab.buy_title')}
                </Text>
              </Inline>
              <Box alignItems="center" display="flex" style={{ height: 10 }}>
                <Text as="p" size="11pt" color="labelTertiary" weight="bold">
                  {i18n.t('tokens_tab.buy_description_1')}
                  <Box
                    background="fillTertiary"
                    as="span"
                    borderWidth="1px"
                    borderColor="separatorTertiary"
                    boxShadow="1px"
                    style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '14px',
                      borderRadius: '4.5px',
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      lineHeight: '12px',
                      marginLeft: '4px',
                      marginRight: '4px',
                    }}
                  >
                    {shortcuts.home.BUY.display}
                  </Box>
                  {i18n.t('tokens_tab.buy_description_2')}
                </Text>
              </Box>
            </Stack>
          </Box>
        )}

        <Box
          borderRadius="16px"
          padding="16px"
          style={{
            boxShadow: `0 0 0 1px ${
              currentTheme === 'dark'
                ? 'rgba(245, 248, 255, 0.025)'
                : 'rgba(9, 17, 31, 0.03)'
            } inset`,
          }}
        >
          <Stack space="12px">
            <Inline alignVertical="center" space="7px">
              <Box
                alignItems="center"
                display="flex"
                justifyContent="center"
                paddingLeft="2px"
                style={{ height: 12, width: 18 }}
              >
                <Symbol
                  color="accent"
                  size={14.5}
                  symbol="arrow.turn.right.down"
                  weight="bold"
                />
              </Box>
              <Text as="p" size="14pt" color="label" weight="bold">
                {i18n.t('tokens_tab.send_from_wallet')}
              </Text>
            </Inline>
            <Box alignItems="center" display="flex" style={{ height: 10 }}>
              <Text as="p" size="11pt" color="labelTertiary" weight="bold">
                {i18n.t('tokens_tab.send_description_1')}
                <Box
                  background="fillTertiary"
                  as="span"
                  borderWidth="1px"
                  borderColor="separatorTertiary"
                  boxShadow="1px"
                  style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '14px',
                    borderRadius: '4.5px',
                    verticalAlign: 'middle',
                    textAlign: 'center',
                    lineHeight: '12px',
                    marginLeft: '4px',
                    marginRight: '4px',
                  }}
                >
                  {shortcuts.home.COPY_ADDRESS.display}
                </Box>
                {i18n.t('tokens_tab.send_description_2')}
                <Box
                  background="fillTertiary"
                  as="span"
                  borderWidth="1px"
                  borderColor="separatorTertiary"
                  boxShadow="1px"
                  style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '14px',
                    borderRadius: '4.5px',
                    verticalAlign: 'middle',
                    textAlign: 'center',
                    lineHeight: '12px',
                    marginLeft: '4px',
                    marginRight: '4px',
                  }}
                >
                  {shortcuts.home.GO_TO_QR.display}
                </Box>
                {i18n.t('tokens_tab.send_description_3')}
              </Text>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Inset>
  );
}
