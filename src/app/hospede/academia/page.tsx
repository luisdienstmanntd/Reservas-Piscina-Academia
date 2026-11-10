import { redirect } from "next/navigation";

import { getValidatedGuestStay } from "@/app/actions/stays";
import { GuestBooking } from "@/components/guest-booking";

export default async function HospedeAcademiaPage() {
  let stay: Awaited<ReturnType<typeof getValidatedGuestStay>>;
  try {
    stay = await getValidatedGuestStay();
  } catch {
    redirect("/indisponivel"); // banco fora do ar: não é link inválido
  }
  if (!stay) redirect("/acesso-negado");

  return (
    <GuestBooking
      facility="gym"
      apartmentNumber={stay.apartmentNumber}
      guestCheckoutDate={stay.checkoutDate}
    />
  );
}
