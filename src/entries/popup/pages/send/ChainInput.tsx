import { BlockchainInformation } from '@orb-labs/orby-core';
import { AnimatePresence, motion } from 'framer-motion';
import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import backendNetworks from 'static/data/networks.json';
import { Box, Inline, Stack, Text } from '~/design-system';
import { Input } from '~/design-system/components/Input/Input';

import { ChainIcon } from '../../components/CoinIcon/CoinIcon';
import { DropdownInputWrapper } from '../../components/DropdownInputWrapper/DropdownInputWrapper';
import { CursorTooltip } from '../../components/Tooltip/CursorTooltip';

import { InputActionButton } from './InputActionButton';

interface ChainInputProps {
  selectedChain?: BlockchainInformation;
  availableChains?: BlockchainInformation[];
  onSelectChain: (chain: BlockchainInformation) => void;
  onClearSelection: () => void;
  onDropdownOpen: (open: boolean) => void;
}

interface InputRefAPI {
  blur: () => void;
  focus: () => void;
}

function getChainImage(chainId?: number) {
  if (!chainId) return undefined;

  return backendNetworks.networks.find((n) => Number(n.id) === chainId)?.icons
    .badgeURL;
}

export const ChainInput = React.forwardRef<InputRefAPI, ChainInputProps>(
  function ChainInput(props, forwardedRef) {
    const {
      selectedChain,
      availableChains,
      onSelectChain,
      onClearSelection,
      onDropdownOpen,
    } = props;
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(forwardedRef, () => ({
      blur: () => closeDropdown(),
      focus: () => openDropdown(),
      isFocused: () => inputRef.current === document.activeElement,
    }));

    const openDropdown = useCallback(() => {
      onDropdownOpen(true);
      setDropdownVisible(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    }, [onDropdownOpen]);

    const closeDropdown = useCallback(() => {
      onDropdownOpen(false);
      setDropdownVisible(false);
    }, [onDropdownOpen]);

    const onDropdownAction = useCallback(() => {
      dropdownVisible ? closeDropdown() : openDropdown();
    }, [dropdownVisible, openDropdown, closeDropdown]);

    const selectChainAndCloseDropdown = useCallback(
      (chain: BlockchainInformation) => {
        onSelectChain(chain);
        onDropdownAction();
      },
      [onDropdownAction, onSelectChain],
    );

    // useEffect(() => {
    //   if (!selectedChain) {
    //     openDropdown();
    //   }
    // }, [selectedChain, openDropdown]);

    const inputActionButton = (
      <InputActionButton
        showClose={!!selectedChain}
        onClose={onClearSelection}
        onDropdownAction={onDropdownAction}
        dropdownVisible={dropdownVisible}
        testId="input-wrapper-close-chain-input"
      />
    );

    return (
      <>
        <DropdownInputWrapper
          zIndex={2}
          dropdownHeight={300}
          testId="chain-input"
          leftComponent={
            <ChainIcon
              size={36}
              url={getChainImage(
                selectedChain?.chainId
                  ? Number(selectedChain.chainId)
                  : undefined,
              )}
              fallbackText={selectedChain?.name}
            />
          }
          centerComponent={
            <Box as={motion.div} layout>
              <Stack space="8px">
                <Box
                  as={motion.div}
                  key="input"
                  onClick={onDropdownAction}
                  layout="position"
                >
                  <AnimatePresence>
                    {!selectedChain ? (
                      <Box
                        as={motion.div}
                        layout="position"
                        onClick={onDropdownAction}
                      >
                        <Input
                          testId="to-address-input"
                          value={''}
                          placeholder={'Chain'}
                          height="32px"
                          variant="transparent"
                          style={{ paddingLeft: 0, paddingRight: 0 }}
                          innerRef={inputRef}
                          tabIndex={0}
                        />
                      </Box>
                    ) : (
                      <Box as={motion.div} layout="position">
                        <Text size="14pt" weight="semibold" color="label">
                          {selectedChain.name}
                        </Text>
                      </Box>
                    )}
                  </AnimatePresence>
                </Box>
              </Stack>
            </Box>
          }
          dropdownComponent={
            <ChainList
              chains={availableChains}
              selectChainAndCloseDropdown={selectChainAndCloseDropdown}
            />
          }
          dropdownVisible={dropdownVisible}
          rightComponent={
            selectedChain ? (
              <CursorTooltip
                align="end"
                arrowAlignment="right"
                text="Clear selection"
                textWeight="bold"
                textSize="12pt"
                textColor="labelSecondary"
              >
                {inputActionButton}
              </CursorTooltip>
            ) : (
              inputActionButton
            )
          }
        />
      </>
    );
  },
);

const ChainList = ({
  chains,
  selectChainAndCloseDropdown,
}: {
  chains?: BlockchainInformation[];
  selectChainAndCloseDropdown: (chain: BlockchainInformation) => void;
}) => {
  return (
    <Stack space="8px" paddingLeft="20px">
      {chains?.map((chain) => (
        <Box
          key={chain.chainId?.toString()}
          onClick={() => selectChainAndCloseDropdown(chain)}
          paddingBottom="8px"
        >
          <Inline alignVertical="center" space="8px">
            <ChainIcon
              size={36}
              url={getChainImage(
                chain.chainId ? Number(chain.chainId) : undefined,
              )}
              fallbackText={chain.name}
            />
            <Text size="14pt" color="labelSecondary" weight="semibold">
              {chain.name}
            </Text>
          </Inline>
        </Box>
      ))}
    </Stack>
  );
};
