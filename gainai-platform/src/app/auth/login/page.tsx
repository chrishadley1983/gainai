'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')

  // Team login state
  const [teamEmail, setTeamEmail] = useState('')
  const [teamPassword, setTeamPassword] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  // Client login state
  const [clientEmail, setClientEmail] = useState('')
  const [clientLoading, setClientLoading] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handleTeamLogin(e: React.FormEvent) {
    e.preventDefault()
    setTeamError(null)
    setTeamLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: teamEmail,
        password: teamPassword,
      })

      if (error) {
        setTeamError(error.message)
        return
      }

      router.push(redirectTo || '/admin/dashboard')
    } catch {
      setTeamError('An unexpected error occurred. Please try again.')
    } finally {
      setTeamLoading(false)
    }
  }

  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault()
    setClientError(null)
    setClientLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: clientEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setClientError(error.message)
        return
      }

      setMagicLinkSent(true)
    } catch {
      setClientError('An unexpected error occurred. Please try again.')
    } finally {
      setClientLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gain<span className="text-primary">AI</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Google Business Profile Management Platform
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription>
              Choose your login method below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="team" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="team">Team Login</TabsTrigger>
                <TabsTrigger value="client">Client Login</TabsTrigger>
              </TabsList>

              {/* Team Login Tab */}
              <TabsContent value="team">
                <form onSubmit={handleTeamLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="team-email"
                        type="email"
                        placeholder="you@gainai.co.uk"
                        value={teamEmail}
                        onChange={(e) => setTeamEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="team-password"
                        type="password"
                        placeholder="Enter your password"
                        value={teamPassword}
                        onChange={(e) => setTeamPassword(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  {teamError && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{teamError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={teamLoading}
                  >
                    {teamLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Client Login Tab */}
              <TabsContent value="client">
                {magicLinkSent ? (
                  <div className="space-y-4 pt-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-medium">Check your email</h3>
                      <p className="text-sm text-muted-foreground">
                        We sent a magic link to{' '}
                        <span className="font-medium text-foreground">
                          {clientEmail}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click the link in the email to sign in to your client
                        portal.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setMagicLinkSent(false)
                        setClientEmail('')
                      }}
                    >
                      Use a different email
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleClientLogin}
                    className="space-y-4 pt-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="client-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="client-email"
                          type="email"
                          placeholder="you@yourbusiness.co.uk"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="pl-10"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      We will send a magic link to your email address. No
                      password required.
                    </p>

                    {clientError && (
                      <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{clientError}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={clientLoading}
                    >
                      {clientLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending magic link...
                        </>
                      ) : (
                        'Send magic link'
                      )}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} GainAI. All rights reserved.
        </p>
      </div>
    </div>
  )
}
