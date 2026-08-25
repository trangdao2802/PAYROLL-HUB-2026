import React from "react";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { Clock } from "lucide-react";
import { format } from "date-fns";

export const SaveStatusCard: React.FC<{ 
  className?: string; 
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
  iconStyle?: React.CSSProperties;
  scope?: "default" | "transaction";
}> = ({ className, style, textStyle, iconStyle, scope = "default" }) => {
  const { appData } = useAppData();

  const transactionActivity = appData?.TransactionActivity;
  const timestamp = scope === "transaction"
    ? transactionActivity?.lastSavedAt || transactionActivity?.generatedAt
    : appData?.updatedAt;
  const lastUpdated = timestamp ? new Date(timestamp) : null;
  
  if (!lastUpdated || isNaN(lastUpdated.getTime())) return null;

  // Format with AM/PM then replace to SA/CH for Vietnamese localization
  const formattedTime = format(lastUpdated, "dd/MM/yyyy hh:mm a");
  const formattedWithAmPm = formattedTime
    .replace("AM", "SA")
    .replace("PM", "CH");

  return (
    <div 
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 shadow-sm relative z-10 animate-in fade-in zoom-in-95 w-max shrink-0 ${className || ""}`}
      style={style}
      title={scope === "transaction"
        ? "Thời điểm cập nhật Transaction mới nhất và tổng số lần đã lưu chỉnh sửa kể từ khi tạo bảng kê."
        : "Dữ liệu chỉ phản ánh các giá trị đã được ghi nhận trước thời điểm này."}
    >
      <Clock 
        className="w-3.5 h-3.5 text-blue-500 animate-pulse shrink-0" 
        style={iconStyle}
      />
      <span 
        className="text-[0.65rem] font-bold tracking-wider text-blue-700 uppercase whitespace-nowrap"
        style={{ fontSize: "9px", lineHeight: "15px", ...textStyle }}
      >
        {scope === "transaction" ? "TRANSACTION" : "SAVED"}: {formattedWithAmPm}
        {scope === "transaction" && (
          <span className="ml-1.5 border-l border-blue-200 pl-1.5" style={{ fontSize: "9px", lineHeight: "13px" }}>
            SỬA: {transactionActivity?.editCount || 0}
          </span>
        )}
      </span>
    </div>
  );
};
