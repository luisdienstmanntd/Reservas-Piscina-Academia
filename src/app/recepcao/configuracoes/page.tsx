import { redirect } from "next/navigation";
import { readStaffUser } from "@/lib/reception-auth";
import { listStaffUsers } from "@/app/actions/staff";
import { StaffSettings } from "./staff-settings";
export default async function SettingsPage(){ const user=await readStaffUser();if(!user)redirect("/recepcao");const result=await listStaffUsers();if(!result.ok)return <main className="p-6">{result.error}</main>;return <StaffSettings initialUsers={result.users} currentUserId={user.id}/>; }
