export function flattenCategories(groups) {
  return (groups || []).flatMap((g) => g.categories);
}
