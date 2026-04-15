import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession, clearSession } from "../../whatsapp/session";
import { startCapture, popCapture } from "../../whatsapp/whatsapp";
import { createClient } from "@/utils/supabase/server";
import {
    handleCliqExpenseFlow,
    sendCliqWelcomeCard,
    sendCliqAppList,
} from "../../whatsapp/cliq-expense-flow";
import { getAgentReply } from "../../whatsapp/agent";
import { saveChatMessage, upsertCliqId } from "../../whatsapp/db";
import { formatCapturedMessages } from "../format";

const ACTION_TO_BUTTON_ID: Record<string, string> = {
    "create report": "CREATE_EXP_REPORT",
    "add expense": "ADD_EXPENSE",
    "view history": "VIEW_HISTORY",
    menu: "MAIN_MENU",
    confirm: "VERIFY_YES",
    "add category": "ADD_MANUAL_CAT",
    "view recent": "VIEW_RECENT",
    "generate report": "GENERATE_REPORT",
    "just me": "PARTICIPANTS_SELF",
    "multiple people": "PARTICIPANTS_MULTI",
};

export async function POST(req: NextRequest) {
    try {
        const apiKey = req.headers.get("x-cliq-api-key");
        if (apiKey !== process.env.CLIQ_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const contentType = req.headers.get("content-type") || "";
        console.log("[Cliq] Content-Type:", contentType);

        // =========================
        // MULTIPART UPLOAD FLOW
        // =========================
        if (contentType.toLowerCase().includes("multipart/form-data")) {
            let formData: FormData;

            try {
                formData = await req.formData();
            } catch (err) {
                console.error("[Cliq] formData parse failed:", err);
                return NextResponse.json(
                    { text: "Backend could not parse uploaded form-data." },
                    { status: 400 }
                );
            }

            const text = String(formData.get("text") || "");
            const userId = String(formData.get("userId") || "");
            const firstName = String(formData.get("firstName") || "");
            const lastName = String(formData.get("lastName") || "");
            const email = String(formData.get("email") || "");
            const hasAttachment = String(formData.get("hasAttachment") || "");
            const attachmentName = String(formData.get("attachmentName") || "");
            const file = formData.get("file");

            console.log("[Cliq] Multipart fields:", {
                text,
                userId,
                firstName,
                lastName,
                email,
                hasAttachment,
                attachmentName,
                fileType: file ? typeof file : "null",
                hasFile: file instanceof File,
            });

            if (!userId) {
                return NextResponse.json(
                    { text: "Missing userId in upload request." },
                    { status: 400 }
                );
            }

            const sessionKey = `cliq:${userId}`;
            const userName = [firstName, lastName].filter(Boolean).join(" ");
            const supabase = await createClient();

            // Link Cliq userId to Supabase user record
            if (email) await upsertCliqId(userId, email, supabase);

            startCapture(sessionKey);

            await saveChatMessage(
                {
                    phone: sessionKey,
                    role: "user",
                    content: `[Attachment] ${attachmentName || "uploaded file"}`,
                },
                supabase
            );

            const session = await getSession(sessionKey);

            if (userName && !session.userName) {
                session.userName = userName;
                await setSession(sessionKey, session);
            }

            if (!(file instanceof File)) {
                return NextResponse.json({
                    text: "No file received in backend.",
                    buttons: [{ label: "Main Menu", action: "menu" }],
                });
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            console.log("[Cliq] File received:", {
                name: file.name,
                type: file.type,
                size: file.size,
                bytes: buffer.length,
                sessionStep: session.step,
            });

            await handleCliqExpenseFlow(
                sessionKey,
                session,
                "IMAGE_UPLOAD",
                "IMAGE_UPLOAD",
                buffer,
                file.name,
                file.type,
                supabase
            );

            const botMessages = popCapture(sessionKey);

            for (const m of botMessages) {
                let content = "";
                if (m.type === "text") content = m.body;
                else if (m.type === "card" || m.type === "image_card")
                    content = `[Card] ${m.body}`;
                else if (m.type === "list") content = `[List] ${m.body}`;

                await saveChatMessage(
                    { phone: sessionKey, role: "assistant", content, messageType: m.type },
                    supabase
                );
            }

            const { text: responseText, buttons } = formatCapturedMessages(botMessages);

            return NextResponse.json({
                text: responseText || "Receipt processed successfully.",
                buttons,
            });
        }

        // =========================
        // NORMAL JSON FLOW
        // =========================
        let body: any;
        try {
            body = await req.json();
        } catch (err) {
            console.error("[Cliq] JSON parse failed:", err);
            return NextResponse.json(
                { text: "Backend could not parse JSON request." },
                { status: 400 }
            );
        }

        const { text, userId, firstName, lastName, email } = body;

        console.log("[Cliq] Raw body received:", JSON.stringify(body));

        if (!userId) {
            console.error("[Cliq] 400 — Missing userId");
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const sessionKey = `cliq:${userId}`;
        const userName = [firstName, lastName].filter(Boolean).join(" ");
        const normalizedText = typeof text === "string" ? text.trim() : "";
        const lower = normalizedText.toLowerCase();

        console.log(`[Cliq] Message from ${userName} (${sessionKey}): ${normalizedText}`);

        const supabase = await createClient();

        // Link Cliq userId to Supabase user record
        if (email) await upsertCliqId(userId, email, supabase);

        startCapture(sessionKey);

        await saveChatMessage(
            { phone: sessionKey, role: "user", content: normalizedText },
            supabase
        );

        const session = await getSession(sessionKey);

        if (userName && !session.userName) {
            session.userName = userName;
            await setSession(sessionKey, session);
        }

        if (!normalizedText || normalizedText === "null") {
            if (session.step === "awaiting_receipt") {
                return NextResponse.json({
                    text:
                        "📷 *Step 2: Upload Receipt*\n\nPlease upload your UPI screenshot or payment receipt directly in this chat.",
                    buttons: [{ label: "Main Menu", action: "menu" }],
                });
            }

            return NextResponse.json({
                text: "I can only process text messages right now. Type *menu* to see available options.",
                buttons: [],
            });
        }

        const buttonId = ACTION_TO_BUTTON_ID[lower];
        const greetings = ["hi", "hii", "hello", "hey", "start"];

        if (greetings.includes(lower) || lower === "menu") {
            await clearSession(sessionKey);
            await sendCliqWelcomeCard(sessionKey, userName);
        } else if (buttonId === "CREATE_EXP_REPORT") {
            await clearSession(sessionKey);
            const fresh = await getSession(sessionKey);
            fresh.userName = userName;
            fresh.step = "awaiting_app_client";
            await setSession(sessionKey, fresh);

            const { sendText } = await import("../../whatsapp/whatsapp");
            await sendText(
                sessionKey,
                "*Step 1: Client Name*\n\nPlease enter the name of the client for this expense report."
            );
        } else if (buttonId === "ADD_EXPENSE") {
            await sendCliqAppList(sessionKey, "awaiting_app_selection_add", supabase);
        } else if (buttonId === "VIEW_HISTORY") {
            await sendCliqAppList(sessionKey, "awaiting_app_selection_view", supabase);
        } else if (buttonId === "MAIN_MENU") {
            await clearSession(sessionKey);
            await sendCliqWelcomeCard(sessionKey, userName);
        } else if (
            buttonId === "VERIFY_YES" &&
            (session.step === "awaiting_verification" ||
                session.step === "awaiting_manual_category")
        ) {
            await handleCliqExpenseFlow(
                sessionKey,
                session,
                normalizedText,
                buttonId,
                undefined,
                undefined,
                undefined,
                supabase
            );
        } else if (
            buttonId === "ADD_MANUAL_CAT" &&
            session.step === "awaiting_verification"
        ) {
            await handleCliqExpenseFlow(
                sessionKey,
                session,
                normalizedText,
                buttonId,
                undefined,
                undefined,
                undefined,
                supabase
            );
        } else if (
            buttonId === "PARTICIPANTS_SELF" &&
            session.step === "awaiting_app_participants_count"
        ) {
            await handleCliqExpenseFlow(
                sessionKey,
                session,
                normalizedText,
                "PARTICIPANTS_SELF",
                undefined,
                undefined,
                undefined,
                supabase
            );
        } else if (
            buttonId === "PARTICIPANTS_MULTI" &&
            session.step === "awaiting_app_participants_count"
        ) {
            await handleCliqExpenseFlow(
                sessionKey,
                session,
                normalizedText,
                "PARTICIPANTS_MULTI",
                undefined,
                undefined,
                undefined,
                supabase
            );
        } else if (session.step !== "idle") {
            if (
                session.step === "awaiting_app_selection_add" ||
                session.step === "awaiting_app_selection_view"
            ) {
                await handleCliqExpenseFlow(
                    sessionKey,
                    session,
                    normalizedText,
                    normalizedText.toUpperCase(),
                    undefined,
                    undefined,
                    undefined,
                    supabase
                );
            } else {
                await handleCliqExpenseFlow(
                    sessionKey,
                    session,
                    normalizedText,
                    buttonId,
                    undefined,
                    undefined,
                    undefined,
                    supabase
                );
            }
        } else {
            try {
                const reply = await getAgentReply(sessionKey, normalizedText);
                if (reply) {
                    const { sendText } = await import("../../whatsapp/whatsapp");
                    await sendText(sessionKey, reply);
                } else {
                    await sendCliqWelcomeCard(sessionKey, userName);
                }
            } catch (err) {
                console.error("[Cliq] Agent error:", err);
                const { sendText } = await import("../../whatsapp/whatsapp");
                await sendText(
                    sessionKey,
                    "We're experiencing a temporary issue. Type *menu* to restart."
                );
            }
        }

        const botMessages = popCapture(sessionKey);

        for (const m of botMessages) {
            let content = "";
            if (m.type === "text") content = m.body;
            else if (m.type === "card" || m.type === "image_card")
                content = `[Card] ${m.body}`;
            else if (m.type === "list") content = `[List] ${m.body}`;

            await saveChatMessage(
                { phone: sessionKey, role: "assistant", content, messageType: m.type },
                supabase
            );
        }

        const { text: responseText, buttons } = formatCapturedMessages(botMessages);

        const currentSession = await getSession(sessionKey);
        if (
            currentSession.step === "awaiting_receipt" &&
            !buttons.some((b) => b.action === "menu")
        ) {
            buttons.push({ label: "Main Menu", action: "menu" });
        }

        return NextResponse.json({
            text:
                responseText ||
                "Sorry, I didn't quite catch that. Type *menu* to start over.",
            buttons,
        });
    } catch (err: any) {
        console.error("[Cliq] Webhook Error:", err.message || err);
        return NextResponse.json(
            { error: err.stack || err.message || "Internal error" },
            { status: 500 }
        );
    }
}