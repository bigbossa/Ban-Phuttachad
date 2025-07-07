import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

interface ViewContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
}

export default function ViewContractDialog({
  open,
  onOpenChange,
  tenantId,
}: ViewContractDialogProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setFileUrl(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    const pdfUrl = `https://api-stripe-ban-phuttachad-dormitory.onrender.com/images/${tenantId}.pdf`;
    const imageUrl = `https://api-stripe-ban-phuttachad-dormitory.onrender.com/images/${tenantId}.jpg`;

    fetch(pdfUrl, { method: "HEAD" })
      .then((res) => {
        if (isCancelled) return;
        if (res.ok) {
          setFileUrl(pdfUrl);
        } else {
          return fetch(imageUrl, { method: "HEAD" }).then((res2) => {
            if (isCancelled) return;
            if (res2.ok) setFileUrl(imageUrl);
            else setFileUrl(null);
          });
        }
      })
      .catch(() => {
        if (!isCancelled) setFileUrl(null);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [tenantId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>ดูไฟล์สัญญา</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground">กำลังโหลดไฟล์...</p>
        ) : fileUrl ? (
          fileUrl.endsWith(".pdf") ? (
            <iframe
              src={fileUrl}
              title="PDF Contract"
              className="w-full h-[600px] rounded border"
            />
          ) : (
            <img
              src={fileUrl}
              alt="Contract"
              className="w-full max-h-[600px] object-contain rounded border"
            />
          )
        ) : (
          <p className="text-center text-muted-foreground">ไม่พบไฟล์สัญญา</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
