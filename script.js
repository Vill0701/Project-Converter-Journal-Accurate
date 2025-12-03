// =================================================================
// KONFIGURASI KATEGORI
// Ubah ini menjadi 'purchase_b1', 'purchase_b2', dst pada file lain
const APP_CATEGORY = "sales";
// =================================================================

const receiveableAccountInput = document.getElementById("receiveableAccount");
const salesAccountInput = document.getElementById("salesAccount");
const salesTaxAccountInput = document.getElementById("salesTaxAccount");
const xlsxFileInput = document.getElementById("taxInvoiceXLSX");
const convertButton = document.getElementById("convertButton");
const xmlOutput = document.getElementById("xmlOutput");
const downloadLink = document.getElementById("downloadLink");
const journalYear = document.getElementById("journalYear");
const journalMonth = document.getElementById("journalMonth");
let indexNumber = document.getElementById("index");
const historyList = document.getElementById("historyList");

document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
});

convertButton.addEventListener("click", () => {
  const receivableAcc = receiveableAccountInput.value.trim();
  const salesAcc = salesAccountInput.value.trim();
  const salesTaxAcc = salesTaxAccountInput.value.trim();
  const year = journalYear.value.trim();
  const month = journalMonth.value.trim().padStart(2, "0");
  let indexNum = indexNumber.value.trim() || 1;

  if (!receivableAcc || !salesAcc || !salesTaxAcc || !year || !month) {
    alert("Harap isi semua kolom Akun terlebih dahulu!");
    return;
  }
  if (xlsxFileInput.files.length === 0) {
    alert("Silakan pilih file Excel (.xlsx) terlebih dahulu!");
    return;
  }

  const file = xlsxFileInput.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const xmlString = convertDataToXml(
        jsonData,
        receivableAcc,
        salesAcc,
        salesTaxAcc,
        year,
        month,
        indexNum
      );

      xmlOutput.textContent = xmlString;
      setupDownloadLink(xmlString);

      // Simpan dengan nama unik
      const generatedFilename = `${APP_CATEGORY}_${year}${month}_${Date.now()}.xml`;
      saveToDatabase(generatedFilename, xmlString);
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Terjadi kesalahan: " + error.message);
    }
  };

  reader.readAsArrayBuffer(file);
});

// --- UPDATE: MENGIRIM KATEGORI KE SERVER ---
function saveToDatabase(filename, content) {
  if (!content) return;

  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: APP_CATEGORY, // <--- INI PENTING
      filename: filename,
      xml_content: content,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error("Gagal menyimpan ke server");
      return response.json();
    })
    .then((data) => {
      loadHistory(); // Refresh list otomatis setelah simpan
    })
    .catch((err) => {
      console.error("Gagal menyimpan:", err);
      alert("Gagal menyimpan riwayat ke database.");
    });
}

// --- UPDATE: MENGAMBIL HISTORY SESUAI KATEGORI ---
function loadHistory() {
  if (!historyList) return;

  // Fetch URL berubah menjadi spesifik kategori
  fetch(`/api/history/${APP_CATEGORY}`)
    .then((res) => res.json())
    .then((data) => {
      historyList.innerHTML = "";

      if (data.length === 0) {
        historyList.innerHTML =
          "<li style='padding:10px;'>Belum ada riwayat file untuk kategori ini.</li>";
        return;
      }

      data.forEach((item) => {
        const li = document.createElement("li");
        li.style.cssText =
          "border-bottom: 1px solid #eee; padding: 10px; display: flex; justify-content: space-between; align-items: center;";

        const dateStr = new Date(item.created_at).toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        li.innerHTML = `
                <div>
                <strong style="color: #333;">${item.filename}</strong><br>
                <small style="color: #666;">${dateStr}</small>
            </div>
            <div style="display: flex; gap: 5px;">
                <button onclick="downloadFromHistory(${item.id}, '${item.filename}')" 
                        style="background-color: #28a745; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 14px;">
                    Unduh
                </button>
                
                <button onclick="deleteHistory(${item.id})" 
                        style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 14px;">
                    Hapus
                </button>
            </div>
        `;
        historyList.appendChild(li);
      });
    })
    .catch((err) => console.error("Gagal memuat history:", err));
}

window.downloadFromHistory = function (id, filename) {
  // Download tetap mengambil by ID (Universal)
  fetch(`/api/download/${id}`)
    .then((res) => res.json())
    .then((data) => {
      const blob = new Blob([data.xml_content], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    })
    .catch((err) => alert("Gagal mengunduh file: " + err));
};

window.deleteHistory = function (id) {
  // Konfirmasi dulu agar tidak terhapus tidak sengaja
  if (!confirm("Apakah Anda yakin ingin menghapus file ini dari riwayat?")) {
    return;
  }

  fetch(`http://localhost:3000/api/history/${id}`, {
    method: "DELETE",
  })
    .then((response) => {
      if (response.ok) {
        loadHistory(); // Refresh list setelah dihapus
      } else {
        alert("Gagal menghapus data.");
      }
    })
    .catch((err) => alert("Error server: " + err));
};

function setupDownloadLink(xmlString) {
  const blob = new Blob([xmlString], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = "import_journal_voucher.xml";
  downloadLink.classList.remove("hidden");
}

function convertDataToXml(
  data,
  receivableAcc,
  salesAcc,
  salesTaxAcc,
  year,
  month,
  indexNum
) {
  const branchCode = "1472498169";
  let transactions = "";
  let requestId = 1;

  for (const row of data) {
    const invoiceNo =
      row["Nomor Faktur Pajak"] ??
      row["Faktur Pajak/Dokumen Tertentu/Nota Retur/Nota Pembatalan - Nomor"];
    const excelDate =
      row["Tanggal Faktur Pajak"] ??
      row["Faktur Pajak/Dokumen Tertentu/Nota Retur/Nota Pembatalan - Tanggal"];
    const customerName =
      row["Nama Pembeli"] ??
      row["Nama Pembeli BKP/Penerima Manfaat BKP Tidak Berwujud/Penerima JKP"];
    const customerNo =
      row["NPWP Pembeli / Identitas lainnya"] ?? row["NPWP/NIK/Nomor Paspor"];
    const dpp = parseFloat(
      row["Harga Jual/Penggantian/DPP"] ??
        row["Harga Jual/Penggantian/DPP (Rupiah)"]
    );
    const ppn = parseFloat(row["PPN"] ?? row["PPN (Rupiah)"]);
    const index = String(indexNum).padStart(3, "0");
    const journalVoucherCode = `PENJ.${year}.${month}.${index}`;

    if (!invoiceNo || !customerName || isNaN(dpp) || isNaN(ppn) || !customerNo)
      continue;

    const total = dpp + ppn;
    const date = formatDate(excelDate);
    const transDescription = `${customerName} - ${customerNo} - ${invoiceNo}`;

    // --- STRUKTUR JURNAL PENJUALAN (SALES) ---
    // Piutang (Debit), Penjualan (Kredit), PPN (Kredit)
    let accountLines = `
            <ACCOUNTLINE operation="Add">
                <KeyID>0</KeyID>
                <GLACCOUNT>${receivableAcc}</GLACCOUNT>
                <GLAMOUNT>${total}</GLAMOUNT>
                <CUSTOMERNO>1000</CUSTOMERNO>
                <DESCRIPTION>${customerName} - ${invoiceNo}</DESCRIPTION>
                <RATE>1</RATE>
                <PRIMEAMOUNT>${total}</PRIMEAMOUNT>
                <TXDATE/>
                <POSTED/>
                <CURRENCYNAME>IDR</CURRENCYNAME>
            </ACCOUNTLINE>
            <ACCOUNTLINE operation="Add">
                <KeyID>1</KeyID>
                <GLACCOUNT>${salesAcc}</GLACCOUNT>
                <GLAMOUNT>${-dpp}</GLAMOUNT> 
                <DESCRIPTION>${customerName} - ${invoiceNo}</DESCRIPTION>
                <RATE>1</RATE>
                <PRIMEAMOUNT>${-dpp}</PRIMEAMOUNT>
                <TXDATE/>
                <POSTED/>
                <CURRENCYNAME>IDR</CURRENCYNAME>
            </ACCOUNTLINE>
            <ACCOUNTLINE operation="Add">
                <KeyID>2</KeyID>
                <GLACCOUNT>${salesTaxAcc}</GLACCOUNT>
                <GLAMOUNT>${-ppn}</GLAMOUNT>
                <DESCRIPTION>PPN 12% - ${customerName}</DESCRIPTION>
                <RATE>1</RATE>
                <PRIMEAMOUNT>${-ppn}</PRIMEAMOUNT>
                <TXDATE/>
                <POSTED/>
                <CURRENCYNAME>IDR</CURRENCYNAME>
            </ACCOUNTLINE>`;

    transactions += `
        <JV operation="Add" REQUESTID="${requestId}">
            <TRANSACTIONID>148</TRANSACTIONID>
            ${accountLines}
            <JVNUMBER>${journalVoucherCode}</JVNUMBER>
            <TRANSDATE>${date}</TRANSDATE>
            <SOURCE>GL</SOURCE>
            <TRANSTYPE>journal voucher</TRANSTYPE>
            <TRANSDESCRIPTION>${transDescription}</TRANSDESCRIPTION>
            <JVAMOUNT>${total}</JVAMOUNT>
        </JV>`;
    indexNum++;
    requestId++;
  }

  return `<?xml version="1.0"?>\n<NMEXML EximID="1" BranchCode="${branchCode}" ACCOUNTANTCOPYID="">\n<TRANSACTIONS OnError="CONTINUE">\n${transactions}\n</TRANSACTIONS>\n</NMEXML>`;
}

function formatDate(serial) {
  if (
    typeof serial === "string" &&
    (serial.includes("-") || serial.includes("/"))
  ) {
    const d = new Date(serial);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof serial === "number") {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const year = date_info.getFullYear();
    const month = String(date_info.getMonth() + 1).padStart(2, "0");
    const day = String(date_info.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return serial;
}
