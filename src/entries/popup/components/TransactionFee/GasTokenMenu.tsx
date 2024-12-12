import React, { useImperativeHandle, useRef } from 'react';

import { AddressOrEth } from '~/core/types/assets';
import { ChainId } from '~/core/types/chains';
import { Box, Inline, Symbol, Text } from '~/design-system';
import { Space } from '~/design-system/styles/designTokens';

import { GasTokenInput } from '../../pages/send';
import { simulateClick } from '../../utils/simulateClick';
import { CoinIcon } from '../CoinIcon/CoinIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../DropdownMenu/DropdownMenu';

const gasTokens: GasTokenInput[] = [
  {
    name: 'no gas abstraction',
    standardizedTokenId: undefined,
    isDefault: true,
  },
  {
    name: 'USDC',
    standardizedTokenId: 'sttkn_1e58ac683b9e4d28b1b4193f69c49d12',
    isDefault: false,
    url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
  },
  {
    name: 'WETH',
    standardizedTokenId: 'sttkn_fe26388df9394694ad49acb77547e334',
    isDefault: false,
    url: 'https://raw.githubusercontent.com/rainbow-me/assets/master/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png',
  },
];

export const SwitchGasTokenMenuSelector = ({
  selectedGasToken,
}: {
  selectedGasToken?: GasTokenInput;
  chainId: ChainId;
}) => {
  return (
    <>
      {gasTokens.map((gasToken, i) => {
        return (
          <DropdownMenuRadioItem
            value={gasToken.standardizedTokenId}
            key={i}
            selectedValue={selectedGasToken?.standardizedTokenId}
          >
            <Box>
              <Inline space="8px" alignVertical="center">
                {!gasToken.isDefault && (
                  <CoinIcon
                    asset={{
                      icon_url: gasToken?.url ?? '',
                      address: '' as AddressOrEth,
                      chainId: 1,
                      decimals: 0,
                      highLiquidity: false,
                      name: gasToken.name,
                      symbol: gasToken.name,
                      isNativeAsset: false,
                      isVerified: false,
                      mainnetAddress: gasToken.name as AddressOrEth,
                      networks: [],
                      uniqueId: gasToken.standardizedTokenId,
                    }}
                    size={18}
                  />
                )}
                <Text color="label" size="14pt" weight="medium">
                  {gasToken.name}
                </Text>
              </Inline>
            </Box>
            <DropdownMenuItemIndicator style={{ marginLeft: 'auto' }}>
              <Symbol weight="medium" symbol="checkmark" size={11} />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        );
      })}
    </>
  );
};

interface SwitchGasTokenMenuProps {
  selectedGasToken?: GasTokenInput;
  onGasTokenChanged?: (gasToken?: GasTokenInput) => void;
  accentColor?: string | 'accent';
  editable?: boolean;
  plainTriggerBorder?: boolean;
  dropdownContentMarginRight?: Space;
  chainId: ChainId;
}

export const SwitchGasTokenMenu = React.forwardRef<
  { open: () => void },
  SwitchGasTokenMenuProps
>(function SwitchGasTokenMenu(
  {
    dropdownContentMarginRight,
    selectedGasToken,
    editable = true,
    accentColor,
    onGasTokenChanged,
    chainId,
  }: SwitchGasTokenMenuProps,
  forwardedRef,
) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(forwardedRef, () => ({
    open: () => {
      simulateClick(triggerRef?.current);
    },
  }));

  const menuTrigger = (
    <Box
      style={{
        height: 28,
      }}
      paddingVertical="5px"
      paddingHorizontal="6px"
      borderRadius="24px"
      as="button"
      ref={triggerRef}
      tabIndex={editable ? 0 : -1}
    >
      <Inline space="6px" alignVertical="center">
        {!selectedGasToken?.isDefault && (
          <CoinIcon
            asset={{
              icon_url: selectedGasToken?.url ?? '',
              address: '' as AddressOrEth,
              chainId: 1,
              decimals: 0,
              highLiquidity: false,
              name: selectedGasToken?.name || '',
              symbol: selectedGasToken?.name || '',
              isNativeAsset: false,
              isVerified: false,
              mainnetAddress: selectedGasToken?.name as AddressOrEth,
              networks: [],
              uniqueId: selectedGasToken?.standardizedTokenId || '',
            }}
            size={18}
          />
        )}
        <Text color="label" weight="bold" size="14pt">
          {selectedGasToken?.name}
        </Text>

        {editable ? (
          <Symbol
            weight="medium"
            color="label"
            size={14}
            symbol="chevron.down.circle"
          />
        ) : null}
      </Inline>
    </Box>
  );
  if (!editable) return menuTrigger;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild accentColor={accentColor}>
        {menuTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        marginRight={dropdownContentMarginRight}
        accentColor={accentColor}
      >
        <DropdownMenuLabel>Gas Token</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedGasToken?.standardizedTokenId}
          onValueChange={(gasTokenId) => {
            onGasTokenChanged?.(
              gasTokens.find(
                (gasToken) => gasToken?.standardizedTokenId == gasTokenId,
              ),
            );
          }}
        >
          <SwitchGasTokenMenuSelector
            selectedGasToken={selectedGasToken}
            chainId={chainId}
          />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
