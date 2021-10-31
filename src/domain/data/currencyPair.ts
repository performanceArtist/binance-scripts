export type CurrencyPair = {
  base: string;
  quote: string;
};

export type CurrencyType = keyof CurrencyPair;

export const pairToString = ({ base, quote }: CurrencyPair) =>
  `${base}${quote}`;
