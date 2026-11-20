export type TabId =
  | 'utama'
  | 'pengenalan'
  | 'keistimewaan'
  | 'foto'
  | 'video'
  | 'respon'
  | 'lokasi'
  | 'cetakan'
  | 'peraturan'
  | 'roomstay'
  | 'admin';

export interface TabItem {
  id: TabId;
  label: string;
  isAdmin?: boolean;
}

export const TABS: TabItem[] = [
  { id: 'utama', label: 'Utama' },
  { id: 'pengenalan', label: 'Pengenalan' },
  { id: 'keistimewaan', label: 'Info' },
  { id: 'roomstay', label: 'Roomstay' },
  { id: 'foto', label: 'Foto' },
  { id: 'video', label: 'Video' },
  { id: 'respon', label: 'Respons' },
  { id: 'lokasi', label: 'Lokasi' },
  { id: 'cetakan', label: 'Cetakan' },
  { id: 'peraturan', label: 'Peraturan' },
  { id: 'admin', label: 'Admin', isAdmin: true },
];

export const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw9N8C6Jq534TZkIBanbXQQgR3HPjVo3G7BsKP64X3RDcaw5HXZVl8o0N78Tb7ID68/exec';

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];

export const DAY_SHORT_NAMES = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];

export const CONTACT_INFO = {
  brand: 'SS Homestay & Roomstay',
  owner: 'Pn. Hajah Sarina',
  phoneDisplay: '016-986 7367',
  phoneRaw: '60169867367',
  address: 'Lot 13085, Kg Padang Enggang, 15100 Kota Bharu, Kelantan.',
  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3967.374544967811!2d102.2439067!3d6.080129400000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31b6a50007ca8f19%3A0x77cdd0d3dcbdcbd8!2sSS%20Homestay!5e0!3m2!1sen!2smy!4v1775604476114!5m2!1sen!2smy',
  mapsDirectUrl: 'https://maps.google.com/?q=6.0801294,102.2439067',
  printFormUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLScRi3LDs5sMF9DMGRUFvDiYlweQ5Nib-3s_r9eQS3jeKPlGtQ/viewform',
  printFormEmbedUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLScRi3LDs5sMF9DMGRUFvDiYlweQ5Nib-3s_r9eQS3jeKPlGtQ/viewform?embedded=true',
  adminBookingFormEmbedUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSenk3vO-Y3eP-zKg5odaQp3hqNKsC5dQrVZ2DX0Cav-d8VrxQ/viewform?embedded=true',
  appsheetUrl: 'https://www.appsheet.com/start/119031a9-780e-4ed7-b2f8-7b903c36531c',
  linktreeUrl: 'https://linktr.ee/SSHOMESTAY',
};

export const HOMESTAY_RATES = [
  { label: 'Hari Biasa', price: 'RM 300', unit: '/ malam', note: 'Isnin – Khamis / bukan cuti umum' },
  { label: 'Musim Perayaan', price: 'RM 350', unit: '/ malam', note: 'Cuti sekolah & hari perayaan' },
  {
    label: 'Pakej Kombo (Homestay + Roomstay)',
    price: 'RM 400',
    unit: '/ malam',
    note: 'Promosi ambil bersekali dengan Roomstay',
    featured: true,
  },
];

export const ROOMSTAY_RATES = [
  { label: 'Hari Biasa', price: 'RM 130', unit: '/ malam', note: 'Bilik persinggahan selesa' },
  { label: 'Musim Perayaan', price: 'RM 150', unit: '/ malam', note: 'Cuti sekolah & hari perayaan' },
  {
    label: 'Pakej Kombo (Homestay + Roomstay)',
    price: 'RM 400',
    unit: '/ malam',
    note: 'Promosi ambil bersekali dengan Homestay',
    featured: true,
  },
];

export const HOMESTAY_FACILITIES = [
  '3 Bilik Tidur yang luas + 2 Bilik Air',
  'Kesemua 3 bilik tidur dilengkapi Penyaman Udara (Air-cond)',
  '3 Katil saiz Queen + Extra Toto disediakan',
  'Kemudahan Private Pool (Kolam renang persendirian) sesuai untuk keluarga',
  'Google TV 50 inci & akses Netflix percuma + WiFi berkelajuan tinggi',
  'Parking kereta berbumbung dan luas untuk 8 hingga 10 biji kereta',
  'Dapur & kelengkapan peralatan memasak lengkap',
  'Penapis Air, Jug Kettle & Peti Ais',
  'Mesin Basuh (Washing Machine)',
  'Set BBQ untuk aktiviti keluarga',
  'Seterika (Iron) & Papan Seterika (Iron Board)',
  'Water Heater di bilik air',
];

export const ROOMSTAY_FEATURES = [
  'Bilik tidur yang selesa dan terjaga rapi',
  'Bilik dilengkapi Penyaman Udara (Air-cond)',
  'Bilik mandi persendirian dengan Water Heater',
  'Katil saiz Queen yang empuk',
  'Parking kereta yang selamat dan luas',
];

export const HOUSE_RULES = [
  { title: 'Waktu Masuk (Check-in)', detail: '3:00 Petang' },
  { title: 'Waktu Keluar (Check-out)', detail: '12:00 Tengah hari' },
  { title: 'Larangan Merokok', detail: 'Dilarang merokok di dalam kawasan rumah.' },
  { title: 'Makanan Halal', detail: 'Ditegah sama sekali membawa masuk makanan yang tidak halal.' },
  {
    title: 'Penggunaan Kolam Renang',
    detail: 'Sila pakai pakaian renang yang sesuai dan bilas badan sebelum masuk ke kolam renang.',
  },
  {
    title: 'Penjagaan Peralatan',
    detail: 'Peralatan hendaklah digunakan dengan cermat. Sila laporkan kerosakan dengan kadar segera.',
  },
];

export const HOMESTAY_PHOTOS = [
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/9ddae795-64c6-4acd-8428-84b3dfd39273uu.jpg?w=2500&h=',
    alt: 'Kolam Renang Persendirian SS Homestay',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/7ea984b6-3f18-424a-bd05-9d6ce93acdb0.jpg?w=2500&h=',
    alt: 'Pemandangan Luaran SS Homestay',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/bbc221e6-13b2-40b1-bf22-2898da828d9b.jpg?w=2500&h=',
    alt: 'Ruang Tamu SS Homestay',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/20250413_184430.jpg?w=1440',
    alt: 'Kawasan Persekitaran Homestay',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/d58b0f28-e395-4a43-9cd3-ed75dc932f37.jpg?w=2500&h=',
    alt: 'Bilik Tidur Utama',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/93f283dd-500f-408c-a271-c240c57d634e.jpg?w=2500&h=',
    alt: 'Ruang Dapur dan Makan',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/a15c5061-5755-49da-815e-f677ae697c6a.png',
    alt: 'Kemudahan Homestay 7',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/70f40c16-1a78-4466-afb1-7cd9ef1d87a9.jpg?w=2500&h=',
    alt: 'Bilik Tidur Kedua',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/whatsapp-image-2026-04-11-at-5.21.13-am-1.jpeg',
    alt: 'Sudut Santai Keluarga',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/9e414f38-dcb2-4e20-8a97-c757f6792ccd.jpg?w=2500&h=',
    alt: 'Ruang Parking Luas',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/img-20250330-wa0054-1.jpg',
    alt: 'Suasana Homestay 11',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/20250502_104833-1.jpg',
    alt: 'Suasana Homestay 12',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/whatsapp-image-2026-04-11-at-5.21.12-am-1.jpeg',
    alt: 'Suasana Homestay 13',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/img-20250330-wa0049-1.jpg',
    alt: 'Suasana Homestay 14',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/20250502_104953.png',
    alt: 'Suasana Homestay 15',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/6cb4db19-3ff4-4ede-86aa-f25b5d510477.jpg',
    alt: 'Suasana Homestay 16',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/20250502_104815.png',
    alt: 'Suasana Homestay 17',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2025/01/7f73b518-dac8-43f5-b718-cc322859ce12.jpg',
    alt: 'Suasana Homestay 18',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/image_9a22e31f.jpg',
    alt: 'Pemandangan Terkini SS Homestay',
  },
];

export const ROOMSTAY_PHOTOS = [
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/57c0c4ad-d4ce-4cb0-a01e-611d80dde974.jpg',
    alt: 'Roomstay 1',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/ffa8ff9e-5417-42a6-91ce-1990084275e2.jpg',
    alt: 'Roomstay 2',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/8147aff1-4859-4a24-ba63-61144a7df322.jpg',
    alt: 'Roomstay 3',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/9ab3d63b-48f3-499e-901e-6be42ee8c6f8.jpg',
    alt: 'Roomstay 4',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/01327d22-d03b-44e3-8d42-b50041f8ebd8.jpg',
    alt: 'Roomstay 5',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/edf59aaa-02b2-435e-a332-bba0a29e0699.jpg',
    alt: 'Roomstay 6',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/d16c291b-614e-4c89-9008-99afb228df27.jpg',
    alt: 'Roomstay 7',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/17d0ffd4-4a66-43a1-8a7d-bea8ede54747.jpg',
    alt: 'Roomstay 8',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/bcc072e4-2471-4b8f-b3c0-78797aa84048.png?w=768',
    alt: 'Roomstay 9',
  },
];

export const TESTIMONIAL_PHOTOS = [
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/img-20250831-wa0004.jpg',
    alt: 'Testimoni Tetamu 1',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250401_131016_whatsapp.jpg?w=768',
    alt: 'Testimoni Tetamu 2',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250925_162457_chrome.jpg?w=768',
    alt: 'Testimoni Tetamu 3',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250405_142559_whatsapp.jpg?w=768',
    alt: 'Testimoni Tetamu 4',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/km.jpg?w=768',
    alt: 'Testimoni Tetamu 5',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250604_105506_whatsapp.jpg',
    alt: 'Testimoni Tetamu 6',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250823_154859_whatsapp1.jpg?w=768',
    alt: 'Testimoni Tetamu 7',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250915_205155_whatsapp.jpg?w=768',
    alt: 'Testimoni Tetamu 8',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250919_092843_whatsapp.jpg?w=768',
    alt: 'Testimoni Tetamu 9',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250925_162312_chrome.jpg?w=768',
    alt: 'Testimoni Tetamu 10',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250925_162333_chrome.jpg?w=768',
    alt: 'Testimoni Tetamu 11',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/screenshot_20250925_162358_chrome.jpg?w=768',
    alt: 'Testimoni Tetamu 12',
  },
  {
    src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/km1.jpg?w=768',
    alt: 'Testimoni Tetamu 13',
  },
];

export const YOUTUBE_VIDEOS = [
  {
    id: 'tq5trg7ObvU',
    title: 'Lawatan Video SS Homestay & Kolam Renang',
    embedUrl: 'https://www.youtube.com/embed/tq5trg7ObvU',
    watchUrl: 'https://youtube.com/shorts/tq5trg7ObvU',
  },
  {
    id: 'eNkWbs19tRs',
    title: 'Suasana & Kemudahan SS Homestay & Roomstay',
    embedUrl: 'https://www.youtube.com/embed/eNkWbs19tRs',
    watchUrl: 'https://youtube.com/shorts/eNkWbs19tRs',
  },
];
