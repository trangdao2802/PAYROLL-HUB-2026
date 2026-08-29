interface PayrollMarkProps {
  className?: string;
}

/** Theme-aware Payroll P mark for branded table headers and panel controls. */
export function PayrollMark({ className = "" }: PayrollMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`app-payroll-mark ${className}`.trim()}
    />
  );
}
