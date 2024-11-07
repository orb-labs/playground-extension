import { ChainId } from '../types/chains';

const getHost = (endpoint: string) => {
  try {
    const host = new URL(endpoint).host;
    if (host.indexOf('www.') === 0) {
      return host.replace('www.', '');
    }
    return host;
  } catch (e) {
    return '';
  }
};

const isRainbowEndpoint = (endpoint: string) =>
  getHost(endpoint).includes('rainbow.me');

export const proxyRpcEndpoint = (endpoint: string, chainId: ChainId) => {
  const idToChainstackName = {
    [ChainId.base]: 'base-mainnet',
    [ChainId.baseSepolia]: 'base-sepolia',

    [ChainId.bsc]: 'bsc-mainnet',
    [ChainId.bscTestnet]: 'bsc-testnet',

    [ChainId.arbitrum]: 'arbitrum-mainnet',
    [ChainId.arbitrumSepolia]: 'arbitrum-sepolia',

    [ChainId.optimism]: 'optimism-mainnet',
    [ChainId.optimismSepolia]: 'optimism-sepolia',

    [ChainId.polygon]: 'polygon-mainnet',
    [ChainId.polygonAmoy]: 'polygon-amoy',

    [ChainId.avalanche]: 'avalanche-mainnet',
    [ChainId.avalancheFuji]: 'avalanche-fuji',

    [ChainId.mainnet]: 'ethereum-mainnet',
    [ChainId.sepolia]: 'ethereum-sepolia',
    [ChainId.holesky]: 'ethereum-holesky',
  };

  console.log('endpoint', endpoint);
  console.log('chainId', chainId);

  const CHAINSTACK_API_KEY = '';

  return `https://${idToChainstackName[chainId]}.core.chainstack.com/${CHAINSTACK_API_KEY}`;

  // if (
  //   endpoint &&
  //   endpoint !== 'http://127.0.0.1:8545' &&
  //   endpoint !== 'http://localhost:8545' &&
  //   !endpoint.includes('http://10.') &&
  //   !endpoint.includes('http://192.168') &&
  //   !endpoint.match(/http:\/\/172.(1[6-9]|2[0-9]|3[0-1])./) &&
  //   !isRainbowEndpoint(endpoint)
  // ) {
  //   return `${process.env.RPC_PROXY_BASE_URL}/${chainId}/${
  //     process.env.RPC_PROXY_API_KEY
  //   }?custom_rpc=${encodeURIComponent(endpoint)}`;
  // }
  // return endpoint;
};
