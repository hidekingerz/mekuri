/** folder 自身か、その中にあるお気に入りを返す（folder をゴミ箱へ移すと行き先を失うもの）。 */
export function favoritesInside(favorites: string[], folder: string): string[] {
  return favorites.filter((fav) => fav === folder || fav.startsWith(`${folder}/`));
}
