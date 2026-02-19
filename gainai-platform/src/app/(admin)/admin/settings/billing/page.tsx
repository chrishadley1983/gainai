'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/DataTable'
import { KPICard } from '@/components/shared/KPICard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PoundSterling,
  CreditCard,
  TrendingUp,
  Users,
  ExternalLink,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import type { ColumnDef } from '@tanstack/react-table'

interface BillingRow {
  id: string
  client_id: string
  client_name: string
  package_type: string
  monthly_fee: number
  payment_status: string
  next_invoice: string | null
  stripe_customer_id: string | null
}

const PACKAGE_FEES: Record<string, number> = {
  STARTER: 99,
  GROWTH: 199,
  PREMIUM: 399,
  ENTERPRISE: 799,
}

const paymentStatusColor: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OVERDUE: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function BillingSettingsPage() {
  const [billingData, setBillingData] = useState<BillingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('id, name, package_type, status, stripe_customer_id')
        .order('name')

      if (data) {
        setBillingData(
          data.map((c: any) => {
            const pkg = c.package_type || 'STARTER'
            // Simulated billing data
            const statuses = ['PAID', 'PAID', 'PAID', 'PENDING', 'OVERDUE']
            const paymentStatus = c.status === 'CHURNED'
              ? 'CANCELLED'
              : statuses[Math.floor(Math.random() * statuses.length)]

            const nextInvoice = new Date()
            nextInvoice.setMonth(nextInvoice.getMonth() + 1)
            nextInvoice.setDate(1)

            return {
              id: c.id,
              client_id: c.id,
              client_name: c.name ?? '',
              package_type: pkg,
              monthly_fee: PACKAGE_FEES[pkg] || 99,
              payment_status: paymentStatus,
              next_invoice: nextInvoice.toISOString(),
              stripe_customer_id: c.stripe_customer_id,
            }
          })
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = billingData.filter((b) => {
    if (filterStatus !== 'all' && b.payment_status !== filterStatus) return false
    return true
  })

  const totalMRR = billingData.reduce((sum, b) => sum + b.monthly_fee, 0)
  const paidCount = billingData.filter((b) => b.payment_status === 'PAID').length
  const overdueCount = billingData.filter((b) => b.payment_status === 'OVERDUE').length

  const columns: ColumnDef<BillingRow, unknown>[] = [
    {
      accessorKey: 'client_name',
      header: 'Client',
      cell: ({ row }) => <span className="font-medium">{row.original.client_name}</span>,
    },
    {
      accessorKey: 'package_type',
      header: 'Package',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.package_type.toLowerCase()}
        </Badge>
      ),
    },
    {
      accessorKey: 'monthly_fee',
      header: 'Monthly Fee',
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.monthly_fee)}</span>
      ),
    },
    {
      accessorKey: 'payment_status',
      header: 'Payment Status',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn('capitalize', paymentStatusColor[row.original.payment_status] || '')}
        >
          {row.original.payment_status.toLowerCase()}
        </Badge>
      ),
    },
    {
      accessorKey: 'next_invoice',
      header: 'Next Invoice',
      cell: ({ row }) =>
        row.original.next_invoice
          ? new Date(row.original.next_invoice).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '-',
    },
    {
      id: 'stripe',
      header: '',
      cell: ({ row }) =>
        row.original.stripe_customer_id ? (
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`https://dashboard.stripe.com/customers/${row.original.stripe_customer_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Stripe
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No Stripe ID</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Overview of client billing and revenue
        </p>
      </div>

      {/* Revenue summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Monthly Revenue"
          value={formatCurrency(totalMRR)}
          icon={PoundSterling}
          loading={loading}
        />
        <KPICard
          title="Active Clients"
          value={billingData.length}
          icon={Users}
          loading={loading}
        />
        <KPICard
          title="Paid"
          value={paidCount}
          icon={CreditCard}
          loading={loading}
        />
        <KPICard
          title="Overdue"
          value={overdueCount}
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No billing records"
          description="Billing data will appear once clients are added."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="client_name"
          searchPlaceholder="Search clients..."
        />
      )}
    </div>
  )
}
