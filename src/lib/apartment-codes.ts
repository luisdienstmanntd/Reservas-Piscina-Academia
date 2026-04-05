/** Apartamentos válidos para reservas (número exato após trim). */
export const ALLOWED_APARTMENT_NUMBERS = [
  "101",
  "102",
  "103",
  "104",
  "105",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
  "208",
  "209",
  "210",
  "211",
  "212",
  "301",
  "302",
  "303",
  "304",
  "305",
  "306",
  "307",
  "308",
  "309",
  "310",
  "311",
  "312",
  "401",
  "402",
  "403",
  "404",
  "405",
  "406",
  "407",
] as const;

const allowedSet = new Set<string>(ALLOWED_APARTMENT_NUMBERS);

export function isAllowedApartmentNumber(value: string): boolean {
  return allowedSet.has(value.trim());
}
