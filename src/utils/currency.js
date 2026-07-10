export const DEFAULT_CURRENCY = 'TWD';

export const CURRENCIES = {
  TWD: {
    code: 'TWD',
    label: '新台币 TWD',
    symbol: 'NT$',
    rateToCny: 0.2121
  },
  HKD: {
    code: 'HKD',
    label: '港币 HKD',
    symbol: 'HK$',
    rateToCny: 0.8677
  },
  CNY: {
    code: 'CNY',
    label: '人民币 CNY',
    symbol: '¥',
    rateToCny: 1
  }
};

export function getCurrencyMeta(currencyCode) {
  return CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
}

export function shouldShowCnyConversion(currencyCode) {
  return getCurrencyMeta(currencyCode).code !== 'CNY';
}

function toCurrencyCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(Number(`${amount}e2`));
}

function fromCurrencyCents(cents) {
  return Number((cents / 100).toFixed(2));
}

function formatAmount(value, symbol) {
  const amount = Number(value);
  const sign = amount < 0 ? '-' : '';
  const roundedAmount = fromCurrencyCents(toCurrencyCents(Math.abs(amount)));

  return `${sign}${symbol}${roundedAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function convertMoney(value, fromCurrencyCode, toCurrencyCode, options = {}) {
  const fromCurrency = getCurrencyMeta(fromCurrencyCode);
  const toCurrency = getCurrencyMeta(toCurrencyCode);
  const converted = (Number(value) * fromCurrency.rateToCny) / toCurrency.rateToCny;
  if (options.round === false) {
    return converted;
  }

  const sign = converted < 0 ? -1 : 1;
  return sign * fromCurrencyCents(toCurrencyCents(Math.abs(converted)));
}

export function getCurrencyRateLabel(currencyCode) {
  const currency = getCurrencyMeta(currencyCode);
  if (!shouldShowCnyConversion(currency.code)) {
    return '';
  }

  return `参考汇率 1 ${currency.code} ≈ ${CURRENCIES.CNY.symbol}${currency.rateToCny.toFixed(4)}`;
}

export function formatMoney(value, currencyCode = DEFAULT_CURRENCY) {
  const currency = getCurrencyMeta(currencyCode);
  const primary = formatAmount(value, currency.symbol);

  if (!shouldShowCnyConversion(currency.code)) {
    return {
      primary,
      converted: '',
      rateLabel: ''
    };
  }

  return {
    primary,
    converted: `≈ ${formatAmount(convertMoney(value, currency.code, 'CNY'), CURRENCIES.CNY.symbol)}`,
    rateLabel: getCurrencyRateLabel(currency.code)
  };
}
