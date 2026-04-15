import { WebCapturedMsg } from "../whatsapp/whatsapp";

export type CliqButton = {
    label: string;
    action: string;
};

export type CliqResponse = {
    text: string;
    buttons: CliqButton[];
};

export function formatCapturedMessages(messages: WebCapturedMsg[]): CliqResponse {
    if (!messages || messages.length === 0) return { text: "", buttons: [] };

    const textParts: string[] = [];
    const buttons: CliqButton[] = [];

    for (const m of messages) {
        if (m.type === "text") {
            textParts.push(m.body);
        }
        if (m.type === "card") {
            textParts.push(`*${m.header}*\n${m.body}`);
            if (m.buttons && m.buttons.length > 0) {
                for (const b of m.buttons) {
                    buttons.push({ label: b.label, action: mapButtonIdToAction(b.id) });
                }
            }
        }
        if (m.type === "image_card") {
            textParts.push(m.body);
            if (m.buttons && m.buttons.length > 0) {
                for (const b of m.buttons) {
                    buttons.push({ label: b.label, action: mapButtonIdToAction(b.id) });
                }
            }
        }
        if (m.type === "list") {
            textParts.push(`*${m.header}*\n${m.body}`);
            for (const sec of m.sections) {
                for (const row of sec.rows) {
                    buttons.push({ label: row.title, action: row.title });
                }
            }
        }
    }

    let text = textParts.join("\n\n");
    text = text.replace(/WhatsApp/gi, "Zoho Cliq");

    return { text, buttons };
}

function mapButtonIdToAction(buttonId: string): string {
    const actionMap: Record<string, string> = {
        CREATE_EXP_REPORT: "create report",
        ADD_EXPENSE: "add expense",
        VIEW_HISTORY: "view history",
        MAIN_MENU: "menu",
        VERIFY_YES: "confirm",
        ADD_MANUAL_CAT: "add category",
        VIEW_RECENT: "view recent",
        GENERATE_REPORT: "generate report",
        PARTICIPANTS_SELF: "just me",
        PARTICIPANTS_MULTI: "multiple people",
    };
    return actionMap[buttonId] || buttonId.toLowerCase().replace(/_/g, " ");
}