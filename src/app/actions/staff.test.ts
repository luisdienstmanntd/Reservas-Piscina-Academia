import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ readStaffUser: vi.fn(), getAdminClient: vi.fn(), createStaffSession: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readStaffUser: mocks.readStaffUser, createStaffSession: mocks.createStaffSession, deleteStaffSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: mocks.getAdminClient }));
import { createStaffUser, loginStaff, resetStaffPassword } from "./staff";
describe("staff account protections", () => {
 beforeEach(() => vi.resetAllMocks());
 it("rejects account management without a session", async () => {
  mocks.readStaffUser.mockResolvedValue(null);
  expect((await createStaffUser({username:"reservas",name:"Reservas",password:"password"})).ok).toBe(false);
  expect((await resetStaffPassword("00000000-0000-4000-8000-000000000001","password")).ok).toBe(false);
  expect(mocks.getAdminClient).not.toHaveBeenCalled();
 });
 it("blocks authentication while a password reset is pending", async () => {
  const signIn=vi.fn();
  mocks.getAdminClient.mockReturnValue({rpc:async()=>({data:true}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:"user",password_reset_pending:true}})})})}),auth:{signInWithPassword:signIn}});
  expect((await loginStaff("reservas","old-password")).ok).toBe(false);
  expect(signIn).not.toHaveBeenCalled();
  expect(mocks.createStaffSession).not.toHaveBeenCalled();
 });
 it("invalidates sessions both before and after changing the password", async () => {
  mocks.readStaffUser.mockResolvedValue({id:"admin"});
  const events:string[]=[];
  mocks.getAdminClient.mockReturnValue({auth:{admin:{updateUserById:async()=>{events.push("password");return {error:null};}}},from:(table:string)=>{
   const query={select:()=>query,eq:()=>query,single:async()=>({data:{id:"user",session_version:1,username:"reservas"},error:null}),update:(v:{session_version:number;password_reset_pending:boolean})=>{events.push(`${v.session_version}:${v.password_reset_pending}`);return query;},delete:()=>{events.push(`delete:${table}`);return query;}};
   return query;
  }});
  expect((await resetStaffPassword("00000000-0000-4000-8000-000000000001","new-password")).ok).toBe(true);
  expect(events.slice(0,3)).toEqual(["2:true","password","3:false"]);
 });
});
