import { Fragment } from 'react';

const headerClass = 'px-2 py-1.5 text-center font-bold uppercase tracking-wider text-[9px] border-r border-b border-[var(--table-border-color,#E7E5E4)] align-middle whitespace-nowrap';

export function FinancialReconcileHeader({id, splitAccount, splitAmount}: {
  id: string;
  splitAccount: boolean;
  splitAmount: boolean;
}) {
  const groups = [
    {key: 'account', label: 'Bank account', split: splitAccount},
    {key: 'amount', label: 'Total bank', split: splitAmount},
  ];
  const hasChildren = splitAccount || splitAmount;
  const rowSpan = hasChildren ? 2 : 1;
  return <thead className="sticky top-0 z-30 text-foreground shadow-sm" style={{backgroundColor: 'var(--table-column-header-bg, #F4ECD8)'}}>
    <tr>
      {[['no', 'No.'], ['id', 'ID Number'], ['name', 'Full name']].map(([key, label]) => <th key={key} id={`${id}-${key}`} scope="col" rowSpan={rowSpan} className={headerClass}>{label}</th>)}
      {groups.map(group => <th key={group.key} id={`${id}-${group.key}`} scope={group.split ? 'colgroup' : 'col'} colSpan={group.split ? 2 : 1} rowSpan={group.split ? 1 : rowSpan} className={headerClass}>{group.label}</th>)}
      {[['diff', 'Diff'], ['sync', 'Process sync'], ['problems', 'Problems']].map(([key, label]) => <th key={key} id={`${id}-${key}`} scope="col" rowSpan={rowSpan} className={headerClass}>{label}</th>)}
    </tr>
    {hasChildren && <tr>{groups.filter(group => group.split).map(group => <Fragment key={group.key}>
      <th id={`${id}-${group.key}-ae`} headers={`${id}-${group.key}`} scope="col" className={headerClass}>AE</th>
      <th id={`${id}-${group.key}-acc`} headers={`${id}-${group.key}`} scope="col" className={headerClass}>ACC</th>
    </Fragment>)}</tr>}
  </thead>;
}
