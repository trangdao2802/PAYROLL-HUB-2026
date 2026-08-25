/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from "react";
import { Database, PieChart as PieChartIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { useAppData } from "../../../lib/contexts/AppDataContext";
import { parseMoneyToNumber } from "../../../lib/utils/data-utils";

const COLORS = [
  "#D4A656", // primary - gold/mustard
  "#F5C8C8", // secondary - pink pastel
  "#B8D4E8", // accent - blue pastel
  "#D84444", // destructive - red
  "#8B7E6C", // muted-foreground
  "#E8E4D5", // beige
];

export function DashboardCharts() {
  const { appData } = useAppData();

  const chartData = useMemo(() => {
    const centers = appData.Sheet1_AE?.data || [];
    const businessMap: Record<string, number> = {};
    const centerMap: Record<string, number> = {};

    centers.forEach((row: any) => {
      const business = row.business || row.Business || "Unknown";
      const center = row.chargetocenterCode || row["Center Code"] || "Unknown";
      const amount = parseMoneyToNumber(row.totalPayroll || row["Total Payroll"] || 0);

      businessMap[business] = (businessMap[business] || 0) + amount;
      centerMap[center] = (centerMap[center] || 0) + amount;
    });

    const businessData = Object.entries(businessMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], idx) => ({
        name,
        value,
        fill: COLORS[idx % COLORS.length],
      }));

    const centerData = Object.entries(centerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], idx) => ({
        name,
        value,
        fill: COLORS[idx % COLORS.length],
      }));

    return { businessData, centerData };
  }, [appData.Sheet1_AE?.data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
      {/* Bar Chart: Top Centers by Payroll */}
      <div className="vintage-card bg-card p-6 relative overflow-hidden group h-[450px] flex flex-col">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none pattern-dots">
          <Database className="w-24 h-24 text-primary" />
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">
              Top <span className="text-primary">Centers</span>
            </h3>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-1">
              Payroll Distribution by Mã AE
            </p>
          </div>
          <div className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md border-2 border-border shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">
            <span className="text-[0.625rem] uppercase tracking-wider font-bold">
              VND (M)
            </span>
          </div>
        </div>

        <div className="w-full relative z-10" style={{ height: "320px" }}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData.centerData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(74, 66, 56, 0.1)"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#8B7E6C",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                }}
                dy={15}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#8B7E6C",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                }}
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
              />
              <Tooltip
                cursor={{
                  fill: "rgba(212, 166, 86, 0.1)",
                  stroke: "#D4A656",
                  strokeWidth: 2,
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "2px solid rgba(74, 66, 56, 0.15)",
                  boxShadow:
                    "2px 2px 0px rgba(74, 66, 56, 0.1), 4px 4px 0px rgba(74, 66, 56, 0.05)",
                  padding: "12px",
                  fontFamily: "inherit",
                  backgroundColor: "#FFFFFF",
                }}
                itemStyle={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#4A4238",
                }}
                labelStyle={{
                  fontWeight: 700,
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "4px",
                  color: "#D4A656",
                }}
                formatter={(value: number) => [
                  formatCurrency(value),
                  "PAYROLL",
                ]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart: Business Distribution */}
      <div className="vintage-card bg-card p-6 relative overflow-hidden group h-[450px] flex flex-col">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none pattern-dots">
          <PieChartIcon className="w-24 h-24 text-primary" />
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">
              Business <span className="text-primary">Mix</span>
            </h3>
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-1">
              Revenue Stream Allocation
            </p>
          </div>
          <div className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md border-2 border-border shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">
            <span className="text-[0.625rem] uppercase tracking-wider font-bold">
              Share %
            </span>
          </div>
        </div>

        <div className="w-full relative z-10" style={{ height: "320px" }}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={chartData.businessData}
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={6}
                dataKey="value"
                strokeWidth={2}
                stroke="#FFFFFF"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "2px solid rgba(74, 66, 56, 0.15)",
                  boxShadow:
                    "2px 2px 0px rgba(74, 66, 56, 0.1), 4px 4px 0px rgba(74, 66, 56, 0.05)",
                  padding: "12px",
                  backgroundColor: "#FFFFFF",
                }}
                itemStyle={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#4A4238",
                }}
                labelStyle={{
                  fontWeight: 700,
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "4px",
                  color: "#D4A656",
                }}
                formatter={(value: number) => [
                  formatCurrency(value),
                  "PAYROLL",
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={40}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  paddingTop: "24px",
                  color: "#4A4238",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
