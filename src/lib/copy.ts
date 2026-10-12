/** Count labels share singular/plural handling, including zero. */
export function plural(count: number | string, singular: string, multiple = `${singular}s`): string {
  return `${count} ${Number(count) === 1 ? singular : multiple}`;
}

export function sentenceCase(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Navigation matches whole segments, not similarly named routes. */
export function isNavActive(path: string, target: string, exact = false): boolean {
  return path === target || (!exact && path.startsWith(`${target}/`));
}