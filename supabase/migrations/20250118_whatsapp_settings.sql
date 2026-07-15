-- Migration: WhatsApp Settings & Templates
-- Create table for WhatsApp notification settings and templates

-- Create whatsapp_settings table
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.whatsapp_settings (setting_key, setting_value, is_enabled) VALUES
(
    'template_payment_full',
    'Konfirmasi Pembayaran LUNAS

Hai Bapak/Ibu {nama_pelanggan},
ID Pelanggan: {idpl}

✅ *TAGIHAN TELAH LUNAS!*

*Detail Pembayaran:*
• Periode: *{periode}*
• Total Tagihan: *{total_tagihan}*
• Metode: {metode_pembayaran}
• Status: *LUNAS*

Terima kasih atas pembayaran Anda.

Anda dapat melihat riwayat pembayaran dan status tagihan terbaru melalui dasbor pelanggan Anda.

Login di:
*{app_url}*
*- Email:* {email_pelanggan}
*- Password:* password

_____________________________
*Pesan otomatis dari GALAXY.NET*',
    true
),
(
    'template_payment_installment',
    'Konfirmasi Pembayaran Cicilan

Hai Bapak/Ibu {nama_pelanggan},
ID Pelanggan: {idpl}

✅ *Pembayaran cicilan diterima!*

*Detail Pembayaran:*
• Periode: *{periode}*
• Jumlah Dibayar: *{jumlah_dibayar}*
• Metode: {metode_pembayaran}
• Sisa Tagihan: *{sisa_tagihan}*

Sisa tagihan dapat Anda lunasi sebelum jatuh tempo. Terima kasih.

Anda dapat melihat riwayat pembayaran dan status tagihan terbaru melalui dasbor pelanggan Anda.

Login di:
*{app_url}*
*- Email:* {email_pelanggan}
*- Password:* password

_____________________________
*Pesan otomatis dari GALAXY.NET*',
    true
),
(
    'template_custom_message',
    'Pesan dari Admin

Hai Bapak/Ibu {nama_pelanggan},
ID Pelanggan: {idpl}

{pesan_custom}

_____________________________
*Pesan dari GALAXY.NET*',
    true
),
(
    'auto_notification_enabled',
    'true',
    true
),
(
    'app_url',
    'http://gardunetwork.netlify.app/',
    true
),
(
    'fonnte_token',
    '',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read whatsapp_settings"
    ON public.whatsapp_settings
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to update whatsapp_settings"
    ON public.whatsapp_settings
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS whatsapp_settings_updated_at ON public.whatsapp_settings;
CREATE TRIGGER whatsapp_settings_updated_at
    BEFORE UPDATE ON public.whatsapp_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_settings_updated_at();

-- Grant permissions
GRANT SELECT, UPDATE ON public.whatsapp_settings TO authenticated;

COMMENT ON TABLE public.whatsapp_settings IS 'Stores WhatsApp notification templates and settings';
COMMENT ON COLUMN public.whatsapp_settings.setting_key IS 'Unique key for the setting';
COMMENT ON COLUMN public.whatsapp_settings.setting_value IS 'Template or setting value';
COMMENT ON COLUMN public.whatsapp_settings.is_enabled IS 'Whether this setting/template is enabled';

-- Hanya insert fonnte_token
INSERT INTO public.whatsapp_settings (setting_key, setting_value, is_enabled) 
VALUES ('fonnte_token', '', true)
ON CONFLICT (setting_key) DO NOTHING;