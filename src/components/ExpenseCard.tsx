"use client";

import { Calendar, User, Tag, IndianRupee, Users, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { ExpenseRow } from "./ExpensesTable";
import { cn } from "@/lib/utils";

interface ExpenseCardProps {
  record: ExpenseRow;
  selected?: boolean;
  onClick?: () => void;
}

export function ExpenseCard({ record, selected, onClick }: ExpenseCardProps) {
  const isVerified = record.verified;
  const hasMismatches = record.mismatches && record.mismatches.length > 0;
  const imageUrl = record.receipts && record.receipts.length > 0 ? record.receipts[0].image_url : null;
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "premium-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 transition-all group active:scale-[0.99]",
        selected && "border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-500/10"
      )}
    >
      <div className="flex items-center gap-5 flex-1 min-w-0">
        {/* Receipt Image Thumbnail */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0 group-hover:border-zinc-300 transition-colors shadow-sm">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Receipt" 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <ReceiptTextLucide size={24} strokeWidth={1.5} />
            </div>
          )}
          {/* Status Dot Overlay */}
          <div className={cn(
            "absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm",
            isVerified ? "bg-emerald-500" : (hasMismatches ? "bg-red-500" : "bg-amber-500")
          )} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10 flex-1 min-w-0">
          {/* Date & Type */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider font-outfit">
                {new Date(record.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-zinc-300">•</span>
              <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[100px]">
                {record.application_id || "No App ID"}
              </span>
            </div>
            <h4 className="text-[15px] font-bold text-zinc-900 truncate leading-tight">
              {record.expense_type}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-zinc-500 font-medium italic">
                {record.city || "No location"}
              </span>
              {record.city_tier && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-bold">
                  {record.city_tier}
                </span>
              )}
            </div>
          </div>

          {/* Amount info */}
          <div className="flex flex-col gap-1.5 sm:min-w-[120px]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Claimed</div>
            <div className="text-[16px] font-extrabold text-zinc-900 font-outfit tracking-tight">
              ₹{record.claimed_amount_numeric?.toLocaleString("en-IN") || record.claimed_amount.replace('₹', '')}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-[120px]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Approved</div>
            <div className="text-[16px] font-extrabold text-emerald-600 font-outfit tracking-tight">
              ₹{record.total_receipt_amount?.toLocaleString("en-IN") || '0'}
            </div>
          </div>
        </div>
      </div>

      {/* Action/Status */}
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        {!record.amount_match && record.verified ? (
          <div className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-red-100 shadow-sm">
            <XCircle size={14} />
            Amount Mismatch
          </div>
        ) : (
          <div className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border shadow-sm",
            isVerified 
              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
              : "bg-amber-50 text-amber-600 border-amber-100"
          )}>
            {isVerified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isVerified ? "Audit Cleared" : "Awaiting Audit"}
          </div>
        )}
        <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ReceiptText({ size, style }: { size: number, style?: React.CSSProperties }) {
    return <ReceiptTextLucide size={size} style={style} />;
}
import { ReceiptText as ReceiptTextLucide } from "lucide-react";
