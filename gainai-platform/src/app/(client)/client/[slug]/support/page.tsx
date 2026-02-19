'use client'

import { useState } from 'react'
import {
  HelpCircle,
  Send,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function SupportPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both the subject and message fields.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in to submit a support request.')
        setSubmitting(false)
        return
      }

      // Get client ID from slug
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!client) {
        setError('Client not found.')
        setSubmitting(false)
        return
      }

      // Create a notification for the GainAI team
      await supabase.from('notifications').insert({
        type: 'support_request',
        title: `Support Request: ${subject.trim()}`,
        message: message.trim(),
        priority,
        client_id: client.id,
        user_id: user.id,
        is_read: false,
      })

      // Create activity log entry
      await supabase.from('activity_log').insert({
        action: 'Support request submitted',
        entity_type: 'support',
        details: subject.trim(),
        client_id: client.id,
        user_id: user.id,
      })

      setSubmitted(true)
      setSubject('')
      setMessage('')
      setPriority('medium')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    }

    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">
          Get in touch with your GainAI account manager
        </p>
      </div>

      {submitted ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Request Submitted
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your support request has been sent successfully. Your GainAI
              account manager will get back to you shortly.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => setSubmitted(false)}
            >
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Contact Form
            </CardTitle>
            <CardDescription>
              Fill in the form below and your GainAI account manager will get
              back to you shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your request"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your request or issue in detail..."
                  rows={6}
                  required
                />
              </div>

              <div className="w-48">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Submit Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
