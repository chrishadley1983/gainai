import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TEMPLATES: Record<string, { filename: string; headers: string[]; sampleRow: string[] }> = {
  client: {
    filename: 'client_import_template.csv',
    headers: ['name', 'contact_email', 'slug', 'contact_name', 'contact_phone', 'website_url', 'package_type', 'notes'],
    sampleRow: ['Acme Corp', 'john@acme.com', 'acme-corp', 'John Smith', '+44 7700 900000', 'https://acme.com', 'GROWTH', 'New client onboarding'],
  },
  location: {
    filename: 'location_import_template.csv',
    headers: ['client_id', 'name', 'address', 'phone', 'website_url', 'primary_category', 'timezone', 'latitude', 'longitude'],
    sampleRow: ['uuid-of-client', 'Acme Corp - London', '123 High Street, London, SW1A 1AA', '+44 20 7946 0958', 'https://acme.com/london', 'restaurant', 'Europe/London', '51.5074', '-0.1278'],
  },
  post: {
    filename: 'post_import_template.csv',
    headers: ['location_id', 'summary', 'content_type', 'title', 'scheduled_at', 'call_to_action_type', 'call_to_action_url', 'media_urls'],
    sampleRow: ['uuid-of-location', 'Check out our new spring menu!', 'STANDARD', 'Spring Menu Launch', '2026-03-01T10:00:00Z', 'LEARN_MORE', 'https://acme.com/spring-menu', 'https://example.com/img1.jpg|https://example.com/img2.jpg'],
  },
  media: {
    filename: 'media_import_template.csv',
    headers: ['location_id', 'url', 'media_type', 'category', 'file_name', 'description'],
    sampleRow: ['uuid-of-location', 'https://example.com/photo.jpg', 'PHOTO', 'ADDITIONAL', 'storefront.jpg', 'Front view of the store'],
  },
  competitor: {
    filename: 'competitor_import_template.csv',
    headers: ['client_id', 'name', 'place_id', 'address', 'phone', 'website_url', 'primary_category', 'notes'],
    sampleRow: ['uuid-of-client', 'Rival Corp', 'ChIJxxxxxxxxxxxxxxxxx', '456 Main Road, London', '+44 20 7946 0959', 'https://rival.com', 'restaurant', 'Main competitor in area'],
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Verify user is a team member
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (teamError || !teamMember) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const template = TEMPLATES[type]

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: `Invalid template type: ${type}. Must be one of: ${Object.keys(TEMPLATES).join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    // Build CSV content with headers and a sample row
    const csvLines = [
      template.headers.join(','),
      template.sampleRow.map((val) => {
        // Escape values that contain commas or quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val
      }).join(','),
    ]
    const csvContent = csvLines.join('\n') + '\n'

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${template.filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
