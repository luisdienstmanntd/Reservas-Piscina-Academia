import { redirect } from "next/navigation";

import { getValidatedGuestStay } from "@/app/actions/stays";
import { GuestBooking } from "@/components/guest-booking";

export default async function HospedePiscinaPage() {
  const stay = await getValidatedGuestStay();
  if (!stay) redirect("/acesso-negado");

  return (
    <GuestBooking
      facility="pool"
      apartmentNumber={stay.apartmentNumber}
      guestCheckoutDate={stay.checkoutDate}
    />
  );
}
