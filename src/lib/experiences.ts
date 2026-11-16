export const experiences = {
  cinema: { label: "Cine in Toscana", rows: 5, setupLabel: "Nome do filme" },
  wine: { label: "L'ora del vino", rows: 8, setupLabel: "Vinícola" },
  pizza: { label: "La vera pizza", rows: 8, setupLabel: null },
} as const;

export const PIZZA_DEFAULT_PRICE_CENTS = 18900;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPizzaPrice(cents: number) {
  return brl.format(cents / 100);
}

export type Experience = keyof typeof experiences;
export type ExperienceSession = { title: string; start_time: string };
export type ExperienceBooking = {
  line: number;
  revision: string;
  customer: "guest" | "external";
  apartment: string | null;
  name: string;
  pax: number | null;
  adults: number | null;
  children: number | null;
  notes: string | null;
  price_cents?: number | null;
  numbers?: string | null;
  phone?: string | null;
  complimentary?: boolean;
};
