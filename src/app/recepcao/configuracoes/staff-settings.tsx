"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createStaffUser, resetStaffPassword } from "@/app/actions/staff";
import type { StaffUser } from "@/lib/reception-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function StaffSettings({initialUsers,currentUserId}:{initialUsers:StaffUser[];currentUserId:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [username,setUsername]=useState(""),[name,setName]=useState(""),[password,setPassword]=useState("");
 const [passwords,setPasswords]=useState<Record<string,string>>({});
 async function create(event:React.FormEvent){
  event.preventDefault();setBusy(true);
  try{const r=await createStaffUser({username,name,password});if(!r.ok){toast.error(r.error);return;} setUsername("");setName("");setPassword("");toast.success("Usuário criado.");router.refresh();}
  catch{toast.error("Não foi possível criar o usuário. Tente novamente.");}finally{setBusy(false);}
 }
 async function reset(user:StaffUser){
  setBusy(true);
  try{const r=await resetStaffPassword(user.id,passwords[user.id]??"");if(!r.ok){toast.error(r.error);return;}setPasswords(p=>({...p,[user.id]:""}));toast.success("Senha redefinida. As sessões anteriores foram encerradas.");if(user.id===currentUserId){router.push("/recepcao");router.refresh();}else router.refresh();}
  catch{toast.error("Não foi possível redefinir a senha. Tente novamente.");}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
 <div className="flex items-center justify-between"><h1 className="font-serif text-2xl">Configurações</h1><Button asChild variant="outline"><Link href="/recepcao">Voltar às reservas</Link></Button></div>
 <Card><CardHeader><CardTitle>Novo usuário</CardTitle></CardHeader><CardContent><form onSubmit={create} className="space-y-4">
 <div><Label htmlFor="staff-name">Nome / setor</Label><Input id="staff-name" placeholder="Reservas, Gerência..." value={name} maxLength={100} onChange={e=>setName(e.target.value)} required disabled={busy}/></div>
 <div><Label htmlFor="staff-username">Usuário de acesso</Label><Input id="staff-username" placeholder="reservas" value={username} maxLength={40} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="off" required disabled={busy}/></div>
 <div><Label htmlFor="staff-password">Senha inicial</Label><Input id="staff-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy}/><p className="text-sm text-muted-foreground">Pelo menos 8 caracteres.</p></div>
 <Button type="submit" disabled={busy}>Criar usuário</Button>
 </form></CardContent></Card>
 <Card><CardHeader><CardTitle>Usuários e senhas</CardTitle></CardHeader><CardContent className="space-y-5">
 {initialUsers.map(user=><form key={user.id} className="space-y-2 border-b pb-4 last:border-0" onSubmit={event=>{event.preventDefault();void reset(user);}}>
 <p className="font-medium">{user.name} <span className="text-muted-foreground">({user.username})</span></p>
 <Label htmlFor={`password-${user.id}`}>Nova senha de {user.name}</Label>
 <div className="flex flex-col gap-2 sm:flex-row"><Input id={`password-${user.id}`} type="password" autoComplete="new-password" placeholder="Nova senha" minLength={8} maxLength={128} required disabled={busy} value={passwords[user.id]??""} onChange={e=>setPasswords(p=>({...p,[user.id]:e.target.value}))}/><Button type="submit" variant="outline" disabled={busy}>Redefinir senha</Button></div>
 </form>)}
 <p className="text-sm text-muted-foreground">Todos os usuários internos podem gerenciar contas e reservas. Redefinir uma senha encerra os acessos anteriores desse usuário.</p>
 </CardContent></Card>
 </main>;
}
