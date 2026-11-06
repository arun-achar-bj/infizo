export const STATUSES = [
  "Received",
  "Diagnosing",
  "Spare Parts Pending",
  "Repaired & Testing",
  "Ready for Delivery",
  "Delivered",
] as const;
export type Status = (typeof STATUSES)[number];
export type Payment = "Unpaid" | "Partial Advance" | "Fully Paid";

export const DAMAGE_OPTIONS = ["Screen cracked", "Hinge loose", "Dent on chassis", "Missing screws"] as const;

export interface LogEntry { at: string; text: string }

export interface Job {
  id: string; // Ticket_ID
  dateIn: string; // ISO
  name: string;
  phone: string;
  email: string;
  model: string;
  serial: string;
  pin: string;
  issue: string; // Issues_Reported_Voice_Text
  adapter: boolean;
  bag: boolean;
  dongle: boolean;
  damage: string[];
  conditionNote: string;
  photoFront: string; // data URL locally, Drive URL once synced
  photoLabel: string;
  photoFrontUrl?: string; // private Drive link written to the Sheet (owner-only)
  photoLabelUrl?: string;
  tech: string;
  status: Status;
  estimate: number;
  expectedDelivery: string; // datetime-local value
  partsCost: number;
  laborFee: number;
  payment: Payment;
  advance: number;
  dateRepaired: string;
  dateDelivered: string;
  signature: string; // PNG data URL
  adapterReturned: boolean;
  bagReturned: boolean;
  workLog: LogEntry[];
  synced: boolean;
}

export const finalBill = (j: Pick<Job, "partsCost" | "laborFee">) => (j.partsCost || 0) + (j.laborFee || 0);
export const balanceDue = (j: Job) => {
  const total = finalBill(j) || j.estimate;
  if (j.payment === "Fully Paid") return 0;
  if (j.payment === "Partial Advance") return Math.max(0, total - j.advance);
  return total;
};

/** Exact column order of the Google Sheet. */
export const SHEET_COLUMNS = [
  "Ticket_ID", "Date_In", "Customer_Name", "Customer_Phone", "Laptop_Brand_Model", "Serial_Number",
  "Issues_Reported_Voice_Text", "Adapter_Included", "Bag_Included", "Physical_Condition_Notes",
  "Photo_URL_Front", "Photo_URL_Label", "Assigned_Technician", "Repair_Status", "Estimated_Cost",
  "Final_Bill", "Payment_Status", "Date_Repaired", "Date_Delivered", "Customer_Signature_Status",
] as const;
