import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({cookies:vi.fn(),getAdminClient:vi.fn()}));
vi.mock("next/headers",()=>({cookies:mocks.cookies}));
vi.mock("@/lib/supabase/admin",()=>({getAdminClient:mocks.getAdminClient}));
import { readStaffUser,sessionHash } from "./reception-auth";
describe("individual staff sessions",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("rejects legacy or malformed cookies without querying database",async()=>{
  mocks.cookies.mockResolvedValue({get:()=>({value:"1"})});
  expect(await readStaffUser()).toBeNull();
  expect(mocks.getAdminClient).not.toHaveBeenCalled();
 });
 it("requires a live session and matching version",async()=>{
  const token="a".repeat(64);
  mocks.cookies.mockResolvedValue({get:()=>({value:token})});
  let session:{user_id:string;session_version:number;expires_at:string}|null={user_id:"user",session_version:1,expires_at:new Date(Date.now()+60000).toISOString()};
  let version=1, pending=false;
  const eq=vi.fn();
  mocks.getAdminClient.mockReturnValue({from:(table:string)=>({select:()=>({eq:(key:string,value:string)=>{eq(key,value);return {maybeSingle:async()=>({data:table==="staff_sessions"?session:{id:"user",username:"reservas",name:"Reservas",session_version:version,password_reset_pending:pending},error:null})};}})})});
  expect((await readStaffUser())?.name).toBe("Reservas");
  expect(eq).toHaveBeenCalledWith("token_hash",sessionHash(token));
  pending=true;expect(await readStaffUser()).toBeNull();
  pending=false;
  version=2;expect(await readStaffUser()).toBeNull();
  version=1;session!.expires_at=new Date(Date.now()-1000).toISOString();expect(await readStaffUser()).toBeNull();
  session=null;expect(await readStaffUser()).toBeNull();
 });
});
