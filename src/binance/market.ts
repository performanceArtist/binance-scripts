import {
  BinanceKline,
  BinanceKlineIO,
  BinanceSocketKline,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { array, either, option } from 'fp-ts';
import { marketController } from '../../generated/spot_api.yaml/paths/MarketController';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { Either } from 'fp-ts/lib/Either';
import { HTTPClient2 } from '../../generated/spot_api.yaml/client/client';
import * as t from 'io-ts';
import { Candle } from '../domain/types/shared';
import { MarketAPI } from '../domain/types/market';
import { pairToString } from '../domain/data/currencyPair';
import { container } from '@performance-artist/fp-ts-adt';

export const fromBinanceApiKline = ([
  timestamp,
  open,
  high,
  low,
  close,
  volume
]: BinanceKline): Either<Error, Candle> => {
  try {
    return either.right({
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
      timestamp
    });
  } catch (e) {
    return pipe(new Error(`Domain conversion error: ${e}`), either.left);
  }
};

export const fromBinanceSocketKline = ({
  k: {
    o: open,
    c: close,
    h: high,
    l: low,
    v: volume,
    T: timestamp,
    x: isClosed
  }
}: BinanceSocketKline) => {
  try {
    return either.right({
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
      timestamp,
      isClosed
    });
  } catch (e) {
    return pipe(new Error(`Domain conversion error: ${e}`), either.left);
  }
};

export const makeMarketAPI = pipe(
  container.create<{
    httpClient: HTTPClient2<'ObservableEither'>;
    socketClient: ReturnType<typeof makeBinanceWebSocketClient>;
  }>()('httpClient', 'socketClient'),
  container.map(
    (deps): MarketAPI => {
      const { httpClient, socketClient } = deps;
      const market = marketController({ httpClient });

      const getCandles: MarketAPI['getCandles'] = ({
        symbol,
        interval,
        startTime,
        endTime,
        limit
      }) =>
        pipe(
          market.GET__api_v3_klines({
            query: {
              symbol: pairToString(symbol),
              interval,
              startTime: option.some(startTime as t.Int),
              endTime: option.some(endTime as t.Int),
              limit: option.some(limit as t.Int)
            }
          }),
          rxo.map(
            either.chain(
              flow(
                t.array(BinanceKlineIO).decode,
                either.mapLeft(e => new Error(String(e.map(v => v.context)))),
                either.chain(array.traverse(either.either)(fromBinanceApiKline))
              )
            )
          ),
          rxo.shareReplay(1)
        );

      return {
        getCandles,
        getCurrentCandle: ({ symbol, interval }) =>
          pipe(
            socketClient.kline(pairToString(symbol), interval),
            rxo.map(either.chain(fromBinanceSocketKline))
          )
      };
    }
  )
);
