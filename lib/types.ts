export type DisplayType = "aframe" | "mindar";
export type ObjectSource = "preset" | "upload";
export type OrderStatus = "draft" | "compiling" | "ready";

export interface PresetObject {
  id: string;
  name: string;
  model_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  hash: string;
  status: OrderStatus;

  client_name: string;
  order_date: string;
  due_date: string | null;
  person_in_charge: string | null;
  quantity: number | null;
  renewal_check_date: string | null;
  notes: string | null;

  display_type: DisplayType;

  object_source: ObjectSource;
  preset_object_id: string | null;
  custom_model_url: string | null;

  target_image_url: string | null;
  mind_file_url: string | null;

  created_at: string;
  updated_at: string;
}
