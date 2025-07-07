import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room_id: string;
  room_number: string;
  tenant?: TenantRow | null; // ✅ ใช้สำหรับกรณี "แก้ไข"
  isLoading?: boolean;
}

export default function TenantFormDialog({
  open,
  onOpenChange,
  room_id,
  room_number,
  tenant,
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

  // ✅ reset ค่าเมื่อ tenant เปลี่ยน (หรือเปิดใหม่)
  useEffect(() => {
    if (tenant) {
      form.reset({
        first_name: tenant.first_name || "",
        last_name: tenant.last_name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        emergency_contact: tenant.emergency_contact || "",
        room_number: tenant.room_number || room_number,
      });
    } else {
      form.reset({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        emergency_contact: "",
        room_number,
      });
    }
  }, [tenant, room_number, form]);

  const handleSubmit = async (data: TenantInsert) => {
    try {
      // ตรวจสอบจำนวนคนในห้องก่อนเพิ่ม
      if (!tenant) {
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("id, capacity")
          .eq("id", room_id)
          .maybeSingle();

        if (roomError || !roomData) {
          alert("ไม่สามารถดึงข้อมูลห้องได้");
          return;
        }

        const { count: occupantCount, error: occError } = await supabase
          .from("occupancy")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room_id)
          .eq("is_current", true);

        if (occError) {
          alert("ไม่สามารถตรวจสอบจำนวนผู้พักได้");
          return;
        }

        if ((occupantCount || 0) >= roomData.capacity) {
          alert("ห้องนี้เต็มแล้ว ไม่สามารถเพิ่มผู้เช่าได้");
          return;
        }
      }

      if (tenant) {
        // ✅ แก้ไขข้อมูลผู้เช่า
        const { error: updateError } = await supabase
          .from("tenants")
          .update(data)
          .eq("id", tenant.id);

        if (updateError) {
          alert("เกิดข้อผิดพลาดในการอัปเดตผู้เช่า");
          return;
        }
      } else {
        // ✅ เพิ่มผู้เช่าใหม่
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
          alert("เพิ่มผู้เช่าไม่สำเร็จ");
          return;
        }

        // เพิ่มลง occupancy
        const { error: occInsertError } = await supabase.from("occupancy").insert({
          tenant_id: tenantData.id,
          room_id: tenantData.room_id,
          check_in_date: new Date().toISOString().split("T")[0],
          is_current: true,
        });

        if (occInsertError) {
          alert("เพิ่มข้อมูลการเข้าพักไม่สำเร็จ");
          return;
        }
      }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึก");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{tenant ? "แก้ไขข้อมูลผู้เช่า" : "เพิ่มผู้เช่าใหม่"}</DialogTitle>
          <DialogDescription>
            {tenant ? "อัปเดตข้อมูลลูกเช่า" : "กรอกข้อมูลผู้เช่าให้ครบถ้วน"}
          </DialogDescription>
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
                  <FormLabel>ติดต่อฉุกเฉิน</FormLabel>
                  <FormControl>
                    <Input placeholder="เบอร์ติดต่อฉุกเฉิน" {...field} />
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
                {isLoading ? "กำลังบันทึก..." : tenant ? "บันทึก" : "เพิ่ม"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
