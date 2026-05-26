import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase-server'

export const maxDuration = 30

const BUCKET = 'voc-attachments'

interface FileInfo { name: string; size: number; type: string }

export async function POST(req: NextRequest) {
  const { files } = await req.json() as { files: FileInfo[] }
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ uploads: [] })
  }

  const supabase = createAdminClient()

  // 버킷 없으면 생성
  await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  }).catch(() => {})

  await supabase.storage.updateBucket(BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: null,
  }).catch(() => {})

  const storagePrefix = randomUUID()

  const uploads = await Promise.all(
    files.map(async (f) => {
      const ext      = f.name.split('.').pop()?.toLowerCase() ?? ''
      const safeKey  = `${randomUUID()}${ext ? `.${ext}` : ''}`
      const path     = `${storagePrefix}/${safeKey}`

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path)

      if (error || !data) {
        console.error('[prepare-uploads] signed URL error', f.name, error)
        return null
      }

      return {
        name:      f.name,
        size:      f.size,
        type:      f.type,
        path,
        signedUrl: data.signedUrl,
        token:     data.token,
      }
    })
  )

  return NextResponse.json({ uploads: uploads.filter(Boolean) })
}
