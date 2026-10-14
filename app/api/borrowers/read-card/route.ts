import { readThaiSmartCard, SmartCardReadError } from '@/lib/thai-smart-card'

const noStore = { 'Cache-Control': 'no-store' }

export async function POST() {
  const serviceUrl = process.env.AISC_SMARTCARD_API_URL

  if (serviceUrl) {
    try {
      const serviceResponse = await fetch(serviceUrl, {
        method: 'GET',
        headers: process.env.AISC_SMARTCARD_API_TOKEN
          ? { Authorization: `Bearer ${process.env.AISC_SMARTCARD_API_TOKEN}`, Accept: 'application/json' }
          : { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      const payload: unknown = await serviceResponse.json()
      if (!serviceResponse.ok) {
        return Response.json(
          { error: 'เครื่องอ่านบัตรตอบกลับไม่สำเร็จ', status: 'disconnected' },
          { status: 502, headers: noStore },
        )
      }
      return Response.json({ payload, status: 'success' }, { headers: noStore })
    } catch {
      return Response.json(
        { error: 'ติดต่อ AISC Smart Card Service ไม่ได้ กรุณาตรวจสอบเครื่องอ่านและลองอีกครั้ง', status: 'disconnected' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
  }

  try {
    const payload = await readThaiSmartCard()
    return Response.json({ payload, status: 'success' }, { headers: noStore })
  } catch (error) {
    const status = error instanceof SmartCardReadError ? error.status : 502
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'อ่านข้อมูลจากบัตรไม่สำเร็จ',
        status: 'disconnected',
      },
      { status, headers: noStore },
    )
  }
}
