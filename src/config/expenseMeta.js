export const DEFAULT_CATEGORY = '其他';

export const EXPENSE_CATEGORIES = ['餐饮', '交通', '住宿', '购物', '通讯', '门票', DEFAULT_CATEGORY];

export function normalizeCategory(category) {
  const value = String(category || '').trim();
  return EXPENSE_CATEGORIES.includes(value) ? value : DEFAULT_CATEGORY;
}

export function formatExpenseDate(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date && Number.isFinite(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

export function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
