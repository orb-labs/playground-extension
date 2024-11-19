import React, { useImperativeHandle, useRef } from 'react';
import { Chain } from 'viem';

import { i18n } from '~/core/languages';
import { txSpeedEmoji } from '~/core/references/txSpeed';
import {
  GasFeeLegacyParamsBySpeed,
  GasFeeParamsBySpeed,
  GasSpeed,
} from '~/core/types/gas';
import { Box, Inline, Stack, Symbol, Text } from '~/design-system';
import { accentFocusVisibleStyle } from '~/design-system/components/Lens/Lens.css';
import { Space } from '~/design-system/styles/designTokens';
import { ChainBadge } from '../ChainBadge/ChainBadge';
import { CoinIcon } from '../CoinIcon/CoinIcon';

import { simulateClick } from '../../utils/simulateClick';
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
import { ChainId } from '~/core/types/chains';

const gasTokens = [
  {
    name: 'no gas abstraction',
    id: '-1', // this isn't used
    isDefault: true,
    // url is not used for default, instead we use the chain logo
  },
  {
    name: 'USDC',
    id: 'sttkn_1e58ac683b9e4d28b1b4193f69c49d12',
    isDefault: false,
    url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
  },
  {
    name: 'WETH',
    id: 'sttkn_fe26388df9394694ad49acb77547e334',
    isDefault: false,
    url: 'https://raw.githubusercontent.com/rainbow-me/assets/master/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png',
  },
];

export const SwitchGasTokenMenuSelector = ({
  selectedGasToken,
  chainId,
}: {
  selectedGasToken?: any;
  chainId: ChainId;
}) => {
  return (
    <>
      {gasTokens.map((gasToken, i) => {
        return (
          <DropdownMenuRadioItem
            value={gasToken.id}
            key={i}
            selectedValue={selectedGasToken.id}
          >
            <Box>
              <Inline space="8px" alignVertical="center">
                {!gasToken.isDefault && (
                  <CoinIcon asset={{ icon_url: gasToken.url }} size={18} />
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
  selectedGasToken?: any;
  onGasTokenChanged: (gasToken: any) => void;
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

  console.log('in gas token menu', selectedGasToken, chainId);

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
        {!selectedGasToken.isDefault && (
          <CoinIcon asset={{ icon_url: selectedGasToken.url }} size={18} />
        )}
        <Text color="label" weight="bold" size="14pt">
          {selectedGasToken.name}
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
          value={selectedGasToken.id}
          onValueChange={(gasTokenId) => {
            onGasTokenChanged(
              gasTokens.find((gasToken) => gasToken.id === gasTokenId),
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
