
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RoleSelector } from "./RoleSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useMutation } from "@tanstack/react-query";

const userSchema = z.object({
  email: z.string().email("กรุณาใส่อีเมลที่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
  firstName: z.string().min(1, "กรุณาใส่ชื่อ"),
  lastName: z.string().min(1, "กรุณาใส่นามสกุล"),
  address: z.string().min(1, "กรุณาใส่ที่อยู่"),
  phone: z.string().optional(),
  role: z.enum(["admin", "staff", "tenant"], {
    required_error: "กรุณาเลือกบทบาท",
  }),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const UserCreateDialog = ({ open, onOpenChange, onSuccess }: UserCreateDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { session, user } = useAuth();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",  
      address: "",
      phone: "",
      role: "tenant",
    },
  });

  const onSubmit = async (data: UserFormData) => {
  if (!session?.access_token) {
    toast.error("ไม่พบ session การเข้าสู่ระบบ");
    return;
  }

  if (user?.role !== 'admin') {
    toast.error("คุณไม่มีสิทธิ์ในการสร้างบัญชีผู้ใช้ใหม่");
    return;
  }

  setLoading(true);
  try {
    // ➤ 1. สร้างบัญชีผู้ใช้ผ่าน Edge Function
    const { data: result, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error || result?.error) {
      const errorMessage = result?.error || error?.message || 'ไม่สามารถสร้างบัญชีผู้ใช้ได้';
      toast.error(errorMessage);
      return;
    }

    // สมมติว่า result.user.id คือ user id (UUID) ที่ได้จาก Edge Function
    const userId = result?.user?.id;
    console.log('userId', userId);
    if (!userId) {
      toast.error("ไม่สามารถดึง user id ได้");
      return;
    }

    // ➤ 2. เพิ่มข้อมูลลงในตาราง tenants
     const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        emergency_contact: '',
        residents: "ผู้เช่า",
        room_number: 'NULL' 
      })
      .select('id')
      .single();

    console.log('tenantData', tenantData);
    if (tenantError) {
      console.error('Insert tenant failed:', tenantError);
      toast.error("สร้างบัญชีสำเร็จ แต่ไม่สามารถเพิ่มผู้เช่าได้");
    } else {

      // ➤ 3. เพิ่มข้อมูลลงในตาราง profiles พร้อม tenant_id
      const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            tenant_id: tenantData.id,
          });
      console.log('profilesData', data);
      if (profileError) {
        console.error('Insert profile failed:', profileError);
        toast.error("สร้างบัญชีสำเร็จ แต่ไม่สามารถเพิ่มข้อมูลโปรไฟล์ได้");
      } else {
        toast.success("สร้างบัญชีผู้ใช้และเพิ่มผู้เช่าสำเร็จ!");
      }
    }

    form.reset();
    onOpenChange(false);
    onSuccess?.();
  } catch (error: any) {
    console.error("ไม่สามารถสร้างบัญชีผู้ใช้ได้", error);
    toast.error(error.message || "ไม่สามารถสร้างบัญชีผู้ใช้ได้");
  } finally {
    setLoading(false);
  }
};


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>สร้างบัญชีผู้ใช้ใหม่</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
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
                name="lastName"
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
                    <Input type="email" placeholder="อีเมลของผู้ใช้" {...field} />
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เบอร์โทร (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <Input placeholder="เบอร์โทรศัพท์" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* <RoleSelector control={form.control} name="role" /> */}
            <FormItem>
               <FormLabel>บทบาท</FormLabel>
            <span className="block py-2 px-3 rounded bg-muted text-muted-foreground">
              ผู้เช่า (Tenant)
            </span>
            <input type="hidden" name="role" value="tenant" />
            </FormItem>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสผ่าน</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "กำลังสร้าง..." : "สร้างบัญชี"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
