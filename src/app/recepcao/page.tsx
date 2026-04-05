import { getReceptionAuthState } from "@/app/actions/reservations";

import { ReceptionDashboard } from "./reception-dashboard";

export default async function RecepcaoPage() {
  const authed = await getReceptionAuthState();
  return <ReceptionDashboard initialAuthed={authed} />;
}
