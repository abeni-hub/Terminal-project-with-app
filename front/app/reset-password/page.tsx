'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-info/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Bus className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Set a new password</CardTitle>
            <CardDescription>Choose a strong password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(() => { toast.success('Password reset successfully'); router.push('/login'); })}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" placeholder="At least 8 characters" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" placeholder="Re-enter password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit" className="w-full">Reset password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
