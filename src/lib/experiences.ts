export const experiences = {
  cinema: { label: "Cine in Toscana", rows: 5, setupLabel: "Nome do filme" },
  wine: { label: "L'ora del vino", rows: 8, setupLabel: "Vinícola" },
  pizza: { label: "La vera pizza", rows: 8, setupLabel: null },
} as const;

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
};
