"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
      className="text-slate-500 hover:text-slate-900"
    >
      ログアウト
    </button>
  );
}
