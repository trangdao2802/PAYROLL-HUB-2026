// Robust VN number formatter — supports decimal precision (e.g. 2 decimals)
export function formatVNRobust(num: number, decimals: number = 0): string {
  if (isNaN(num)) return "0";
  if (decimals > 0) {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }
  const rounded = Math.round(num);

  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}