import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DoorClosed, Users, MapPin, Banknote, User } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Room = {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
  price: number;
  capacity: number;
  floor: number;
};

type Tenant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  residents: string | null; // "ผู้เช่า" หรือ "ลูกเช่า"
};

interface RoomDetailsDialogProps {
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RoomDetailsDialog({ room, open, onOpenChange }: RoomDetailsDialogProps) {
  const [currentTenants, setCurrentTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && room.id) {
      fetchCurrentTenants();
    }
  }, [open, room.id]);

  const fetchCurrentTenants = async () => {
    try {
      setLoading(true);

      const { data: occData, error: occError } = await supabase
        .from("occupancy")
        .select("tenant_id")
        .eq("room_id", room.id)
        .eq("is_current", true);

      if (occError || !occData || occData.length === 0) {
        console.error("❌ Error getting tenant_id:", occError);
        setCurrentTenants([]);
        return;
      }

      const tenantIds = occData.map((item) => item.tenant_id);

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .in("id", tenantIds);

      if (tenantError) {
        console.error("❌ Error fetching tenants:", tenantError);
        setCurrentTenants([]);
        return;
      }

      console.log("✅ currentTenants data:", tenantData); // 👉 DEBUG: ดูข้อมูลที่ได้
      setCurrentTenants(tenantData || []);
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      setCurrentTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "vacant":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "occupied":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const renderAvatar = (name: string) => {
    const [first, last] = name.split(" ");
    return (
      <Avatar className="h-8 w-8">
        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
        <AvatarFallback className="text-xs">
          {first?.charAt(0)}
          {last?.charAt(0)}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorClosed className="h-5 w-5" />
            ห้อง {room.room_number} รายละเอียด
          </DialogTitle>
          <DialogDescription>ข้อมูลทั้งหมดของห้องนี้</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">สถานะ</span>
            <Badge className={`capitalize ${getStatusColor(room.status)}`}>
              {room.status === "vacant"
                ? "ว่าง"
                : room.status === "occupied"
                ? "มีผู้เช่า"
                : "ซ่อมแซม"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">ประเภทห้อง</span>
            <span className="text-sm font-medium">{room.room_type}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" /> ค่าเช่ารายเดือน
            </span>
            <span className="text-sm font-bold text-green-600">
              {formatPrice(room.price)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> ความจุ
            </span>
            <span className="text-sm font-medium">{room.capacity} คน</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> ชั้น
            </span>
            <span className="text-sm font-medium">{room.floor}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">ผู้เช่าปัจจุบัน</span>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
            ) : currentTenants.length > 0 ? (
              currentTenants
                .slice()
                .sort((a, b) => {
                  const getPriority = (res: any) =>
                    res.residents === "ผู้เช่า" ? 0 : res.residents === "ลูกเช่า" ? 1 : 2;
                  return getPriority(a) - getPriority(b);
                })
                .map((tenant) => {
                  return (
                    <div key={tenant.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50">
                      <div className="text-sm font-semibold text-muted-foreground">
                        {tenant.residents === "ผู้เช่า" ? "ผู้เช่าหลัก" : "ลูกเช่า"}
                      </div>
                      <div className="flex items-center gap-3">
                        {renderAvatar(`${tenant.first_name} ${tenant.last_name}`)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {tenant.first_name} {tenant.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tenant.email || tenant.phone || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-sm text-muted-foreground">ไม่มีผู้เช่าในปัจจุบัน</div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">รหัสห้อง</span>
              <span className="text-xs font-mono text-muted-foreground">{room.id}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
