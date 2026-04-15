// ─────────────────────────────────────────────────────────────────────────────
// cliq-expense-flow.ts — Cliq-specific expense flow
// Keeps WhatsApp flow untouched
// ─────────────────────────────────────────────────────────────────────────────

import type { ExpenseSession, ReceiptMismatch, ExpenseRecord } from "./types";
import { getSession, setSession, clearSession } from "./session";
import { sendText, sendCard, sendList, sendImageCard } from "./whatsapp";
import { analyseReceipt, predictCategory } from "./vision";
import { triggerAudit } from "./agent";
import { getUserApplications, saveApplicationToSupabase, getApplicationDetails } from "./db";
import { getCityTier } from "./city-tool";

const LOGO_URL =
    process.env.FRISTINE_LOGO_URL ||
    "https://fristinetech.com/wp-content/uploads/2023/05/Fristine-Infotech-Website-Logo.png";

export async function sendCliqWelcomeCard(to: string, userName?: string): Promise<void> {
    const name = userName ? `*${userName}*` : "there";
    await sendImageCard(
        to,
        LOGO_URL,
        `Hello, ${name}.\n\nYou are connected to the *Fristine Infotech Expense Management System*.\n\nThis platform allows you to submit, track, and review business expenses directly from Zoho Cliq.\n\nHow may I assist you today?`,
        "Fristine Infotech · Expense Management",
        [
            { id: "CREATE_EXP_REPORT", label: "Create Report" },
            { id: "ADD_EXPENSE", label: "Add Expense" },
            { id: "VIEW_HISTORY", label: "View History" },
        ]
    );
}

export function detectCliqMismatches(session: ExpenseSession): ReceiptMismatch {
    const receipts = session.extractedReceipts ?? [];
    if (receipts.length === 0) return { type: "none" };

    const totalExtracted = session.totalReceiptAmount ?? 0;
    const claimed = session.amountNumeric ?? 0;
    const amountMismatch =
        claimed > 0 && totalExtracted > 0 && Math.abs(totalExtracted - claimed) >= 1;

    let dateMismatch = false;
    const sessionDateStr = (session.dateRange ?? "").toLowerCase();
    const firstReceiptDate = receipts[0]?.date;

    if (
        firstReceiptDate &&
        sessionDateStr &&
        !sessionDateStr.includes("–") &&
        !sessionDateStr.includes("-")
    ) {
        const receiptLower = firstReceiptDate.toLowerCase();
        const sessionLower = sessionDateStr.toLowerCase();
        const sessionTokens = sessionLower.split(/\s+/);
        const matched = sessionTokens.some((t) => receiptLower.includes(t) && t.length > 2);
        if (!matched) dateMismatch = true;
    }

    if (amountMismatch && dateMismatch) {
        return {
            type: "both",
            claimedAmount: session.amount,
            receiptAmount: `Rs. ${totalExtracted.toFixed(2)}`,
            claimedDate: session.dateRange,
            receiptDate: firstReceiptDate,
            shortfallAmount: claimed - totalExtracted,
        };
    }

    if (amountMismatch) {
        return {
            type: "amount",
            claimedAmount: session.amount,
            receiptAmount: `Rs. ${totalExtracted.toFixed(2)}`,
            shortfallAmount: claimed - totalExtracted,
        };
    }

    if (dateMismatch) {
        return {
            type: "date",
            claimedDate: session.dateRange,
            receiptDate: firstReceiptDate,
        };
    }

    return { type: "none" };
}

function buildCliqVerificationBody(
    session: ExpenseSession,
    mismatch: ReceiptMismatch
): string {
    const receipts = session.extractedReceipts ?? [];
    const lines: string[] = [];

    lines.push("*Step 3: Verification*\n");

    receipts.forEach((r, i) => {
        if (receipts.length > 1) lines.push(`_Receipt ${i + 1} of ${receipts.length}_`);
        lines.push(`*Date:* ${r.date ?? "—"}`);
        lines.push(`*Time:* ${r.transactionTime ?? "—"}`);
        lines.push(`*Amount:* ${r.amount ?? "—"}`);
        lines.push(`*Merchant:* ${r.merchant ?? "—"}`);
        lines.push(`*Category:* ${r.merchantCategory ?? "Miscellaneous"}`);
        lines.push(`*UTR:* ${r.utrNumber ?? "—"}`);
        if (receipts.length > 1 && i < receipts.length - 1) lines.push("");
    });

    lines.push("\nPlease confirm the details above are accurate.");
    return lines.join("\n");
}

function buildCliqConfirmationBody(session: ExpenseSession): string {
    const r = session.extractedReceipts?.[0];
    return [
        "*Expense Submitted Successfully*\n",
        `Application ID: ${session.applicationId}`,
        `Date: ${r?.date || "—"}`,
        `Merchant: ${r?.merchant || "—"}`,
        `Amount: ${r?.amount || session.amount || "—"}`,
        `\nYour expense has been recorded in Supabase.`,
    ].join("\n");
}

function generateAppId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `EXP-${result}`;
}

async function finalizeCliqApplication(
    phone: string,
    session: ExpenseSession,
    supabaseClient?: unknown
): Promise<void> {
    session.applicationId = generateAppId();
    session.step = "idle";

    await saveApplicationToSupabase(
        {
            userPhone: phone,
            applicationId: session.applicationId,
            clientName: session.clientName || "Unknown",
            visitDuration: session.visitDuration || "Unknown",
            city: session.city || "Unknown",
            cityTier: session.cityTier || "Tier - III",
            participantCount: session.appParticipantCount || 1,
            participantDetails: session.appParticipantDetails || [],
        },
        session.userId,
        supabaseClient
    );

    const participantsStr =
        session.appParticipantCount && session.appParticipantCount > 1
            ? `\n*Participants:* ${session.appParticipantCount}`
            : "";

    const msg = [
        `*Application Created Successfully!*`,
        ``,
        `*ID:* ${session.applicationId}`,
        `*Client:* ${session.clientName}`,
        `*Duration:* ${session.visitDuration}`,
        `*City:* ${session.city} (${session.cityTier})${participantsStr}`,
        ``,
        `You can now use this ID to add expenses.`,
    ].join("\n");

    await sendCard(phone, "Success", msg, "Fristine Infotech", [
        { id: "ADD_EXPENSE", label: "Add Expense" },
        { id: "MAIN_MENU", label: "Main Menu" },
    ]);

    await setSession(phone, session);
}

export async function handleCliqExpenseFlow(
    phone: string,
    session: ExpenseSession,
    incomingText: string,
    buttonId?: string,
    fileBuffer?: Buffer,
    fileName?: string,
    fileMimeType?: string,
    supabaseClient?: unknown
): Promise<void> {
    const input = buttonId || incomingText.trim();

    switch (session.step) {
        case "awaiting_app_client": {
            session.clientName = incomingText.trim();
            session.step = "awaiting_app_duration";
            await setSession(phone, session);
            await sendText(
                phone,
                "*Step 2: Duration*\n\nPlease enter the duration of the visit (e.g., '10 Mar 2026 - 15 Mar 2026')."
            );
            break;
        }

        case "awaiting_app_duration": {
            session.visitDuration = incomingText.trim();
            session.step = "awaiting_app_city";
            await setSession(phone, session);
            await sendText(phone, "*Step 3: City*\n\nPlease enter the name of the city you are visiting.");
            break;
        }

        case "awaiting_app_city": {
            session.city = incomingText.trim();
            session.cityTier = getCityTier(session.city);

            await sendCard(
                phone,
                "Participants",
                "Is this trip for you only or are there multiple participants?",
                "Fristine Infotech",
                [
                    { id: "PARTICIPANTS_SELF", label: "Just Me" },
                    { id: "PARTICIPANTS_MULTI", label: "Multiple People" },
                ]
            );

            session.step = "awaiting_app_participants_count";
            await setSession(phone, session);
            break;
        }

        case "awaiting_app_participants_count": {
            if (input === "PARTICIPANTS_SELF") {
                session.appParticipantCount = 1;
                session.appParticipantDetails = [];
                return finalizeCliqApplication(phone, session, supabaseClient);
            } else if (input === "PARTICIPANTS_MULTI") {
                await sendText(phone, "Please enter the number of participants (including yourself):");
                return;
            }

            const count = parseInt(incomingText.trim(), 10);
            if (isNaN(count) || count < 1) {
                await sendText(phone, "Please enter a valid number (e.g., 2, 3, 4).");
                return;
            }

            session.appParticipantCount = count;
            await sendText(
                phone,
                `Please enter the names and mobile numbers of the other ${count - 1} participants.\nFormat:\nName - Number\nName - Number`
            );
            session.step = "awaiting_app_participants_details";
            await setSession(phone, session);
            break;
        }

        case "awaiting_app_participants_details": {
            const lines = incomingText.trim().split("\n");
            const details = lines
                .map((line) => {
                    const parts = line.split("-");
                    const name = (parts[0] || "").trim();
                    const phoneVal = (parts[1] || "").trim();
                    return { name: name || "Unknown", phone: phoneVal || "Unknown" };
                })
                .filter((d) => d.name !== "Unknown");

            session.appParticipantDetails = details;
            return finalizeCliqApplication(phone, session, supabaseClient);
        }

        case "awaiting_app_selection_add": {
            const appId = incomingText.trim().toUpperCase();
            session.applicationId = appId;
            
            // Fetch application details to show client name
            const app = await getApplicationDetails(appId, phone, session.userId, supabaseClient);
            if (app) {
                session.clientName = app.clientName;
                session.visitDuration = app.visitDuration;
                session.city = app.city;
                session.cityTier = app.cityTier;
            }

            session.step = "awaiting_receipt";
            await setSession(phone, session);
            
            const clientInfo = session.clientName ? ` (Client: ${session.clientName})` : "";
            await sendText(
                phone,
                `*App Selected: ${session.applicationId}${clientInfo}*\n\n*Step 2: Upload Receipt*\n\nPlease upload the UPI screenshot or payment receipt.`
            );
            break;
        }

        case "awaiting_app_selection_view": {
            const appId = incomingText.trim().toUpperCase();
            const { getExpensesByApplication } = await import("./db");
            const rows = await getExpensesByApplication(phone, appId, session.userId, supabaseClient);

            if (rows.length === 0) {
                await sendText(phone, `No expenses found for Application ID: *${appId}*.`);
            } else {
                const summary = rows
                    .map(
                        (r, i) =>
                            `*${i + 1}.* ${r.expense_type} - ${r.claimed_amount}\n   ${new Date(r.created_at).toLocaleDateString("en-IN")}`
                    )
                    .join("\n\n");
                await sendText(phone, `*History for ${appId}*\n\n${summary}`);
            }

            session.step = "idle";
            await setSession(phone, session);
            break;
        }

        case "awaiting_receipt": {
            if (!fileBuffer || !fileMimeType) {
                await sendText(phone, "Please upload an image of your payment receipt/screenshot.");
                return;
            }

            await sendText(phone, "_Extracting data from receipt..._");

            const mediaBase64 = fileBuffer.toString("base64");
            const extracted = await analyseReceipt(mediaBase64, fileMimeType);
            extracted.transactionTime = (extracted as { time?: string }).time;

            const prediction = await predictCategory(
                extracted.merchant || "Unknown",
                extracted.date || "Unknown",
                extracted.transactionTime || "Unknown"
            );
            extracted.merchantCategory = prediction.category;

            session.receiptMediaIds = [fileName || "cliq-upload"];
            session.extractedReceipts = [extracted];
            session.totalReceiptAmount = extracted.amountNumeric ?? 0;
            session.amount = extracted.amount;
            session.amountNumeric = extracted.amountNumeric;
            session.step = "awaiting_verification";

            await setSession(phone, session);
            await sendCliqVerificationCard(phone, session);
            break;
        }

        case "awaiting_manual_category": {
            if (session.extractedReceipts && session.extractedReceipts.length > 0) {
                session.extractedReceipts[0].merchantCategory = incomingText.trim();
                session.step = "awaiting_verification";
                await setSession(phone, session);
                await sendCliqVerificationCard(phone, session);
            }
            break;
        }

        case "awaiting_verification": {
            if (input === "VERIFY_YES") {
                await finalizeCliqExpense(phone, session, supabaseClient);
            } else if (input === "ADD_MANUAL_CAT") {
                session.step = "awaiting_manual_category";
                await setSession(phone, session);
                await sendText(
                    phone,
                    "Please type the correct category for this expense (e.g., 'Travel', 'Lunch', 'Hotel')."
                );
            }
            break;
        }

        default:
            break;
    }
}

export async function sendCliqVerificationCard(
    phone: string,
    session: ExpenseSession,
    mismatch: ReceiptMismatch = { type: "none" }
): Promise<void> {
    await sendCard(
        phone,
        "Verification",
        buildCliqVerificationBody(session, mismatch),
        "Fristine Infotech · Expense Management",
        [
            { id: "VERIFY_YES", label: "Confirm" },
            { id: "ADD_MANUAL_CAT", label: "Add Category" },
        ]
    );
}

export async function finalizeCliqExpense(
    phone: string,
    session: ExpenseSession,
    supabaseClient?: unknown
): Promise<void> {
    const { saveExpenseToSupabase } = await import("./db");

    const record: ExpenseRecord = {
        meta: {
            recordedAt: new Date().toISOString(),
            userPhone: phone,
            userName: session.userName || "Cliq User",
            sessionId: phone + "-" + Date.now(),
        },
        expense: {
            dateRange: session.extractedReceipts?.[0]?.date || "Unknown",
            normalizedDateRange: session.extractedReceipts?.[0]?.date || "Unknown",
            type: session.extractedReceipts?.[0]?.merchantCategory || "Miscellaneous",
            subCategory: "",
            claimedAmount: session.extractedReceipts?.[0]?.amount || "0",
            claimedAmountNumeric: session.extractedReceipts?.[0]?.amountNumeric || 0,
            applicationId: session.applicationId,
            clientName: session.clientName,
            visitDuration: session.visitDuration,
            city: session.city,
            cityTier: session.cityTier,
            participants: {
                type: session.personType || "single",
                count: session.personCount || 1,
                names: session.personNames || ["Self"],
            },
        },
        receipts: {
            count: session.extractedReceipts?.length || 0,
            totalExtractedAmount: session.totalReceiptAmount || 0,
            amountMatch: true,
            dateMatch: true,
            items: (session.extractedReceipts || []).map((r, i) => ({
                mediaId: session.receiptMediaIds?.[i] || "",
                extractedAmount: r.amount || "0",
                utrNumber: r.utrNumber || "",
                transactionId: r.transactionId || "",
                paymentMethod: r.paymentMethod || "",
                merchant: r.merchant || "",
                transactionDate: r.date || "",
                transactionTime: r.transactionTime || "",
                status: r.status || "",
                rawDescription: r.rawDescription || "",
            })),
        },
        verification: {
            verified: false,
            verifiedAt: new Date().toISOString(),
            mismatches: [],
        },
    };

    const expenseId = await saveExpenseToSupabase(record, session.userId, supabaseClient);

    await clearSession(phone);

    await sendCard(
        phone,
        "Expense Submitted",
        buildCliqConfirmationBody(session),
        "Fristine Infotech · Expense Management",
        [
            { id: "ADD_EXPENSE", label: "New Expense" },
            { id: "VIEW_HISTORY", label: "View History" },
        ]
    );

    if (expenseId) {
        try {
            console.log(`[Cliq Flow] Triggering auto-audit for ${expenseId}`);
            const auditResult = await triggerAudit(expenseId, session);
            if (auditResult) {
                let msg = `*Audit Status Update*\n\n`;
                if (auditResult.verified) {
                    msg += `✅ Your expense has been *Verified* against company policy.`;
                } else {
                    msg += `⚠️ *Policy Mismatch Detected*\n\n${auditResult.explanation}\n\nPlease review the details in your dashboard.`;
                }
                await sendText(phone, msg);
            }
        } catch (err) {
            console.error("[Cliq Flow] Audit trigger failed:", err);
        }
    }
}

export async function sendCliqAppList(
    to: string,
    step: "awaiting_app_selection_add" | "awaiting_app_selection_view",
    supabaseClient?: unknown
): Promise<void> {
    const session = await getSession(to);
    const apps = await getUserApplications(to, session.userId, supabaseClient);

    if (apps.length === 0) {
        await sendText(to, "No expense reports found. Please create one first.");
        return;
    }

    await sendList(
        to,
        "Select Application",
        "Please select the Application ID related to this request.",
        "Fristine Infotech",
        "Select App",
        [
            {
                title: "Recent Applications",
                rows: apps.slice(0, 10).map((id) => ({ id, title: id })),
            },
        ]
    );

    session.step = step;
    await setSession(to, session);
}