"use server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { createStaffSession, deleteStaffSession, readStaffUser, type StaffUser } from "@/lib/reception-auth";
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, "Usuário: 3 a 40 letras sem acento, números, ponto, hífen ou sublinhado.");
const passwordSchema = z.string().min(8,"A senha deve ter pelo menos 8 caracteres.").max(128,"Senha muito longa.");
const newUserSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1,"Informe o nome.").max(100), password: passwordSchema });
const emailFor = (username:string) => `${username}@staff.valledincanto.invalid`;
type Result = { ok:true } | { ok:false; error:string };
export async function loginStaff(username:string,password:string):Promise<Result> {
 const parsed = usernameSchema.safeParse(username);
 if(!parsed.success || typeof password!=="string" || password.length>128) return {ok:false,error:"Usuário ou senha incorretos."};
 const db = getAdminClient(); if(!db) return {ok:false,error:"Base de dados não configurada."};
 const loginName=parsed.data;
 const {data:allowed,error:gateError}=await db.rpc("claim_staff_login",{login_name:loginName});
 if(gateError) return {ok:false,error:"A configuração de usuários ainda não foi aplicada ao banco."};
 if(!allowed) return {ok:false,error:"Muitas tentativas. Aguarde 15 minutos."};
 let {data:profile}=await db.from("staff_users").select("id,username,name,session_version,password_reset_pending").eq("username",loginName).maybeSingle();
 if(!profile && loginName==="recepcao" && process.env.RECEPTION_PASSWORD && password===process.env.RECEPTION_PASSWORD){
   const {data,error}=await db.auth.admin.createUser({email:emailFor(loginName),password,email_confirm:true});
   if(error || !data.user) return {ok:false,error:"Não foi possível criar o acesso inicial. Procure o responsável pelo sistema."};
   const inserted=await db.from("staff_users").insert({id:data.user.id,username:loginName,name:"Recepção"}).select("id,username,name,session_version,password_reset_pending").single();
   if(inserted.error){ await db.auth.admin.deleteUser(data.user.id); return {ok:false,error:"Não foi possível preparar o acesso inicial."}; }
   profile=inserted.data;
 }
 if(!profile || profile.password_reset_pending) return {ok:false,error:"Usuário ou senha incorretos."};
 const authClient=getAdminClient()!;
 const {data,error}=await authClient.auth.signInWithPassword({email:emailFor(loginName),password});
 if(error || data.user?.id!==profile.id) return {ok:false,error:"Usuário ou senha incorretos."};
 const {data:current}=await db.from("staff_users").select("id,username,name,session_version,password_reset_pending").eq("id",profile.id).single();
 if(!current || current.password_reset_pending || current.session_version!==profile.session_version) return {ok:false,error:"Senha alterada. Entre novamente."};
 if(!(await createStaffSession(current as StaffUser))) return {ok:false,error:"Não foi possível abrir a sessão."};
 await db.from("staff_login_attempts").delete().eq("username",loginName);
 await db.from("staff_sessions").delete().lt("expires_at",new Date().toISOString());
 return {ok:true};
}
export async function logoutStaff():Promise<void>{ await deleteStaffSession(); }
export async function listStaffUsers():Promise<{ok:true;users:StaffUser[]}|{ok:false;error:string}> {
 if(!(await readStaffUser())) return {ok:false,error:"Sessão expirada. Entre novamente."};
 const db=getAdminClient()!;
 const {data,error}=await db.from("staff_users").select("id,username,name,session_version,password_reset_pending").order("created_at");
 if(error) return {ok:false,error:"Não foi possível carregar os usuários."};
 return {ok:true,users:data as StaffUser[]};
}
export async function createStaffUser(input:{username:string;name:string;password:string}):Promise<Result>{
 if(!(await readStaffUser())) return {ok:false,error:"Sessão expirada. Entre novamente."};
 const parsed=newUserSchema.safeParse(input);
 if(!parsed.success) return {ok:false,error:parsed.error.issues[0].message};
 const db=getAdminClient()!, v=parsed.data;
 const existing=await db.from("staff_users").select("id").eq("username",v.username).maybeSingle();
 if(existing.error) return {ok:false,error:"Não foi possível verificar o usuário."};
 if(existing.data) return {ok:false,error:"Esse usuário já existe."};
 const {data,error}=await db.auth.admin.createUser({email:emailFor(v.username),password:v.password,email_confirm:true});
 if(error || !data.user) return {ok:false,error:"Não foi possível criar o usuário. Confira o nome de acesso."};
 const {error:profileError}=await db.from("staff_users").insert({id:data.user.id,username:v.username,name:v.name});
 if(profileError){ await db.auth.admin.deleteUser(data.user.id); return {ok:false,error:"Não foi possível salvar o usuário."}; }
 return {ok:true};
}
export async function resetStaffPassword(id:string,password:string):Promise<Result>{
 if(!(await readStaffUser())) return {ok:false,error:"Sessão expirada. Entre novamente."};
 if(!z.string().uuid().safeParse(id).success) return {ok:false,error:"Usuário inválido."};
 const p=passwordSchema.safeParse(password); if(!p.success) return {ok:false,error:p.error.issues[0].message};
 const db=getAdminClient()!;
 const {data:user,error:findError}=await db.from("staff_users").select("id,session_version").eq("id",id).single();
 if(findError || !user) return {ok:false,error:"Usuário não encontrado."};
 // Invalidate every previously issued application session before changing credentials.
 const {error:versionError}=await db.from("staff_users").update({session_version:user.session_version+1,password_reset_pending:true}).eq("id",id).eq("session_version",user.session_version).select("id").single();
 if(versionError) return {ok:false,error:"Não foi possível redefinir a senha. Tente novamente."};
 const {error}=await db.auth.admin.updateUserById(id,{password:p.data});
 const {error:finishError}=await db.from("staff_users").update({session_version:user.session_version+2,password_reset_pending:false}).eq("id",id).eq("session_version",user.session_version+1).select("id").single();
 if(finishError) return {ok:false,error:"A redefinição não foi concluída. Peça a outro usuário para tentar novamente."};
 await db.from("staff_sessions").delete().eq("user_id",id);
 await db.from("staff_login_attempts").delete().eq("username",(await db.from("staff_users").select("username").eq("id",id).single()).data?.username ?? "");
 if(error) return {ok:false,error:"Não foi possível alterar a senha. As sessões anteriores foram encerradas."};
 return {ok:true};
}
