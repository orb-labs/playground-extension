import { oldDefaultRPC } from '~/core/references/chains';

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
  // NOTE: you'll need your .env file to have the correct RPC URLs
  console.log('chainId', chainId);
  console.log('using this rpc: ', oldDefaultRPC[chainId]);
  return (
    oldDefaultRPC[chainId] ||
    'https://ethereum-holesky.core.chainstack.com/3869a6437a482a0d980d76b40cba3d72'
  );

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
