import { publicEncrypt, constants } from "crypto";

// Sandbox: https://sandbox.cashfree.com/payout  |  Production: https://api.cashfree.com/payout
// Note: We include /payout in the base URL as per V2 documentation.
export const BASE_URL = process.env.CASHFREE_PAYOUT_BASE_URL ?? "https://sandbox.cashfree.com/payout";
const CLIENT_ID     = process.env.CASHFREE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET ?? "";

/**
 * Headers for Cashfree Payouts V2 endpoints.
 * V2 uses direct API key auth — no bearer token needed.
 * Includes X-Cf-Signature if PUBLIC_KEY is provided.
 */
export function getCashfreeV2Headers(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-client-id":     CLIENT_ID,
    "x-client-secret": CLIENT_SECRET,
    "x-api-version":   "2024-01-01",
    "Content-Type":    "application/json",
  };

  const sig = generateSignature();
  if (sig) {
    headers["x-cf-signature"] = sig;
  }

  return headers;
}

// --- V2 Interfaces ---

export interface CreateBeneficiaryRequestV2 {
  beneficiary_id: string;
  beneficiary_name: string;
  beneficiary_instrument_details: {
    bank_account_number?: string;
    bank_ifsc?: string;
    vpa?: string;
  };
  beneficiary_contact_details?: {
    beneficiary_email?: string;
    beneficiary_phone?: string;
    beneficiary_country_code?: string;
    beneficiary_address?: string;
    beneficiary_city?: string;
    beneficiary_state?: string;
    beneficiary_postal_code?: string;
  };
}

export interface CreateTransferRequestV2 {
  transfer_id: string;
  transfer_amount: number;
  transfer_currency?: string;
  transfer_mode?: string;
  beneficiary_details: {
    beneficiary_id: string;
  };
  transfer_remarks?: string;
  fundsource_id?: string;
}

export interface CashfreeErrorV2 {
  type: string;
  code: string;
  message: string;
}

export interface CreateTransferResponseV2 {
  transfer_id: string;
  cf_transfer_id: string;
  status: string;
  status_code?: string;
  status_description?: string;
  beneficiary_details: any;
  transfer_amount: number;
}

export interface TransferStatusResponseV2 {
  transfer_id: string;
  cf_transfer_id: string;
  status: string;
  status_code: string;
  status_description: string;
  transfer_utr?: string;
  transfer_amount: number;
  updated_on: string;
}

// --- V2 Methods ---

/**
 * Creates a beneficiary in Cashfree Payouts Dashboard using V2 API.
 * Follows the nested structure required by V2.
 */
export async function createBeneficiaryV2(payload: CreateBeneficiaryRequestV2) {
  const res = await fetch(`${BASE_URL}/beneficiary`, {
    method: "POST",
    headers: getCashfreeV2Headers(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json as any };
}

/**
 * Initiates a standard transfer using V2 API.
 */
export async function initiateStandardTransferV2(payload: CreateTransferRequestV2) {
  const res = await fetch(`${BASE_URL}/transfers`, {
    method: "POST",
    headers: getCashfreeV2Headers(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json as CreateTransferResponseV2 & CashfreeErrorV2 };
}

/**
 * Fetches transfer status using V2 API.
 */
export async function getTransferStatusV2(transferId: string) {
  const res = await fetch(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}`, {
    method: "GET",
    headers: getCashfreeV2Headers(),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json as TransferStatusResponseV2 & CashfreeErrorV2 };
}

/**
 * Maps Cashfree status codes to internal application status.
 * Internal Statuses: PENDING | SUCCESS | FAILURE | REVERSED
 */
export function mapCashfreeStatus(status: string, statusCode: string): "PENDING" | "SUCCESS" | "FAILURE" | "REVERSED" {
  const s = status.toUpperCase();
  const c = statusCode.toUpperCase();

  if (s === "SUCCESS" || c === "COMPLETED" || c === "SENT_TO_BENEFICIARY") return "SUCCESS";
  if (s === "FAILED" || s === "REJECTED" || c === "FAILED" || c === "REJECTED") return "FAILURE";
  if (s === "REVERSED") return "REVERSED";
  
  // RECEIVED, QUEUED, PENDING, APPROVAL_PENDING, etc.
  return "PENDING";
}

/**
 * High-level helper to ensure beneficiary and initiate a transfer.
 * Does NOT perform database updates (caller manages Supabase).
 */
export async function performCashfreePayout(params: {
  applicationId: string;
  amount: number;
  userRow: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    bank_account_number: string;
    bank_ifsc: string;
    cashfree_bene_id: string | null;
  };
}) {
  const { applicationId, amount, userRow } = params;

  // 1. Ensure beneficiary exists
  const rawBeneId = userRow.cashfree_bene_id ?? `EXPIFY_${userRow.id}`;
  const beneId = rawBeneId.replace(/-/g, "_");

  const benePayload: CreateBeneficiaryRequestV2 = {
    beneficiary_id:   beneId,
    beneficiary_name: userRow.full_name.replace(/[^a-zA-Z\s]/g, "").slice(0, 100),
    beneficiary_instrument_details: {
      bank_account_number: userRow.bank_account_number,
      bank_ifsc:           userRow.bank_ifsc,
    },
    beneficiary_contact_details: {
      beneficiary_email: userRow.email,
      beneficiary_phone: (userRow.phone ?? "").replace(/\D/g, "").slice(-10),
      beneficiary_country_code: "+91",
    }
  };

  const { ok: beneOk, status: beneStatus, data: beneData } = await createBeneficiaryV2(benePayload);
  const alreadyExists = beneStatus === 409 || beneData.code === "beneficiary_already_exists";
  
  if (!beneOk && !alreadyExists) {
    throw new Error(`Beneficiary error: ${beneData.message ?? beneStatus}`);
  }

  // 2. Initiate transfer
  const transferId = `EXPIFY_${applicationId}_${Date.now()}`.replace(/-/g, "_");
  const transferPayload: CreateTransferRequestV2 = {
    transfer_id:         transferId,
    transfer_amount:     Number(amount),
    transfer_currency:   "INR",
    transfer_mode:       "banktransfer",
    beneficiary_details: { beneficiary_id: beneId },
    transfer_remarks:    `Reimbursement ${applicationId}`.replace(/[^a-zA-Z0-9\s]/g, " ").slice(0, 70),
  };

  const { ok: payOk, status: payStatus, data: payData } = await initiateStandardTransferV2(transferPayload);
  
  return {
    ok: payOk,
    status: payStatus,
    data: payData,
    transferId,
    beneId,
  };
}

/**
 * Generates the X-Cf-Signature header value.
 * Cashfree docs: RSA-OAEP-SHA1 encrypt of "<clientId>.<unixTimestamp>" using the downloaded public key.
 * IMPORTANT: The 2FA method in Cashfree dashboard must be set to "Public Key" (not "IP Whitelist").
 */
function generateSignature(): string | null {
  const rawPem = process.env.CASHFREE_PUBLIC_KEY ?? "";
  if (!rawPem) {
    console.warn("[cashfree-sig] CASHFREE_PUBLIC_KEY is not set — falling back to IP-based auth");
    return null;
  }

  try {
    // dotenv may have already converted \n to real newlines in double-quoted values.
    // We normalise both cases: literal \n and real newlines are both handled.
    const pem = rawPem.includes("\\n")
      ? rawPem.replace(/\\n/g, "\n")
      : rawPem;

    const data = `${CLIENT_ID}.${Math.floor(Date.now() / 1000)}`;

    const encrypted = publicEncrypt(
      {
        key:      pem,
        padding:  constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha1",
      },
      Buffer.from(data)
    );

    const sig = encrypted.toString("base64");
    console.log("[cashfree-sig] Signature generated successfully");
    return sig;
  } catch (err: any) {
    console.error("[cashfree-sig] Signature generation FAILED:", err?.message ?? err);
    console.error("[cashfree-sig] PEM starts with:", (process.env.CASHFREE_PUBLIC_KEY ?? "").slice(0, 40));
    return null;
  }
}

/**
 * Authenticates with Cashfree Payouts and returns a bearer token.
 * Uses X-Cf-Signature if CASHFREE_PUBLIC_KEY is set.
 * NOTE: Cashfree dashboard 2FA must be set to "Public Key" for the signature to be accepted.
 */
export async function getCashfreeToken(): Promise<string> {
  const headers: Record<string, string> = {
    "X-Client-Id":     CLIENT_ID,
    "X-Client-Secret": CLIENT_SECRET,
    "Content-Type":    "application/json",
  };

  const sig = generateSignature();
  if (sig) {
    headers["X-Cf-Signature"] = sig;
    console.log("[cashfree-auth] Using Public Key signature auth");
  } else {
    console.warn("[cashfree-auth] No signature — using IP-based auth (will fail if IP not whitelisted)");
  }

  const res = await fetch(`${BASE_URL}/v1/authorize`, {
    method: "POST",
    headers,
  });

  const json = await res.json();
  if (!res.ok || json.status !== "SUCCESS") {
    console.error("[cashfree-auth] FAILED — status:", res.status, "body:", JSON.stringify(json));
    throw new Error(`Cashfree auth failed: ${json.message ?? res.status}`);
  }

  const token = json.data?.token ?? json.token;
  if (!token) throw new Error("Cashfree auth: token missing from response");
  return token as string;
}
