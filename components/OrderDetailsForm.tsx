"use client";

import { useState } from "react";

export interface OrderDetailsValue {
  client_name: string;
  order_date: string;
  due_date: string;
  person_in_charge: string;
  quantity: string;
  renewal_check_date: string;
  notes: string;
}

export function emptyOrderDetails(): OrderDetailsValue {
  const today = new Date().toISOString().slice(0, 10);
  return {
    client_name: "",
    order_date: today,
    due_date: "",
    person_in_charge: "",
    quantity: "",
    renewal_check_date: "",
    notes: "",
  };
}

// 1年契約の3ヶ月前を延長確認日として提案する
function suggestRenewalCheckDate(orderDate: string): string {
  if (!orderDate) return "";
  const d = new Date(orderDate + "T00:00:00");
  d.setMonth(d.getMonth() + 9); // 12ヶ月 - 3ヶ月
  return d.toISOString().slice(0, 10);
}

export default function OrderDetailsForm({
  value,
  onChange,
}: {
  value: OrderDetailsValue;
  onChange: (v: OrderDetailsValue) => void;
}) {
  const set = (patch: Partial<OrderDetailsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="クライアント名" required>
        <input
          required
          value={value.client_name}
          onChange={(e) => set({ client_name: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="注文日" required>
        <input
          type="date"
          required
          value={value.order_date}
          onChange={(e) => set({ order_date: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="納期">
        <input
          type="date"
          value={value.due_date}
          onChange={(e) => set({ due_date: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="担当者">
        <input
          value={value.person_in_charge}
          onChange={(e) => set({ person_in_charge: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="個数">
        <input
          type="number"
          min={0}
          value={value.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          className="input"
        />
      </Field>
      <Field label="延長確認日（1年契約の3ヶ月前が目安）">
        <div className="flex gap-2">
          <input
            type="date"
            value={value.renewal_check_date}
            onChange={(e) => set({ renewal_check_date: e.target.value })}
            className="input"
          />
          <button
            type="button"
            onClick={() => set({ renewal_check_date: suggestRenewalCheckDate(value.order_date) })}
            className="text-xs whitespace-nowrap px-3 rounded-lg border hover:bg-slate-50"
          >
            自動計算
          </button>
        </div>
      </Field>
      <Field label="備考" full>
        <textarea
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="input"
          rows={3}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-1 block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
