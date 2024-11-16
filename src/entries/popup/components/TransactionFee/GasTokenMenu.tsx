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

const gasTokens = [
  {
    name: 'USDC',
    id: '1',
    isOrby: true,
  },
  {
    name: 'WETH',
    id: '2',
    isOrby: true,
  },
];

export const SwitchGasTokenMenuSelector = ({
  selectedGasToken,
}: {
  selectedGasToken?: any;
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
                <Stack space="6px">
                  <Text color="label" size="14pt" weight="medium">
                    {gasToken.name}
                  </Text>
                </Stack>
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
    plainTriggerBorder,
    onGasTokenChanged,
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
      //   borderColor={plainTriggerBorder ? 'fillSecondary' : 'accent'}
      paddingVertical="5px"
      paddingHorizontal="6px"
      borderRadius="24px"
      as="button"
      ref={triggerRef}
      //     className={accentFocusVisibleStyle}
      tabIndex={editable ? 0 : -1}
    >
      <Inline space="6px" alignVertical="center">
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
          onValueChange={(gasToken) => onGasTokenChanged(gasToken)}
        >
          <SwitchGasTokenMenuSelector selectedGasToken={selectedGasToken} />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
