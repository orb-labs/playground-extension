import { OperationSet } from '@orb-labs/orby-core';
import { memo, useMemo } from 'react';
import { formatUnits } from 'viem';

import { getChain } from '~/core/utils/chains';
import { Box, Inline, Symbol, Text } from '~/design-system';

export const TransactionRoute = memo(function TransactionRoute({
  operationSet,
}: {
  operationSet?: OperationSet;
}) {
  const fungibleTokens = useMemo(() => {
    return operationSet?.inputState?.getFungibleTokens();
  }, [operationSet]);

  return (
    <Box gap="16px" display="flex" flexDirection="column" paddingTop="14px">
      <Text size="12pt" weight="semibold" color="labelTertiary">
        Using Funds
      </Text>
      {fungibleTokens?.map((input, i) => (
        <Inline key={i} alignVertical="center">
          <Symbol
            size={14}
            symbol="arrow.up.circle.fill"
            weight="bold"
            color="red"
          />
          <Box paddingLeft="10px">
            <Text key={i} size="14pt" weight="bold" color="label">
              Use {formatUnits(input.toRawAmount(), input.token.decimals)}{' '}
              {input.token.symbol} from{' '}
              {getChain({ chainId: Number(input.token.chainId) }).name}
            </Text>
          </Box>
        </Inline>
      ))}
    </Box>
  );
});
