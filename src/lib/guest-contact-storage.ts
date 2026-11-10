/**
 * Lembra, neste aparelho, o nome e o WhatsApp que o hóspede informou, para ele não
 * digitar de novo ao agendar outra vez durante a mesma estadia. Fica só no navegador
 * do hóspede, por apartamento e data de check-out, e é apagado depois do check-out.
 */
export type GuestContact = { name: string; whatsapp: string };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const PREFIX = "valle.guest.contact.v1:";

function keyFor(apartment: string, checkoutYmd: string): string {
  return `${PREFIX}${apartment.trim()}:${checkoutYmd}`;
}

/** Remove os dados de estadias que já terminaram (checkout anterior a hoje). */
export function purgeExpiredContacts(storage: StorageLike, todayYmd: string): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const checkout = k.slice(k.lastIndexOf(":") + 1);
      if (/^\d{4}-\d{2}-\d{2}$/.test(checkout) && checkout < todayYmd) stale.push(k);
    }
    stale.forEach((k) => storage.removeItem(k));
  } catch {
    /* armazenamento indisponível: segue sem lembrar */
  }
}

/** Lê o contato salvo; `validate` devolve o WhatsApp normalizado ou null se inválido. */
export function readGuestContact(
  storage: StorageLike,
  apartment: string,
  checkoutYmd: string,
  validate: (whatsapp: string) => string | null
): GuestContact | null {
  try {
    const raw = storage.getItem(keyFor(apartment, checkoutYmd));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { name, whatsapp } = parsed as Record<string, unknown>;
    if (typeof whatsapp !== "string") return null;
    const ok = validate(whatsapp);
    if (!ok) return null;
    return { name: typeof name === "string" ? name : "", whatsapp: ok };
  } catch {
    return null;
  }
}

export function saveGuestContact(
  storage: StorageLike,
  apartment: string,
  checkoutYmd: string,
  contact: GuestContact
): void {
  try {
    storage.setItem(keyFor(apartment, checkoutYmd), JSON.stringify(contact));
  } catch {
    /* sem armazenamento: o hóspede só terá de digitar de novo */
  }
}
