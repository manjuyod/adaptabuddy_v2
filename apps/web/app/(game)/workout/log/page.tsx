import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { LogClient } from "./log-client";

export default async function LogPage() {
  const supabase = await createSupabaseServerComponentClient();

  // Check authentication
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The actual session data is stored in sessionStorage on the client
  // This page just needs to verify auth and render the client component
  return <LogClient />;
}

