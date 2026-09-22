/**
 * PageLayout — Khung layout chuẩn cho tất cả các trang có bảng.
 *
 * Pattern đúng:
 *   PageLayout (flex-1 flex-col min-h-0)
 *     [header] toolbar (shrink-0)
 *     [content area] flex-1 flex-col overflow-hidden min-h-0
 *       Table Card (flex-1 flex-col min-h-0 rounded border bg-white)
 *         Scroll Area (flex-1 overflow-auto min-h-0)  ← DUY NHẤT scroll container
 *           table > th.sticky.top-0                   ← HOẠT ĐỘNG
 *         Pagination (shrink-0)                       ← Không bao giờ bị che
 *
 * KHÔNG ĐƯỢC thêm overflow-hidden vào bất kỳ ancestor nào của sticky element.
 */

import React from "react";

interface PageLayoutProps {
  /** Thanh toolbar/breadcrumb phía trên, sẽ không bao giờ bị che */
  header?: React.ReactNode;
  /** Nội dung chính (bảng, form, v.v.) — tự fill chiều cao còn lại */
  children: React.ReactNode;
  /** Class thêm vào wrapper ngoài cùng */
  className?: string;
  /** Padding quanh nội dung (default: p-4 gap-3) */
  padding?: string;
}

export function PageLayout({
  header,
  children,
  className = "",
  padding = "p-[3rem] gap-[4rem]",
}: PageLayoutProps) {
  return (
    <div
      id="main-content"
      className={`flex-1 flex flex-col min-h-0 ${padding} bg-background content-area ${className}`}
    >
      {/* Header / Toolbar — shrink-0 đảm bảo không bao giờ bị squish */}
      {header && <div className="shrink-0 flex flex-col gap-2 filter-toolbar">{header}</div>}

      {/* Content area — flex-1 fills remaining height */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
