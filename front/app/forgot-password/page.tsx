'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Bus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
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
            <CardTitle className="text-lg">Reset your password</CardTitle>
            <CardDescription>Enter your email and we will send you reset instructions</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">If an account exists for that email, a reset link has been sent. Check your inbox.</p>
                <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(() => { setSubmitted(true); toast.success('Reset link sent'); })} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@aato.gov.et" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" className="w-full">Send reset link</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => router.push('/login')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
