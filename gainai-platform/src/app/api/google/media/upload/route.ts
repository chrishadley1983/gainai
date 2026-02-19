import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadMedia as uploadMediaToGBP } from '@/lib/google/media'
import { getAuthenticatedClient } from '@/lib/google/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
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

    // Verify user is a team member (admin)
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const locationId = formData.get('locationId') as string | null
    const mediaType = formData.get('mediaType') as string | null
    const category = formData.get('category') as import('@/lib/google/types').MediaCategory | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'file is required' } },
        { status: 400 }
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'locationId is required' } },
        { status: 400 }
      )
    }

    if (!mediaType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'mediaType is required' } },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'category is required' } },
        { status: 400 }
      )
    }

    // Verify the location exists
    const { data: location, error: locationError } = await supabase
      .from('gbp_locations')
      .select('id, client_id, oauth_status')
      .eq('id', locationId)
      .single()

    if (locationError || !location) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Location not found' } },
        { status: 404 }
      )
    }

    if (location.oauth_status !== 'CONNECTED') {
      return NextResponse.json(
        { success: false, error: { code: 'OAUTH_REQUIRED', message: 'Google OAuth connection required for this location' } },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage first
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${locationId}/${Date.now()}.${fileExt}`
    const storagePath = `gbp-media/${fileName}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('media')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (storageError) {
      console.error('Supabase storage upload error:', storageError)
      return NextResponse.json(
        { success: false, error: { code: 'STORAGE_ERROR', message: 'Failed to upload file to storage' } },
        { status: 500 }
      )
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath)

    // Resolve Google location name for API call
    const adminSupabase = createAdminClient()
    const { data: locationRecord } = await adminSupabase
      .from('gbp_locations')
      .select('google_location_name')
      .eq('id', locationId)
      .single()

    if (!locationRecord?.google_location_name) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_LINKED', message: 'Location is not linked to Google' } },
        { status: 400 }
      )
    }

    const authClient = await getAuthenticatedClient(locationId)

    // Upload to GBP via API
    const gbpResult = await uploadMediaToGBP(locationRecord.google_location_name, {
      sourceUrl: publicUrlData.publicUrl,
      mediaFormat: mediaType === 'VIDEO' ? 'VIDEO' : 'PHOTO',
      category,
    }, authClient)

    // Create media record in the database
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('gbp_media')
      .insert({
        location_id: locationId,
        client_id: location.client_id,
        media_type: mediaType,
        category,
        storage_path: storagePath,
        storage_url: publicUrlData.publicUrl,
        google_media_id: gbpResult.name,
        google_url: gbpResult.googleUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single()

    if (mediaError) {
      console.error('Failed to create media record:', mediaError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Media uploaded but failed to create database record' } },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: { media: mediaRecord } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Google media upload error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
