export interface Price {
  id: string;
  symbol: string;
  provider: string;
  value: number;
  signature?: Buffer;
  evmSignature?: Buffer;
  liteEvmSignature?: Buffer;
  permawebTx: string;
  version: string;
  source: object;
  timestamp: number;
  minutes?: number;
}
