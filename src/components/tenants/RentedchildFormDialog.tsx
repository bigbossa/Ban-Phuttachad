import { useForm } from "react-hook-form";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room_id: string;
  room_number: string;
  isLoading?: boolean;
}

export default function RentedchildFormDialog({
  open,
  onOpenChange,
  room_id,
  room_number,
  isLoading = false,
}: TenantFormDialogProps) {
  const form = useForm<TenantInsert>({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      emergency_contact: "",
      room_number: room_number,
    },
  });

  useEffect(() => {
    if (!room_id || !room_number) {
      onOpenChange(false);
    }
  }, [room_id, room_number]);

  useEffect(() => {
    form.setValue("room_number", room_number);
  }, [room_number]);

  const handleSubmit = async (data: TenantInsert) => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("id, capacity")
        .eq("id", room_id)
        .maybeSingle();

      if (roomError || !roomData) {
        console.error("❌ ไม่สามารถดึงข้อมูลห้องได้", roomError);
        alert("ไม่สามารถตรวจสอบจำนวนผู้พักในห้องได้");
        return;
      }

      const capacity = roomData.capacity || 0;

      const { count: occupantCount, error: occCountError } = await supabase
        .from("occupancy")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room_id)
        .eq("is_current", true);

      if (occCountError) {
        console.error("❌ ไม่สามารถเช็กจำนวนผู้พักได้", occCountError);
        alert("เกิดข้อผิดพลาดในการเช็กจำนวนผู้พัก");
        return;
      }

      if (occupantCount >= capacity) {
        alert("ห้องนี้เต็มแล้ว ไม่สามารถเพิ่มผู้เช่าได้");
        return;
      }

      const tenantPayload = {
        ...data,
        residents: "ลูกเช่า",
        room_id,
        room_number,
      };

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .insert(tenantPayload)
        .select()
        .single();

      if (tenantError || !tenantData) {
        console.error("❌ เพิ่ม tenant ไม่สำเร็จ", tenantError);
        alert("เกิดข้อผิดพลาดขณะเพิ่มผู้เช่า");
        return;
      }

      const { error: occError } = await supabase.from("occupancy").insert({
        tenant_id: tenantData.id,
        room_id: tenantData.room_id,
        check_in_date: new Date().toISOString().split("T")[0],
        is_current: true,
      });

      if (occError) {
        console.error("❌ เพิ่ม occupancy ไม่สำเร็จ", occError);
        alert("เพิ่มข้อมูลผู้เช่าแล้วแต่บันทึกการเข้าพักไม่สำเร็จ");
        return;
      }

      form.reset();
      onOpenChange(false);
      alert("เพิ่มลูกเช่าสำเร็จแล้ว ✅");
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด", error);
      alert("เกิดข้อผิดพลาดไม่สามารถเพิ่มผู้เช่าได้");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>เพิ่มลูกเช่า</DialogTitle>
          <DialogDescription>กรอกข้อมูลลูกเช่าให้ครบถ้วน</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                rules={{ required: "กรุณากรอกชื่อ" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ</FormLabel>
                    <FormControl>
                      <Input placeholder="ชื่อ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                rules={{ required: "กรุณากรอกนามสกุล" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>นามสกุล</FormLabel>
                    <FormControl>
                      <Input placeholder="นามสกุล" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>อีเมล</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="อีเมล" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              rules={{ required: "กรุณากรอกเบอร์โทร" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เบอร์โทร</FormLabel>
                  <FormControl>
                    <Input placeholder="เบอร์โทร" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ที่อยู่</FormLabel>
                  <FormControl>
                    <Input placeholder="ที่อยู่" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergency_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ติดต่อฉุกเฉิน (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <Input placeholder="ติดต่อฉุกเฉิน" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-sm text-muted-foreground">
              ห้องที่เลือก: <strong>{room_number}</strong>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "กำลังบันทึก..." : "เพิ่ม"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
