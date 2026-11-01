import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — same limit SettingsPage enforced client-side

function pathFromPublicUrl(url: string): string | null {
  const marker = '/clinic-assets/';
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

// POST: upload a new logo (optionally removing the previous one first),
// returns its public URL. Mirrors SettingsPage.tsx's old handleLogoUpload.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const oldLogoUrl = formData.get('oldLogoUrl');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Please upload an image smaller than 2MB.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (typeof oldLogoUrl === 'string' && oldLogoUrl) {
    const oldPath = pathFromPublicUrl(oldLogoUrl);
    if (oldPath) await supabase.storage.from('clinic-assets').remove([oldPath]);
  }

  const fileExt = file.name.split('.').pop() || 'png';
  const filePath = `logo-${Date.now()}.${fileExt}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('clinic-assets')
    .upload(filePath, Buffer.from(arrayBuffer), { upsert: true, contentType: file.type || undefined });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(filePath);
  return NextResponse.json({ url: urlData.publicUrl });
}

// DELETE: remove a logo file without uploading a replacement. Mirrors the
// old handleRemoveLogo — best-effort, never blocks clearing the field even
// if the storage remove fails.
export async function DELETE(request: Request) {
  const { logoUrl } = await request.json();
  if (typeof logoUrl === 'string' && logoUrl) {
    const oldPath = pathFromPublicUrl(logoUrl);
    if (oldPath) {
      const supabase = createServiceClient();
      await supabase.storage.from('clinic-assets').remove([oldPath]);
    }
  }
  return NextResponse.json({ ok: true });
}
