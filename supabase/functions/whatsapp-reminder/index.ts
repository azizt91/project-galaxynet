import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('Fungsi whatsapp-reminder dipanggil.');

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    console.log('Klien Supabase berhasil dibuat.');

    // 1. Dapatkan informasi tanggal hari ini
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthYear = today.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    console.log(`Mengecek jatuh tempo untuk tanggal: ${currentDay}, Periode: ${currentMonthYear}`);

    // 2. Cari semua pelanggan aktif yang tanggal pemasangannya cocok dengan tanggal hari ini
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, idpl, full_name, whatsapp_number, package_id, installation_date')
      .eq('status', 'AKTIF');

    if (profilesError) throw profilesError;

    const potentialUsers = profiles.filter(p => {
      if (!p.installation_date) return false;
      const installationDay = new Date(p.installation_date).getDate();
      return installationDay === currentDay;
    });

    if (potentialUsers.length === 0) {
      const msg = 'Tidak ada pengguna yang jatuh tempo hari ini.';
      console.log(msg);
      return new Response(JSON.stringify({ message: msg }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Ditemukan ${potentialUsers.length} pengguna yang berpotensi untuk dinotifikasi.`);

    // 3. Cek siapa saja dari pengguna tersebut yang sudah membayar bulan ini
    const potentialUserIds = potentialUsers.map(u => u.id);
    const { data: paidInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('customer_id')
      .in('customer_id', potentialUserIds)
      .eq('status', 'paid')
      .eq('invoice_period', currentMonthYear);

    if (invoicesError) throw invoicesError;

    const paidUserIds = new Set(paidInvoices.map(inv => inv.customer_id));
    console.log(`Ditemukan ${paidUserIds.size} pengguna yang sudah membayar bulan ini.`);

    // 4. Filter pengguna, hanya sisakan yang belum bayar
    const usersToNotify = potentialUsers.filter(user => !paidUserIds.has(user.id));

    if (usersToNotify.length === 0) {
      const msg = 'Semua pengguna yang jatuh tempo hari ini sudah membayar.';
      console.log(msg);
      return new Response(JSON.stringify({ message: msg }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Final: ${usersToNotify.length} pengguna akan dikirimkan notifikasi WhatsApp.`);


    // 5. Ambil semua data paket untuk efisiensi
    const { data: packages, error: packagesError } = await supabase.from('packages').select('id, price');
    if (packagesError) throw packagesError;
    const packagesMap = new Map(packages.map(p => [p.id, p.price]));

    // Ambil app_url dari database (jika ada)
    let appUrl = 'http://galaxynet-pay.netlify.app/';
    const { data: appUrlData, error: appUrlError } = await supabase
      .from('whatsapp_settings')
      .select('setting_value')
      .eq('setting_key', 'app_url')
      .single();

    if (!appUrlError && appUrlData && appUrlData.setting_value) {
      appUrl = appUrlData.setting_value;
    }

    // 6. Kirim notifikasi ke pengguna yang sudah difilter
    let successCount = 0;
    let failureCount = 0;

    for (const user of usersToNotify) {
      const price = packagesMap.get(user.package_id);

      if (!price || !user.whatsapp_number) {
        console.warn(`Melewatkan user ${user.full_name} karena harga paket atau nomor WhatsApp tidak ditemukan.`);
        continue;
      }

      // Ambil email pelanggan
      let customerEmail = '-';
      const { data: emailData, error: emailError } = await supabase.rpc('get_user_email', {
        user_id: user.id
      });
      if (!emailError && emailData) {
        customerEmail = emailData;
      }

      const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);

      // Membuat isi pesan sesuai template
      const message = `*FAKTUR TAGIHAN GALAXY.NETWORK by:ATLAS LINTAS INDONESIA* 📄

Halo Bapak/Ibu *${user.full_name}*, 👋
Berikut adalah rincian tagihan WiFi Anda:

Periode: *${currentMonthYear}*
Nominal: *${formattedPrice}*
Status: *Belum Dibayar*

Mohon untuk dapat melakukan pembayaran sebelum tanggal 25, pembayaran bisa dilakukan melalui:
• *DANA*: 082122786521
(Atas nama MUKHLIS NUR IMANNUDIN)
Atau bayar langsung di Kantor GALAXY.NETWORK.BY:PT ATLAS LINTAS INDONESIA
Desa Semboja,dk.jatipelag rt.09 rw.02, kec.pagerbarang kab.tegal

Harap konfirmasi dengan mengirimkan foto bukti transfer ke nomor ini Whatapps (085934599350). Terima kasih telah berlangganan GALAXY.NET! ✨

Anda dapat melihat riwayat pembayaran dan status tagihan terbaru melalui dasbor pelanggan di link URL dibawah ini

${appUrl}
Login dengan akun anda
- *Email*: ${customerEmail}
- *Password*: password123
_____________________________
_*Pesan ini dibuat otomatis. Abaikan pesan ini jika tagihan sudah dibayarkan._`;

      // Panggil fungsi 'send-whatsapp-notification' yang sudah ada
      try {
        console.log(`Mengirim pesan ke ${user.full_name} (${user.whatsapp_number})...`);

        const response = await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/send-whatsapp-notification', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ target: user.whatsapp_number, message: message })
        });

        const responseBody = await response.text();
        console.log(`Response status: ${response.status}, body:`, responseBody);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseBody}`);
        }

        // Parse response untuk validasi lebih lanjut
        const result = JSON.parse(responseBody);
        if (!result.success) {
          throw new Error(`API Error: ${result.message || 'Unknown error'}`);
        }

        console.log(`✓ Berhasil mengirim pesan ke ${user.full_name}:`, result.data);
        successCount++;
      } catch (e) {
        console.error(`✗ Gagal mengirim pesan ke ${user.full_name}:`, e.message);
        failureCount++;
      }
    }

    const responseMessage = `Proses notifikasi WhatsApp selesai. Berhasil: ${successCount}, Gagal: ${failureCount}.`;
    console.log(responseMessage);

    return new Response(JSON.stringify({ message: responseMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Terjadi kesalahan tidak terduga di whatsapp-reminder:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});