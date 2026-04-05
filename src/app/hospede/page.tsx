import { redirect } from "next/navigation";

/** Links antigos /hospede → piscina (QR existente). */
export default function HospedePage() {
  redirect("/hospede/piscina");
}
