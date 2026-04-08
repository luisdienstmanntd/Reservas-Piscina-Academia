import { redirect } from "next/navigation";

import { getValidatedGuestStay } from "@/app/actions/stays";
import { GuestBooking } from "@/components/guest-booking";

export default async function HospedeAcademiaPage() {
  const stay = await getValidatedGuestStay();
  if (!stay) redirect("/acesso-negado");

  return (
    <GuestBooking
      facility="gym"
      apartmentNumber={stay.apartmentNumber}
      guestCheckoutDate={stay.checkoutDate}
    />
  );
}
