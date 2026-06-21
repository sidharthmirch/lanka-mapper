/**
 * Order plot series largest → smallest so the chart legend, the series picker,
 * and the default selection all read in magnitude order (top line = biggest),
 * instead of an arbitrary alphabetical order.
 *
 * "Largest" = the value at the most recent year the data covers, falling back to
 * each series' own latest available value when it has gaps.
 */
export function orderSeriesByMagnitude(
  seriesData: Record<string, Record<number, number>>,
  names: string[],
): string[] {
  let latest = -Infinity
  for (const name of names) {
    for (const yearKey of Object.keys(seriesData[name] ?? {})) {
      const year = Number(yearKey)
      if (Number.isFinite(year) && year > latest) latest = year
    }
  }

  const magnitudeOf = (name: string): number => {
    const series = seriesData[name] ?? {}
    const atLatest = series[latest]
    if (Number.isFinite(atLatest)) return atLatest
    const years = Object.keys(series)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => b - a)
    for (const year of years) {
      const value = series[year]
      if (Number.isFinite(value)) return value
    }
    return -Infinity
  }

  // Stable: ties fall back to name so order is deterministic across renders.
  return [...names].sort((a, b) => {
    const diff = magnitudeOf(b) - magnitudeOf(a)
    return diff !== 0 ? diff : a.localeCompare(b)
  })
}
