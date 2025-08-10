// --- Konfigurasi URL Google Sheets CSV ---
const SHEET_SISWA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8rrgd7UIqQHhrzlrM9Ox6dkOk0CxSrkz8cvqw75KEVJ4EVnWi2WdgO1eZgg_s1TJ5YsR27enX5pp7/pub?output=csv';
const SHEET_SOAL_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvcpWahUPIGvIfbxARRnYX2IkW4LaCsXVXypKTwYjVU2GaFR5nBvvmCE5h5z58JibnKDMQJDwu8kNV/pub?output=csv';
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfiI70dJOcWujiydNBj4afR4h0cMqDVrIGnTBalBHpdEA4qEg/viewform?usp=header';

// --- DOM Elements ---
const loginPage = document.getElementById('login-page');
const examPage = document.getElementById('exam-page');
const resultPage = document.getElementById('result-page');

const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const kodeInput = document.getElementById('kode');

const studentInfoDiv = document.getElementById('student-info');
const studentNameSpan = document.getElementById('student-name');
const studentClassSpan = document.getElementById('student-class');
const subjectSelect = document.getElementById('subject');
const startExamButton = document.getElementById('start-exam');

let timerInterval;
let currentSoal = [];

// --- Helper CSV ---
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (values[i]||'').trim());
    return obj;
  });
}

// --- UI Helpers ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

function setButtonLoading(button, isLoading) {
  const buttonText = button.querySelector('.button-text');
  const spinner = button.querySelector('.spinner');
  if (isLoading) {
    button.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    buttonText.style.display = 'inline-block';
    spinner.style.display = 'none';
  }
}

async function validateStudent(kode) {
  setButtonLoading(loginButton, true);
  loginError.textContent = '';

  try {
    const res = await fetch(SHEET_SISWA_URL);
    const csv = await res.text();
    const siswa = parseCSV(csv);
    const found = siswa.find(s => s.KODE === kode);

    if (!found) {
      loginError.textContent = 'Kode tidak ditemukan.';
      studentInfoDiv.classList.add('hidden');
      return;
    }

    // Tampilkan info siswa
    studentNameSpan.textContent = found.Nama;
    studentClassSpan.textContent = found.Kelas;
    studentInfoDiv.classList.remove('hidden');
    subjectSelect.disabled = true;
    startExamButton.disabled = true;

    // Simpan di localStorage
    localStorage.setItem('siswa', JSON.stringify({ kode, nama: found.Nama, kelas: found.Kelas }));

    // Isi dropdown mapel
    const resSoal = await fetch(SHEET_SOAL_URL);
    const csvSoal = await resSoal.text();
    const soal = parseCSV(csvSoal);
    const mapelSet = new Set(soal.map(s => s['Mata Pelajaran']));
    
    subjectSelect.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    mapelSet.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      subjectSelect.appendChild(opt);
    });

    subjectSelect.disabled = false;
    subjectSelect.onchange = () => {
        startExamButton.disabled = !subjectSelect.value;
    };

  } catch (err) {
    loginError.textContent = 'Gagal mengambil data. Periksa koneksi internet Anda.';
  } finally {
    setButtonLoading(loginButton, false);
  }
}

// --- Login & Validasi Siswa ---
loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const kode = kodeInput.value.trim();
  if (!kode.match(/^[A-Za-z0-9]+$/)) {
    loginError.textContent = 'Kode hanya boleh berisi huruf dan angka.';
    return;
  }
  await validateStudent(kode);
});

// --- Mulai Ujian ---
startExamButton.addEventListener('click', async function() {
  const subject = subjectSelect.value;
  if (!subject) return;

  // Ambil soal sesuai mapel
  const res = await fetch(SHEET_SOAL_URL);
  const csv = await res.text();
  const soalAll = parseCSV(csv);
  currentSoal = soalAll.filter(s => s['Mata Pelajaran'] === subject);

  if (!currentSoal.length) {
    alert('Soal tidak tersedia untuk mapel ini.');
    return;
  }

  localStorage.setItem('soal', JSON.stringify(currentSoal));
  localStorage.setItem('subject', subject);
  localStorage.setItem('jawaban', JSON.stringify({}));
  
  showExamPage(currentSoal);
});

// --- Halaman Ujian ---
function showExamPage(soal) {
  showPage('exam-page');
  let idx = 0;
  let waktu = 90 * 60; // 90 menit dalam detik
  function formatMenitDetik(s) {
    const m = Math.floor(s/60);
    const d = s%60;
    return `${m}:${d.toString().padStart(2,'0')}`;
  }
  function renderSoal() {
    const jawaban = JSON.parse(localStorage.getItem('jawaban') || '{}');
    const s = soal[idx];
    const siswa = JSON.parse(localStorage.getItem('siswa')) || {};
    // Navigasi nomor soal
    let nomorNav = '<div class="nav-row">';
    nomorNav += '<div class="nav-info">';
    nomorNav += `<div><b>Nama:</b> ${siswa.nama||'-'}</div>`;
    nomorNav += `<div><b>Kelas:</b> ${siswa.kelas||'-'}</div>`;
    nomorNav += `<div><b>Mapel:</b> ${localStorage.getItem('subject')||'-'}</div>`;
    nomorNav += `<div><b>Sisa waktu:</b> <span id="waktu">${formatMenitDetik(waktu)}</span> menit</div>`;
    nomorNav += '</div>';
    nomorNav += '<div class="nomor-nav">';
    for(let i=0;i<soal.length;i++) {
      nomorNav += `<button class="nomor-btn${i===idx?' active':''}${jawaban[i]?' answered':''}" data-no="${i}">${i+1}</button>`;
    }
    nomorNav += '</div>';
    nomorNav += '</div>';
    examPage.innerHTML = `
      ${nomorNav}
      <div class="soal">
        <div class="soal-header"><b>Soal ${idx+1} dari ${soal.length}</b></div>
        <div class="soal-pertanyaan">${s.Pertanyaan}</div>
        <div class="soal-pilihan">
          ${['A','B','C','D'].map(opt => `
            <label class="pilihan-label${jawaban[idx]===opt?' selected':''}">
              <input type="radio" name="jawab" value="${opt}" ${jawaban[idx]===opt?'checked':''}>
              <span class="opt-text">${opt}. ${s['Pilihan '+opt]}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="soal-nav">
        <button id="prev" ${idx===0?'disabled':''}>Prev</button>
        <button id="next" ${idx===soal.length-1?'disabled':''}>Next</button>
        <button id="finish">Selesai</button>
      </div>
    `;
    // Event navigasi nomor soal
    document.querySelectorAll('.nomor-btn').forEach(btn => {
      btn.onclick = function() {
        idx = parseInt(this.getAttribute('data-no'));
        renderSoal();
      };
    });
    document.querySelectorAll('input[name="jawab"]').forEach(radio => {
      radio.addEventListener('change', function() {
        jawaban[idx] = this.value;
        localStorage.setItem('jawaban', JSON.stringify(jawaban));
        renderSoal(); // update highlight dan nomor
      });
    });
    document.getElementById('prev').onclick = () => { if(idx>0){idx--;renderSoal();} };
    document.getElementById('next').onclick = () => { if(idx<soal.length-1){idx++;renderSoal();} };
    document.getElementById('finish').onclick = () => { clearInterval(timerInterval); showResultPage(soal); };
  }
  renderSoal();
  timerInterval = setInterval(() => {
    waktu--;
    document.getElementById('waktu').textContent = formatMenitDetik(waktu);
    if (waktu <= 0) {
      clearInterval(timerInterval);
      showResultPage(soal);
    }
  }, 1000);
}

// --- Halaman Hasil ---
function showResultPage(soal) {
  document.getElementById('exam-page').style.display = 'none';
  const resultPage = document.getElementById('result-page');
  resultPage.style.display = 'block';
  const siswa = JSON.parse(localStorage.getItem('siswa'));
  const subject = localStorage.getItem('subject');
  const jawaban = JSON.parse(localStorage.getItem('jawaban')||'{}');
  let benar = 0;
  soal.forEach((s, i) => {
    if (jawaban[i] === s['Jawaban Benar']) benar++;
  });
  const salah = soal.length - benar;
  const nilai = Math.round((benar/soal.length)*100);
  const persentase = ((benar/soal.length)*100).toFixed(2);
  resultPage.innerHTML = `
    <h3>Hasil Ujian</h3>
    <p>KODE: ${siswa.kode}</p>
    <p>Nama: ${siswa.nama}</p>
    <p>Kelas: ${siswa.kelas}</p>
    <p>Mata Pelajaran: ${subject}</p>
    <p>Nilai: <b>${nilai}</b></p>
    <p>Benar: ${benar} | Salah: ${salah} | Persentase: ${persentase}%</p>
    <button id="download-txt">Download TXT</button>
    <button id="ulang">Ulang Ujian</button>
  `;
  // Kirim ke Google Form
  sendToGoogleForm({
    kode: siswa.kode,
    nama: siswa.nama,
    kelas: siswa.kelas,
    mapel: subject,
    nilai,
    benar,
    salah,
    persentase
  });
  document.getElementById('download-txt').onclick = () => {
    const txt = `KODE: ${siswa.kode}\nNama: ${siswa.nama}\nKelas: ${siswa.kelas}\nMapel: ${subject}\nNilai: ${nilai}\nBenar: ${benar}\nSalah: ${salah}\nPersentase: ${persentase}%`;
    const blob = new Blob([txt], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hasil_${siswa.kode}_${subject}.txt`;
    a.click();
  };
  document.getElementById('ulang').onclick = () => {
    localStorage.clear();
    location.reload();
  };
}

// --- Kirim ke Google Form ---
function sendToGoogleForm(data) {
  // Ganti entry.xxxxx dengan entry ID Google Form Anda
  const formData = new FormData();
  formData.append('entry.111111', data.kode);
  formData.append('entry.222222', data.nama);
  formData.append('entry.333333', data.kelas);
  formData.append('entry.444444', data.mapel);
  formData.append('entry.555555', data.nilai);
  formData.append('entry.666666', data.benar);
  formData.append('entry.777777', data.salah);
  formData.append('entry.888888', data.persentase);
  fetch(GOOGLE_FORM_URL, { method: 'POST', mode: 'no-cors', body: formData });
}

// --- Jika sudah login, auto isi ---
window.onload = function() {
  const siswa = localStorage.getItem('siswa');
  if (siswa) {
    const s = JSON.parse(siswa);
    document.getElementById('kode').value = s.kode;
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  }
};
