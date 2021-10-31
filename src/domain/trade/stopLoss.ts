export const fromLossPercent = (lossPercent: number, stopOffsetPercent: number) => (
  price: number
) => fromLimit(stopOffsetPercent)(price * (1 - lossPercent));

export const fromLimit = (stopOffsetPercent: number) => (limit: number): StopLoss => ({
  limit,
  stop: limit * (1 + stopOffsetPercent)
});

export type StopLoss = {
  stop: number;
  limit: number;
};
