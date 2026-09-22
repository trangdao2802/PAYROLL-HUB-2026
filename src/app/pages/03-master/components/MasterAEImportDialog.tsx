import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Search, Plus } from "lucide-react";
import { mapL07, getCenterInfoByL07 } from "../../../lib/utils/center-utils";

interface MasterAEImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filteredList: {
    l07: string;
    total: number;
    count: number;
    business: string;
  }[];
  onImport: (l07: string) => void;
}

export function MasterAEImportDialog({
  isOpen,
  onClose,
  searchTerm,
  onSearchChange,
  filteredList,
  onImport,
}: MasterAEImportDialogProps) {
  // Apply mapping to L07 for display
  const processedList = filteredList.map(item => {
    const rawL07 = item.l07;
    const mappedL07 = mapL07(rawL07) || rawL07;
    const centerInfo = getCenterInfoByL07(mappedL07);
    return {
      ...item,
      displayL07: mappedL07,
      displayBusiness: centerInfo ? centerInfo.l07 : item.business,
    };
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Nhập từ Sheet 1 AE</DialogTitle>
          <div className="relative mt-4">
            <input
              type="text"
              placeholder="Tìm kiếm L07 hoặc Business..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-full text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-6 pt-0 custom-scrollbar">
          <div className="space-y-2">
            {processedList.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 flex-wrap"
              >
                <div>
                  <div className="font-bold">{item.displayL07}</div>
                  <div className="text-sm text-gray-500">{item.displayBusiness}</div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <div className="font-bold">
                      {item.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.count} bản ghi
                    </div>
                  </div>
                  <button
                    onClick={() => onImport(item.l07)}
                    className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {processedList.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                Không tìm thấy dữ liệu
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
