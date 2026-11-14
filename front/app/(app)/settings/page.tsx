'use client';

import { useState } from 'react';
import { useAuthStore } from '@/src/store/auth-store';
import { useTheme } from 'next-themes';
import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RoleBadge } from '@/src/components/RoleBadge';
import { toast } from 'sonner';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';
import { Save, Moon, Sun, Monitor } from 'lucide-react';

export default function SettingsPage() {
  const session = useAuthStore((s) => s.session);
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({ email: true, push: false, violations: true, dispatches: false });

  if (!session) return null;
  const user = session.user;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, preferences, and system configuration" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile Information</CardTitle><CardDescription>Update your personal details</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16"><AvatarFallback style={{ backgroundColor: user.avatarColor ?? '#2176ff' }} className="text-lg text-white">{user.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback></Avatar>
                <div><p className="font-medium">{user.name}</p><RoleBadge role={session.role.name} /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Full Name</Label><Input defaultValue={user.name} /></div>
                <div className="space-y-2"><Label>Email</Label><Input defaultValue={user.email} disabled /></div>
                <div className="space-y-2"><Label>Phone</Label><Input defaultValue={user.phone ?? ''} /></div>
              </div>
              <Button onClick={() => toast.success('Profile saved')}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Theme</CardTitle><CardDescription>Choose your preferred color scheme</CardDescription></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([val, Icon, label]) => (
                  <button key={val} onClick={() => setTheme(val)} className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${theme === val ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <Icon className="h-6 w-6" /><span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle><CardDescription>Choose what you want to be notified about</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {([['email', 'Email notifications', 'Receive notifications via email'], ['push', 'Push notifications', 'Receive push notifications in browser'], ['violations', 'Violation alerts', 'Get notified when violations are reported'], ['dispatches', 'Dispatch updates', 'Get notified about dispatch status changes']] as const).map(([key, title, desc]) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={notifications[key]} onCheckedChange={(c) => { setNotifications((n) => ({ ...n, [key]: c })); toast.success('Preference updated'); }} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Application Information</CardTitle><CardDescription>System details and version</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Application</span><span className="font-medium">{APP_NAME}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Module</span><span className="font-medium">{APP_TAGLINE}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">1.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Environment</span><span className="font-medium">Development (Mock API)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Backend</span><span className="font-medium">Mock (NestJS-ready)</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
