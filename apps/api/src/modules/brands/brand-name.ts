export function collapseBrandNameWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeBrandName(value: string) {
  return collapseBrandNameWhitespace(value).toLowerCase();
}
