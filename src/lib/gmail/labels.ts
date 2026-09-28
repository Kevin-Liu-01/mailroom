/**
 * Gmail treats a nested label such as "Receipts/Uber" as its own label: a search for label:"Receipts"
 * finds nothing filed under it. Expand every quoted label token in a query to the label plus its sublabels,
 * so policies and searches written against the taxonomy also reach mail a user filed one level deeper.
 */
export function expandLabelQuery(query: string, labelNames: Iterable<string>): string {
  const names = [...new Set(labelNames)];
  return query.replace(/label:"([^"]+)"/g, (token, name: string) => {
    const subs = names.filter((n) => n.startsWith(`${name}/`)).sort();
    if (!subs.length) return token;
    return `(${[name, ...subs].map((n) => `label:"${n}"`).join(" OR ")})`;
  });
}
