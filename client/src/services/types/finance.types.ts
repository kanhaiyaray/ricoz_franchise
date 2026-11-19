export type FinancePlanKind = "revenue" | "resource" | "cost";
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";
export type PaymentStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "reversed"
  | "refunded"
  | "partially_refunded";

export type RevenueStream = {
  id?: string;
  name: string;
  category: string;
  monthlyAmounts: number[];
  probability: number;
};

export type ResourcePlanRow = {
  id?: string;
  role: string;
  headcount: number;
  monthlyCost: number;
  allocationPercent: number;
};

export type CostPlanRow = {
  id?: string;
  category: string;
  description: string;
  monthlyAmounts: number[];
};

export type FinanceInvoice = {
  _id: string;
  franchiseId: string | { _id: string; name: string };
  leadId?: string;
  invoiceNumber: string;
  customer: { name: string; email: string; phone: string; address: string };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  creditedAmount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate?: string;
  notes: string;
  paymentLinkUrl?: string;
  createdAt: string;
};

export type FinancePayment = {
  _id: string;
  franchiseId: string | { _id: string; name: string };
  invoiceId?: string | { _id: string; invoiceNumber: string; customer?: { name: string } };
  amount: number;
  currency: string;
  method: "bank_transfer" | "cash" | "razorpay" | "other";
  reference: string;
  status: PaymentStatus;
  note: string;
  rejectionReason?: string;
  proof?: { fileName: string; mimeType: string; uploadedAt?: string };
  refunds?: Array<{ amount: number; reason: string; reference?: string; createdAt: string }>;
  createdAt: string;
};

export type FinanceList<T> = {
  success: true;
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type FinanceInvoiceInput = {
  franchiseId?: string;
  leadId?: string;
  customer: FinanceInvoice["customer"];
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  dueDate?: string | null;
  notes: string;
};

export type FinancePaymentInput = {
  franchiseId?: string;
  invoiceId?: string;
  amount: number;
  method: FinancePayment["method"];
  reference: string;
  note: string;
};

export type FinancePlanResponse = {
  success: true;
  fiscalYearStart: number;
  plan: { _id: string; updatedAt: string } | null;
  data: unknown;
};

export type FinanceSummaryResponse = {
  success: true;
  fiscalYearStart: number;
  period: { from: string; to: string };
  actualRevenue: number;
  invoicedRevenue: number;
  outstanding: number;
  projectedRevenue: number;
  plannedCosts: number;
  projectedNet: number;
  hasSourceData: boolean;
};

export type BillingDashboardResponse = {
  success: true;
  summary: {
    totalInvoiced: number;
    received: number;
    outstanding: number;
    overdueInvoices: number;
    invoiceCount: number;
    paymentCount: number;
  };
  recentInvoices: FinanceInvoice[];
  source: string;
};
