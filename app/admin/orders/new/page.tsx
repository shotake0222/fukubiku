"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateHash } from "@/lib/hash";
import OrderDetailsForm, { emptyOrderDetails, type OrderDetailsValue } from "@/components/OrderDetailsForm";

export default function NewOrderPage() {
  const router = useRouter();
  const [value, setValue] = useState<OrderDetailsValue>(emptyOrderDetails());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("orders")
      .insert({
        hash: generateHash(),
        client_name: value.client_name,
        order_date: value.order_date,
        due_date: value.due_date || null,
        person_in_charge: value.person_in_charge || null,
        quantity: value.quantity ? Number(value.quantity) : null,
        renewal_check_date: value.renewal_check_date || null,
        notes: value.notes || null,
        display_type: "aframe",
        object_source: "preset",
        status: "draft",
      })
      .select("id")
      .single();

    setSaving(false);
    if (error || !data) {
      setError(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    router.push(`/admin/orders/${data.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-bold">新規注文</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
        <OrderDetailsForm value={value} onChange={setValue} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存して表示オブジェクトを設定する"}
        </button>
      </form>
    </div>
  );
}
