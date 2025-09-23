// =================================================================================
// Partner Coding - XLSX to NMEXML Converter for Accurate
// Versi Final (dengan Branch Code Default)
// =================================================================================

// 1. Mengambil semua elemen dari HTML
const payableAccountInput = document.getElementById("payableAccount");
const salesAccountInput = document.getElementById("salesAccount");
const salesTaxAccountInput = document.getElementById("salesTaxAccount");
const csvFileInput = document.getElementById("taxInvoiceXLSX"); // Pastikan ID ini cocok dengan HTML
const convertButton = document.getElementById("convertButton");
const xmlOutput = document.getElementById("xmlOutput");
const downloadLink = document.getElementById("downloadLink");

// 2. Menambahkan "pendengar acara" (event listener) pada tombol konversi
convertButton.addEventListener("click", () => {
  // Mengambil nilai terbaru dari form
  const payableAcc = payableAccountInput.value.trim();
  const salesAcc = salesAccountInput.value.trim();
  const salesTaxAcc = salesTaxAccountInput.value.trim();

  // Validasi form
  if (!payableAcc || !salesAcc || !salesTaxAcc) {
    alert("Harap isi semua kolom Akun terlebih dahulu!");
    return;
  }
  if (csvFileInput.files.length === 0) {
    alert("Silakan pilih file Excel (.xlsx) terlebih dahulu!");
    return;
  }

  const file = csvFileInput.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Memanggil fungsi konversi. Kita tidak perlu lagi mengirim branchCode dari sini.
      const xmlString = convertDataToXml(
        jsonData,
        payableAcc,
        salesAcc,
        salesTaxAcc
      );

      xmlOutput.textContent = xmlString;
      setupDownloadLink(xmlString);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat memproses file Excel: " + error.message);
      xmlOutput.textContent =
        "Gagal memproses file. Pastikan format kolom di file Excel sudah benar.";
    }
  };

  reader.readAsArrayBuffer(file);
});

/**
 * Fungsi utama untuk mengubah data menjadi XML.
 */
function convertDataToXml(data, payableAcc, salesAcc, salesTaxAcc) {
  const branchCode = "1472498169";
  let transactions = "";
  let requestId = 1;

  for (const row of data) {
    const invoiceNo = row["Nomor Faktur Pajak"];
    const excelDate = row["Tanggal Faktur Pajak"];
    const customerName = row["Nama Pembeli"];
    const customerNo = row["NPWP Pembeli / Identitas lainnya"];
    const dpp = parseFloat(row["Harga Jual/Penggantian/DPP"]);
    const ppn = parseFloat(row["PPN"]);

    if (
      !invoiceNo ||
      !customerName ||
      isNaN(dpp) ||
      isNaN(ppn) ||
      !customerNo
    ) {
      console.warn(
        "Melewatkan baris karena data tidak lengkap atau tidak valid:",
        row
      );
      continue;
    }

    const total = dpp + ppn;
    const date = formatDate(excelDate);
    const transDescription = `Penjualan a/n ${customerName} No Faktur ${invoiceNo}`;

    let accountLines = "";

    // Baris Jurnal 1: Akun Piutang (Debit)
    accountLines += `
            <ACCOUNTLINE operation="Add">
                <KeyID>0</KeyID>
                <GLACCOUNT>${payableAcc}</GLACCOUNT>
                <GLAMOUNT>${total}</GLAMOUNT>
                <CUSTOMERNO>1000</CUSTOMERNO>
                <DESCRIPTION>${customerName} - ${invoiceNo}</DESCRIPTION>
                <RATE>1</RATE>
                <PRIMEAMOUNT>${total}</PRIMEAMOUNT>
                <TXDATE/>
                <POSTED/>
                <CURRENCYNAME>IDR</CURRENCYNAME>
            </ACCOUNTLINE>`;

    // Baris Jurnal 2: Akun Penjualan (Kredit)
    accountLines += `
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
            </ACCOUNTLINE>`;

    // Baris Jurnal 3: Akun PPN (Kredit)
    accountLines += `
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
            <JVNUMBER>${invoiceNo}</JVNUMBER>
            <TRANSDATE>${date}</TRANSDATE>
            <SOURCE>GL</SOURCE>
            <TRANSTYPE>journal voucher</TRANSTYPE>
            <TRANSDESCRIPTION>${transDescription}</TRANSDESCRIPTION>
            <JVAMOUNT>${total}</JVAMOUNT>
        </JV>`;

    requestId++;
  }

  // Menggunakan variabel branchCode yang sudah kita atur di atas
  return `<?xml version="1.0"?>
<NMEXML EximID="1" BranchCode="${branchCode}" ACCOUNTANTCOPYID="">
    <TRANSACTIONS OnError="CONTINUE">
        ${transactions}
    </TRANSACTIONS>
</NMEXML>`;
}

/**
 * Fungsi pembantu untuk format tanggal.
 */
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

/**
 * Fungsi untuk menyiapkan link unduhan file XML.
 */
function setupDownloadLink(xmlString) {
  const blob = new Blob([xmlString], { type: "application/xml" });
  const url = URL.createObjectURL(blob);

  downloadLink.href = url;
  downloadLink.download = "import_journal_voucher.xml";
  downloadLink.classList.remove("hidden");
}
