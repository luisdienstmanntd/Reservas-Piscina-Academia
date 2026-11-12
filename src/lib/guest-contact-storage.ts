/**
 * Versões anteriores guardavam nome e WhatsApp do hóspede só no navegador do aparelho. Agora ficam na estadia
 * (servidor), valendo em qualquer aparelho até o check-out. Esta rotina apaga o que ficou guardado no navegador.
 */
type StorageLike = Pick<Storage, "removeItem" | "key" | "length">;

const PREFIX = "valle.guest.contact.v1:";

export function clearLegacyGuestContacts(storage: StorageLike): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    /* armazenamento indisponível: nada a limpar */
  }
}
