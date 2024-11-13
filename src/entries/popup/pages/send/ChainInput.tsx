import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Stack, Text, Inline, Symbol } from '~/design-system';
import { Input } from '~/design-system/components/Input/Input';
import { DropdownInputWrapper } from '../../components/DropdownInputWrapper/DropdownInputWrapper';
import { InputActionButton } from './InputActionButton';
import { CursorTooltip } from '../../components/Tooltip/CursorTooltip';

interface Chain {
  id: number;
  name: string;
}

interface ChainInputProps {
  selectedChain?: Chain;
  availableChains: Chain[];
  onSelectChain: (chain: Chain) => void;
  onClearSelection: () => void;
  onDropdownOpen: (open: boolean) => void;
}

interface InputRefAPI {
  blur: () => void;
  focus: () => void;
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
      (chain: Chain) => {
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

    const inputVisible = !selectedChain;

    return (
      <>
        <DropdownInputWrapper
          zIndex={2}
          dropdownHeight={300}
          testId="chain-input"
          leftComponent={<Symbol symbol="network" size={36} color="label" />}
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
                    {inputVisible ? (
                      <Box
                        as={motion.div}
                        layout="position"
                        onClick={onDropdownAction}
                      >
                        <Input
                          testId="to-address-input"
                          value={selectedChain?.id || ''}
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
  chains: Chain[];
  selectChainAndCloseDropdown: (chain: Chain) => void;
}) => {
  return (
    <Stack space="8px">
      {chains.map((chain) => (
        <Box key={chain.id} onClick={() => selectChainAndCloseDropdown(chain)}>
          <Inline alignVertical="center" space="4px">
            <Symbol symbol="network" size={24} color="label" />
            <Text size="14pt" color="label" weight="semibold">
              {chain.name}
            </Text>
          </Inline>
        </Box>
      ))}
    </Stack>
  );
};
