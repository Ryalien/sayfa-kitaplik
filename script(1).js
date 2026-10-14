const demoBooks = [
  {
    id: "demo-martin-eden",
    title: "Martin Eden",
    author: "Jack London",
    category: "Roman",
    emoji: "⚓",
    cover: "https://covers.openlibrary.org/b/isbn/9780140187724-M.jpg",
    excerpt: "İnsan bazen kendini bulmak için dünyaya karşı yürümek zorunda kalır. Martin'in hikâyesi, hayallerin ve bedellerin hikâyesidir."
  },
  {
    id: "demo-kucuk-prens",
    title: "Küçük Prens",
    author: "Antoine de Saint-Exupéry",
    category: "Klasik",
    emoji: "🌹",
    cover: "https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg",
    excerpt: "İnsan ancak yüreğiyle baktığı zaman doğruyu görebilir. Asıl önemli olanı gözler göremez."
  },
  {
    id: "demo-donusum",
    title: "Dönüşüm",
    author: "Franz Kafka",
    category: "Klasik",
    emoji: "🪲",
    cover: "https://covers.openlibrary.org/b/isbn/9780553213690-M.jpg",
    excerpt: "Bir sabah huzursuz düşlerden uyanan Gregor Samsa, kendini yatağında dev bir böceğe dönüşmüş olarak buldu."
  },
  {
    id: "demo-simyaci",
    title: "Simyacı",
    author: "Paulo Coelho",
    category: "Roman",
    emoji: "🌙",
    cover: "https://covers.openlibrary.org/b/isbn/9780061122415-M.jpg",
    excerpt: "Bir şeyi gerçekten istediğin zaman, bütün evren onu gerçekleştirebilmen için iş birliği yapar."
  },
  {
    id: "demo-insan-ne-ile-yasar",
    title: "İnsan Ne ile Yaşar?",
    author: "Lev Tolstoy",
    category: "Öykü",
    emoji: "🕯️",
    cover: "https://covers.openlibrary.org/b/isbn/9780140447964-M.jpg",
    excerpt: "İnsan, kendisine ne kadar ömür verileceğini bilemez. Ama sevgiyi ve iyiliği seçerek hayatına anlam katabilir."
  },
  {
    id: "demo-atomik-aliskanliklar",
    title: "Atomik Alışkanlıklar",
    author: "James Clear",
    category: "Kişisel gelişim",
    emoji: "🌱",
    cover: "https://covers.openlibrary.org/b/isbn/9780735211292-M.jpg",
    excerpt: "Her gün yüzde bir daha iyi olmak küçük görünebilir. Ancak küçük alışkanlıklar zamanla büyük değişimlere dönüşür."
  },
  {
    id: "demo-hobbit",
    title: "Hobbit",
    author: "J. R. R. Tolkien",
    category: "Fantastik",
    emoji: "🍃",
    cover: "https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg",
    excerpt: "Bir hobbitin sakin hayatı, beklenmedik bir ziyaretle değişir. Bazen en büyük yolculuklar evden çıkmakla başlar."
  }
];

const KEYS = {
  custom: "sayfaCustomBooks",
  favorites: "sayfaFavorites",
  progress: "sayfaProgress",
  theme: "sayfaTheme"
};

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    alert("Tarayıcı depolama alanı dolmuş olabilir. Bazı kayıtlar kaydedilemedi.");
    return false;
  }
}

let customBooks = readStorage(KEYS.custom, []);
let favorites = readStorage(KEYS.favorites, []);
let progress = readStorage(KEYS.progress, {});
let books = [...demoBooks, ...customBooks];

let activeCategory = "Tümü";
let savedOnly = false;
let currentBook = null;
let currentPage = 1;
let currentPdf = null;
let currentEpub = null;
let currentRendition = null;
let currentObjectUrl = null;
let samplePage = 1;
let pdfRenderTask = null;
let currentReaderMode = "sample";

const $ = (id) => document.getElementById(id);

const homeScreen = $("homeScreen");
const readerScreen = $("readerScreen");
const bookGrid = $("bookGrid");
const categories = $("categories");
const searchInput = $("searchInput");

const sampleReader = $("sampleReader");
const sampleControls = $("sampleControls");
const pdfReader = $("pdfReader");
const epubReader = $("epubReader");

const SAMPLE_PAGE_COUNT = 10;

// Store uploaded files in IndexedDB so they can be opened again later.
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Bu tarayıcı dosya depolamayı desteklemiyor."));
      return;
    }

    const request = indexedDB.open("sayfaBookDatabase", 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const dbPromise = openDatabase();

async function storeFile(id, file) {
  const db = await dbPromise;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction.objectStore("files").put({
      id,
      name: file.name,
      type: file.type,
      blob: file
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getStoredFile(id) {
  const db = await dbPromise;

  return new Promise((resolve, reject) => {
    const request = db.transaction("files", "readonly")
      .objectStore("files")
      .get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function removeStoredFile(id) {
  const db = await dbPromise;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction.objectStore("files").delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function saveCustomBooks() {
  return writeStorage(KEYS.custom, customBooks);
}

function saveFavorites() {
  return writeStorage(KEYS.favorites, favorites);
}

function saveProgress() {
  return writeStorage(KEYS.progress, progress);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getProgressPercent(book) {
  const saved = progress[book.id];
  if (!saved) return 0;

  if (book.fileType === "pdf") {
    const total = Number(saved.total || 0);
    return total ? Math.min(100, Math.round((saved.page / total) * 100)) : 0;
  }

  if (book.fileType === "epub") {
    return Math.min(100, Math.max(0, Number(saved.percent || 0)));
  }

  return Math.min(100, Math.round(((saved.page || 1) / SAMPLE_PAGE_COUNT) * 100));
}

function makeBookCard(book) {
  const isFavorite = favorites.includes(book.id);
  const saved = progress[book.id];
  const percent = getProgressPercent(book);
  const cover = book.cover
    ? `<img src="${escapeHTML(book.cover)}" alt="${escapeHTML(book.title)} kapağı"
         loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
    : "";

  const deleteButton = book.custom
    ? `<button class="small-btn delete-btn" data-action="delete" data-id="${escapeHTML(book.id)}" type="button">Sil</button>`
    : "";

  return `
    <article class="book-card">
      <button class="favorite-btn" data-action="favorite" data-id="${escapeHTML(book.id)}"
        type="button" aria-label="${isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}">
        ${isFavorite ? "♥" : "♡"}
      </button>

      <div class="book-cover">
        ${cover}
        <div class="cover-emoji" style="${book.cover ? "display:none" : "display:flex"}">
          ${escapeHTML(book.emoji || "📚")}
        </div>
      </div>

      <div class="book-info">
        <h3>${escapeHTML(book.title)}</h3>
        <p class="book-author">${escapeHTML(book.author)}</p>
        <div class="book-meta">
          <span>${escapeHTML(book.category || "Diğer")}</span>
          <span>${book.fileType ? book.fileType.toUpperCase() : "Örnek okuma"}</span>
        </div>

        ${saved ? `
          <div class="progress-track" aria-label="Okuma ilerlemesi">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
          <p class="book-author">${percent}% tamamlandı</p>
        ` : ""}

        <div class="book-actions">
          <button class="small-btn read-btn" data-action="read" data-id="${escapeHTML(book.id)}" type="button">
            ${saved ? "Devam et" : "Oku"}
          </button>
          ${deleteButton}
        </div>
      </div>
    </article>
  `;
}

function renderCategories() {
  const categoryNames = [
    "Tümü",
    ...new Set(books.map((book) => book.category || "Diğer"))
  ];

  if (!categoryNames.includes(activeCategory)) activeCategory = "Tümü";

  categories.innerHTML = categoryNames.map((category) => `
    <button type="button"
      class="category-chip ${activeCategory === category ? "active" : ""}"
      data-category="${escapeHTML(category)}">
      ${escapeHTML(category)}
    </button>
  `).join("");
}

function renderCatalog() {
  const query = searchInput.value.trim().toLocaleLowerCase("tr-TR");

  const filtered = books.filter((book) => {
    const matchesQuery =
      `${book.title} ${book.author} ${book.category}`
        .toLocaleLowerCase("tr-TR")
        .includes(query);

    const matchesCategory =
      activeCategory === "Tümü" || book.category === activeCategory;

    const matchesSaved = !savedOnly || favorites.includes(book.id);

    return matchesQuery && matchesCategory && matchesSaved;
  });

  $("bookCount").textContent = `${filtered.length} kitap`;
  $("catalogTitle").textContent = savedOnly ? "Favori kitapların" : "Kitaplığını keşfet";
  $("catalogEyebrow").textContent = savedOnly ? "SANA ÖZEL" : "KEŞFET";
  $("noResults").classList.toggle("hidden", filtered.length > 0);
  bookGrid.innerHTML = filtered.map(makeBookCard).join("");
  renderCategories();
}

function renderContinueReading() {
  const readingBooks = books
    .filter((book) => progress[book.id])
    .sort((a, b) => (progress[b.id].updatedAt || 0) - (progress[a.id].updatedAt || 0))
    .slice(0, 4);

  $("continueBooks").innerHTML = readingBooks.map(makeBookCard).join("");
  $("continueEmpty").classList.toggle("hidden", readingBooks.length > 0);
  $("continueBooks").classList.toggle("hidden", readingBooks.length === 0);
}

function renderAll() {
  renderContinueReading();
  renderCatalog();
}

function showHome() {
  closeReaderResources();
  homeScreen.classList.remove("hidden");
  readerScreen.classList.add("hidden");
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.showHome = showHome;

function showReaderScreen(book) {
  currentBook = book;
  homeScreen.classList.add("hidden");
  readerScreen.classList.remove("hidden");

  $("readerTitle").textContent = book.title;
  $("readerAuthor").textContent = `${book.author} · ${book.category}`;
  $("readerFavorite").textContent = favorites.includes(book.id) ? "♥" : "♡";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideReaderAreas() {
  sampleReader.classList.add("hidden");
  sampleControls.classList.add("hidden");
  pdfReader.classList.add("hidden");
  epubReader.classList.add("hidden");
}

function closeReaderResources() {
  if (pdfRenderTask) {
    try {
      pdfRenderTask.cancel();
    } catch (_) {}
    pdfRenderTask = null;
  }

  if (currentRendition) {
    try {
      currentRendition.destroy();
    } catch (_) {}
    currentRendition = null;
  }

  if (currentEpub) {
    try {
      currentEpub.destroy();
    } catch (_) {}
    currentEpub = null;
  }

  if (currentPdf) {
    try {
      currentPdf.destroy();
    } catch (_) {}
    currentPdf = null;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function saveCurrentProgress(extra = {}) {
  if (!currentBook) return;

  progress[currentBook.id] = {
    ...(progress[currentBook.id] || {}),
    ...extra,
    updatedAt: Date.now()
  };

  saveProgress();
  renderContinueReading();
}

function openSampleReader(book) {
  currentReaderMode = "sample";
  hideReaderAreas();

  sampleReader.classList.remove("hidden");
  sampleControls.classList.remove("hidden");

  samplePage = Number(progress[book.id]?.page || 1);
  samplePage = Math.min(SAMPLE_PAGE_COUNT, Math.max(1, samplePage));

  $("sampleText").textContent = book.excerpt ||
    "Bu kitap için henüz bir okuma metni eklenmedi. Kendi PDF veya EPUB dosyanı ekleyerek kitabını burada okuyabilirsin.";

  updateSamplePage();
}

function updateSamplePage() {
  $("samplePageLabel").textContent = `Sayfa ${samplePage} / ${SAMPLE_PAGE_COUNT}`;
  $("samplePrev").disabled = samplePage <= 1;
  $("sampleNext").disabled = samplePage >= SAMPLE_PAGE_COUNT;

  if (currentBook) {
    saveCurrentProgress({ page: samplePage });
  }
}

async function openPdfReader(book, blob) {
  if (!window.pdfjsLib) {
    throw new Error("PDF okuyucu yüklenemedi. Sayfayı yenileyip tekrar dene.");
  }

  currentReaderMode = "pdf";
  hideReaderAreas();
  pdfReader.classList.remove("hidden");

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  currentObjectUrl = URL.createObjectURL(blob);

  const loadingTask = window.pdfjsLib.getDocument(currentObjectUrl);
  currentPdf = await loadingTask.promise;

  const savedPage = Number(progress[book.id]?.page || 1);
  currentPage = Math.min(currentPdf.numPages, Math.max(1, savedPage));

  $("pdfPageTotal").textContent = currentPdf.numPages;
  await renderPdfPage();
}

async function renderPdfPage() {
  if (!currentPdf) return;

  if (pdfRenderTask) {
    try {
      pdfRenderTask.cancel();
    } catch (_) {}
    pdfRenderTask = null;
  }

  const page = await currentPdf.getPage(currentPage);
  const canvas = $("pdfCanvas");
  const context = canvas.getContext("2d");

  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(280, $("pdfCanvasWrap").clientWidth - 36);
  const scale = Math.min(1.7, availableWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  pdfRenderTask = page.render({
    canvasContext: context,
    viewport
  });

  try {
    await pdfRenderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") throw error;
  }

  pdfRenderTask = null;

  $("pdfPageNumber").textContent = currentPage;
  $("pdfPrev").disabled = currentPage <= 1;
  $("pdfNext").disabled = currentPage >= currentPdf.numPages;

  saveCurrentProgress({
    page: currentPage,
    total: currentPdf.numPages
  });
}

async function openEpubReader(book, blob) {
  if (typeof window.ePub !== "function") {
    throw new Error("EPUB okuyucu yüklenemedi. Sayfayı yenileyip tekrar dene.");
  }

  currentReaderMode = "epub";
  hideReaderAreas();
  epubReader.classList.remove("hidden");

  $("epubViewer").innerHTML = "";
  const arrayBuffer = await blob.arrayBuffer();

  currentEpub = window.ePub(arrayBuffer);
  currentRendition = currentEpub.renderTo("epubViewer", {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "none"
  });

  currentRendition.themes.default({
    body: {
      "font-family": "Georgia, serif",
      "line-height": "1.8",
      color: getComputedStyle(document.body).getPropertyValue("--text")
    }
  });

  currentRendition.on("relocated", (location) => {
    if (!currentBook || !location?.start) return;

    const percent = location.start.percentage != null
      ? Math.round(location.start.percentage * 100)
      : 0;

    saveCurrentProgress({
      cfi: location.start.cfi,
      percent
    });
  });

  const savedCfi = progress[book.id]?.cfi;
  await currentRendition.display(savedCfi || undefined);
}

async function openBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) return;

  closeReaderResources();
  showReaderScreen(book);
  hideReaderAreas();

  $("readerStatus").textContent = "Kitap hazırlanıyor...";

  try {
    if (book.fileId && book.fileType) {
      const stored = await getStoredFile(book.fileId);

      if (!stored?.blob) {
        throw new Error("Kitap dosyası bulunamadı. Dosyayı yeniden eklemen gerekiyor.");
      }

      if (book.fileType === "pdf") {
        await openPdfReader(book, stored.blob);
      } else if (book.fileType === "epub") {
        await openEpubReader(book, stored.blob);
      } else {
        openSampleReader(book);
      }
    } else {
      openSampleReader(book);
    }

    $("readerStatus").textContent = "Okuma ilerlemen otomatik kaydediliyor.";
  } catch (error) {
    hideReaderAreas();
    $("readerStatus").textContent = error.message || "Kitap açılamadı.";
    console.error(error);
  }
}

function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter((item) => item !== id);
  } else {
    favorites.push(id);
  }

  saveFavorites();
  renderAll();

  if (currentBook?.id === id) {
    $("readerFavorite").textContent = favorites.includes(id) ? "♥" : "♡";
  }
}

async function deleteBook(id) {
  const book = customBooks.find((item) => item.id === id);
  if (!book) return;

  const confirmed = window.confirm(`"${book.title}" kitabını kitaplığından silmek istiyor musun?`);
  if (!confirmed) return;

  try {
    if (book.fileId) await removeStoredFile(book.fileId);
  } catch (error) {
    console.error("Dosya silinemedi:", error);
  }

  customBooks = customBooks.filter((item) => item.id !== id);
  books = [...demoBooks, ...customBooks];
  favorites = favorites.filter((item) => item !== id);
  delete progress[id];

  saveCustomBooks();
  saveFavorites();
  saveProgress();

  if (currentBook?.id === id) {
    showHome();
  } else {
    renderAll();
  }
}

bookGrid.addEventListener("click", handleBookAction);
$("continueBooks").addEventListener("click", handleBookAction);

function handleBookAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "read") openBook(id);
  if (button.dataset.action === "favorite") toggleFavorite(id);
  if (button.dataset.action === "delete") deleteBook(id);
}

categories.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  activeCategory = button.dataset.category;
  renderCatalog();
});

searchInput.addEventListener("input", renderCatalog);

$("savedTab").addEventListener("click", () => {
  savedOnly = !savedOnly;
  $("savedTab").textContent = savedOnly ? "← Tüm kitaplar" : "♡ Kitaplığım";

  if (savedOnly) {
    activeCategory = "Tümü";
    homeScreen.scrollIntoView({ behavior: "smooth" });
    $("catalogTitle").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  renderCatalog();
});

$("themeToggle").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  document.body.classList.toggle("dark", dark);
  localStorage.setItem(KEYS.theme, dark ? "dark" : "light");
  $("themeToggle").textContent = dark ? "☀" : "☾";
});

$("addBookForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("formMessage");
  const file = $("bookFile").files[0];
  const title = $("bookTitle").value.trim();
  const author = $("bookAuthor").value.trim();
  const cover = $("bookCover").value.trim();
  const category = $("bookCategory").value;

  message.textContent = "";

  if (!title || !author) {
    message.textContent = "Kitap adı ve yazar alanlarını doldur.";
    return;
  }

  let fileType = null;

  if (file) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (!["pdf", "epub"].includes(extension)) {
      message.textContent = "Lütfen yalnızca PDF veya EPUB dosyası seç.";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      message.textContent = "Dosya 100 MB sınırını aşıyor. Daha küçük bir dosya seç.";
      return;
    }

    fileType = extension;
  }

  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const newBook = {
    id,
    title,
    author,
    category,
    cover,
    emoji: "📚",
    excerpt: "Bu senin kitaplığındaki özel kitabın. Dosya eklediysen gerçek kitabını okuyabilir, sayfalarını kaydedebilirsin.",
    custom: true,
    fileType,
    fileId: file ? id : null
  };

  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;

  try {
    if (file) {
      await storeFile(id, file);
    }

    customBooks.unshift(newBook);

    if (!saveCustomBooks()) {
      customBooks = customBooks.filter((book) => book.id !== id);
      if (file) await removeStoredFile(id);
      message.textContent = "Kitap kaydedilemedi. Tarayıcı depolama alanını kontrol et.";
      return;
    }

    books = [...demoBooks, ...customBooks];
    activeCategory = "Tümü";
    savedOnly = false;
    $("savedTab").textContent = "♡ Kitaplığım";

    $("addBookForm").reset();
    message.textContent = file
      ? "Kitabın ve dosyan başarıyla kaydedildi. 📚"
      : "Kitabın kitaplığına eklendi. İstersen daha sonra PDF veya EPUB dosyası ekleyebilirsin. 📚";

    renderAll();

    $("catalogTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    message.textContent = error.message || "Kitap eklenemedi. Tekrar deneyebilir misin?";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

$("backHome").addEventListener("click", showHome);

$("readerFavorite").addEventListener("click", () => {
  if (currentBook) toggleFavorite(currentBook.id);
});

$("samplePrev").addEventListener("click", () => {
  if (samplePage > 1) {
    samplePage--;
    updateSamplePage();
  }
});

$("sampleNext").addEventListener("click", () => {
  if (samplePage < SAMPLE_PAGE_COUNT) {
    samplePage++;
    updateSamplePage();
  }
});

$("pdfPrev").addEventListener("click", async () => {
  if (currentPdf && currentPage > 1) {
    currentPage--;
    try {
      await renderPdfPage();
    } catch (error) {
      console.error(error);
    }
  }
});

$("pdfNext").addEventListener("click", async () => {
  if (currentPdf && currentPage < currentPdf.numPages) {
    currentPage++;
    try {
      await renderPdfPage();
    } catch (error) {
      console.error(error);
    }
  }
});

$("epubPrev").addEventListener("click", () => {
  if (currentRendition) currentRendition.prev();
});

$("epubNext").addEventListener("click", () => {
  if (currentRendition) currentRendition.next();
});

window.addEventListener("beforeunload", () => {
  closeReaderResources();
});

// Restore the saved theme and render the library.
const savedTheme = localStorage.getItem(KEYS.theme);
document.body.classList.toggle("dark", savedTheme === "dark");
$("themeToggle").textContent = savedTheme === "dark" ? "☀" : "☾";

renderAll();

/* ==========================================
   SAYFA. — OKUMA GÜNLÜĞÜ VE EK ÖZELLİKLER
   ========================================== */

const EXTRA_KEYS = {
  journal: "sayfaJournal",
  completed: "sayfaCompleted",
  daily: "sayfaDailyReading",
  settings: "sayfaReadingSettings"
};

let journalData = readStorage(EXTRA_KEYS.journal, {});
let completedBooks = readStorage(EXTRA_KEYS.completed, []);
let dailyReading = readStorage(EXTRA_KEYS.daily, {});
let readingSettings = readStorage(EXTRA_KEYS.settings, {
  dailyGoal: 20
});

let selectedRating = 0;
let readingSessionStarted = null;

function saveExtraData() {
  writeStorage(EXTRA_KEYS.journal, journalData);
  writeStorage(EXTRA_KEYS.completed, completedBooks);
  writeStorage(EXTRA_KEYS.daily, dailyReading);
  writeStorage(EXTRA_KEYS.settings, readingSettings);
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayData() {
  const today = todayKey();

  if (!dailyReading[today]) {
    dailyReading[today] = {
      pages: 0,
      minutes: 0
    };
  }

  return dailyReading[today];
}

/* Yeni alanları mevcut ana sayfaya ekle. */
function installFeaturePanel() {
  if ($("readingJournalPanel")) return;

  const panel = document.createElement("section");
  panel.id = "readingJournalPanel";
  panel.className = "feature-panel";

  panel.innerHTML = `
    <p class="eyebrow">SANA ÖZEL</p>
    <h2>Okuma günlüğüm</h2>
    <p class="feature-small">
      Okuduklarını takip et, düşüncelerini kaydet ve kendi okuma yolculuğunu oluştur.
    </p>

    <div class="feature-grid">
      <div class="feature-stat">
        <strong id="statCompleted">0</strong>
        <span>Bitirilen kitap</span>
      </div>
      <div class="feature-stat">
        <strong id="statPages">0</strong>
        <span>Kaydedilen son sayfaların toplamı</span>
      </div>
      <div class="feature-stat">
        <strong id="statMinutes">0</strong>
        <span>Takip edilen okuma dakikası</span>
      </div>
      <div class="feature-stat">
        <strong id="statRated">0</strong>
        <span>Puanlanan kitap</span>
      </div>
    </div>

    <hr class="feature-divider">

    <h3>Günlük okuma hedefin</h3>
    <div class="goal-row">
      <label>
        Günlük sayfa hedefi
        <input id="dailyGoalInput" type="number" min="1" max="2000">
      </label>
      <p id="goalText" class="feature-small">Bugün 0 sayfa okudun.</p>
    </div>
    <div class="goal-track">
      <div id="goalFill" class="goal-fill"></div>
    </div>
    <p id="goalMessage" class="feature-small"></p>

    <hr class="feature-divider">

    <h3>Kitap değerlendirmelerin</h3>
    <label>
      Kitap seç
      <select id="journalBookSelect"></select>
    </label>

    <label>
      Puanın
      <div id="starRating" class="star-rating" aria-label="Kitaba yıldız puanı ver">
        ${[1, 2, 3, 4, 5].map(number => `
          <button type="button" class="star-btn"
            data-rating="${number}" aria-label="${number} yıldız">★</button>
        `).join("")}
      </div>
    </label>

    <label>
      Kitap hakkında düşüncelerin
      <textarea id="journalNotes" maxlength="10000"
        placeholder="Bu kitap sana ne hissettirdi? Neler öğrendin?"></textarea>
    </label>

    <label>
      Sevdiğin alıntı
      <textarea id="journalQuote" maxlength="5000"
        placeholder="Beğendiğin cümleyi ve istersen sayfa numarasını yaz..."></textarea>
    </label>

    <label>
      Okuma durumum
      <select id="journalCompleted">
        <option value="no">Okumaya devam ediyorum</option>
        <option value="yes">Kitabı bitirdim</option>
      </select>
    </label>

    <div class="feature-actions">
      <button id="saveJournalBtn" class="primary-btn" type="button">
        Notlarımı kaydet
      </button>
    </div>
    <p id="journalMessage" class="feature-message" role="status"></p>

    <hr class="feature-divider">

    <h3>Verilerini yedekle</h3>
    <p class="feature-small">
      Kitap kayıtlarını, favorilerini, ilerlemeni, notlarını, puanlarını ve hedefini
      JSON dosyası olarak dışa aktarabilir veya daha önce aldığın yedeği geri yükleyebilirsin.
      Yüklenen PDF ve EPUB dosyaları bu yedek dosyasına dahil değildir.
    </p>

    <div class="feature-actions">
      <button id="exportBackupBtn" class="primary-btn" type="button">
        Yedeğimi indir
      </button>
      <label>
        Yedek dosyasını geri yükle
        <input id="importBackupInput" type="file" accept=".json,application/json">
      </label>
    </div>
    <p id="backupMessage" class="feature-message" role="status"></p>
  `;

  const addSection = $("addSection");
  addSection.parentNode.insertBefore(panel, addSection);
}

/* Kitap seçiciyi güncelle. */
function refreshJournalBookSelect() {
  const select = $("journalBookSelect");
  if (!select) return;

  const previous = select.value;
  select.innerHTML = books.map(book => `
    <option value="${escapeHTML(book.id)}">
      ${escapeHTML(book.title)} — ${escapeHTML(book.author)}
    </option>
  `).join("");

  if (books.some(book => book.id === previous)) {
    select.value = previous;
  }

  loadSelectedJournal();
}

function loadSelectedJournal() {
  const id = $("journalBookSelect")?.value;
  if (!id) return;

  const saved = journalData[id] || {};
  selectedRating = Number(saved.rating || 0);

  $("journalNotes").value = saved.notes || "";
  $("journalQuote").value = saved.quote || "";
  $("journalCompleted").value = completedBooks.includes(id) ? "yes" : "no";

  updateStarButtons();
}

function updateStarButtons() {
  document.querySelectorAll("#starRating [data-rating]").forEach(button => {
    const rating = Number(button.dataset.rating);
    button.classList.toggle("active", rating <= selectedRating);
    button.setAttribute("aria-pressed", String(rating === selectedRating));
  });
}

function saveSelectedJournal() {
  const id = $("journalBookSelect").value;
  if (!id) return;

  const previous = journalData[id] || {};

  journalData[id] = {
    ...previous,
    rating: selectedRating,
    notes: $("journalNotes").value.trim(),
    quote: $("journalQuote").value.trim(),
    updatedAt: Date.now()
  };

  if ($("journalCompleted").value === "yes") {
    if (!completedBooks.includes(id)) completedBooks.push(id);
  } else {
    completedBooks = completedBooks.filter(bookId => bookId !== id);
  }

  saveExtraData();
  updateReadingStats();

  $("journalMessage").textContent = "Değerlendirmen ve notların kaydedildi. 🤎";
}

/* İstatistikler: sayfa ilerlemesi, tamamlanan ve puanlanan kitaplar. */
function updateReadingStats() {
  if (!$("statCompleted")) return;

  const savedPageTotal = Object.values(progress).reduce((total, item) => {
    return total + Math.max(0, Number(item.page || 0));
  }, 0);

  const minutesTotal = Object.values(dailyReading).reduce((total, item) => {
    return total + Math.max(0, Number(item.minutes || 0));
  }, 0);

  const ratedTotal = Object.values(journalData).filter(item => {
    return Number(item.rating) > 0;
  }).length;

  $("statCompleted").textContent = completedBooks.length;
  $("statPages").textContent = savedPageTotal;
  $("statMinutes").textContent = minutesTotal;
  $("statRated").textContent = ratedTotal;

  updateDailyGoal();
}

function updateDailyGoal() {
  if (!$("goalFill")) return;

  const today = getTodayData();
  const goal = Math.max(1, Number(readingSettings.dailyGoal) || 20);
  const pages = Number(today.pages || 0);
  const percent = Math.min(100, Math.round((pages / goal) * 100));

  $("dailyGoalInput").value = goal;
  $("goalText").textContent = `Bugün ${pages} / ${goal} sayfa`;
  $("goalFill").style.width = `${percent}%`;
  $("goalMessage").textContent = pages >= goal
    ? "Günlük hedefini tamamladın. Harika! 🎉"
    : `Hedefine ulaşmak için ${goal - pages} sayfa daha oku.`;
}

/* Sayfa ilerlemesi arttığında günlük hedefe ekle. */
const originalSaveCurrentProgress = saveCurrentProgress;

saveCurrentProgress = function(extra = {}) {
  const oldPage = Number(
    currentBook ? progress[currentBook.id]?.page || 0 : 0
  );

  originalSaveCurrentProgress(extra);

  if (currentBook && extra.page != null) {
    const newPage = Number(extra.page);
    const difference = Math.max(0, newPage - oldPage);

    if (difference > 0) {
      const today = getTodayData();
      today.pages += difference;
      saveExtraData();
      updateReadingStats();
    }
  }
};

/* Okuma ekranında geçen süreyi takip et. */
function finishReadingSession() {
  if (!readingSessionStarted) return;

  const elapsed = Date.now() - readingSessionStarted;
  const minutes = Math.floor(elapsed / 60000);
  readingSessionStarted = null;

  if (minutes > 0) {
    const today = getTodayData();
    today.minutes += minutes;
    saveExtraData();
    updateReadingStats();
  }
}

const originalOpenBook = openBook;

openBook = async function(id) {
  finishReadingSession();
  readingSessionStarted = Date.now();
  await originalOpenBook(id);
};

const originalShowHome = showHome;

showHome = function() {
  finishReadingSession();
  originalShowHome();
};

window.showHome = showHome;

window.addEventListener("beforeunload", finishReadingSession);

/* Yedekleme: kişisel kayıtları JSON'a aktar. */
function downloadBackup() {
  const backup = {
    app: "sayfa.",
    version: 1,
    createdAt: new Date().toISOString(),
    customBooks,
    favorites,
    progress,
    theme: localStorage.getItem(KEYS.theme) || "light",
    journalData,
    completedBooks,
    dailyReading,
    readingSettings
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sayfa-yedek-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  $("backupMessage").textContent =
    "Yedek dosyan hazır. Güvenli bir yerde sakla.";
}

async function restoreBackup(file) {
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());

    if (
      backup.app !== "sayfa." ||
      !Array.isArray(backup.customBooks) ||
      !Array.isArray(backup.favorites) ||
      typeof backup.progress !== "object" ||
      backup.progress === null
    ) {
      throw new Error("Bu dosya geçerli bir SAYFA. yedeği değil.");
    }

    const confirmed = confirm(
      "Mevcut kitap kayıtların ve kişisel verilerin yedekteki bilgilerle değiştirilecek. Devam etmek istiyor musun?"
    );

    if (!confirmed) return;

    customBooks = backup.customBooks;
    favorites = backup.favorites;
    progress = backup.progress;
    journalData = backup.journalData || {};
    completedBooks = backup.completedBooks || [];
    dailyReading = backup.dailyReading || {};
    readingSettings = backup.readingSettings || { dailyGoal: 20 };

    saveCustomBooks();
    saveFavorites();
    saveProgress();
    saveExtraData();

    if (backup.theme === "dark" || backup.theme === "light") {
      localStorage.setItem(KEYS.theme, backup.theme);
      document.body.classList.toggle("dark", backup.theme === "dark");
      $("themeToggle").textContent =
        backup.theme === "dark" ? "☀" : "☾";
    }

    books = [...demoBooks, ...customBooks];
    activeCategory = "Tümü";
    savedOnly = false;

    renderAll();
    refreshJournalBookSelect();
    updateReadingStats();

    $("backupMessage").textContent =
      "Yedek geri yüklendi. PDF/EPUB dosyalarını gerekirse yeniden ekle.";
  } catch (error) {
    $("backupMessage").textContent =
      error.message || "Yedek okunamadı. Dosyanı kontrol et.";
  } finally {
    $("importBackupInput").value = "";
  }
}

/* Özellik ekranının olayları. */
installFeaturePanel();
refreshJournalBookSelect();
updateReadingStats();

$("journalBookSelect").addEventListener("change", loadSelectedJournal);

$("starRating").addEventListener("click", event => {
  const button = event.target.closest("[data-rating]");
  if (!button) return;

  selectedRating = Number(button.dataset.rating);
  updateStarButtons();
});

$("saveJournalBtn").addEventListener("click", saveSelectedJournal);

$("dailyGoalInput").addEventListener("change", event => {
  const value = Number(event.target.value);

  if (!Number.isFinite(value) || value < 1 || value > 2000) {
    event.target.value = readingSettings.dailyGoal || 20;
    return;
  }

  readingSettings.dailyGoal = Math.round(value);
  saveExtraData();
  updateDailyGoal();
});

$("exportBackupBtn").addEventListener("click", downloadBackup);

$("importBackupInput").addEventListener("change", event => {
  restoreBackup(event.target.files[0]);
});

/* Kişisel veriler silinen kitaplarla birlikte temizlensin. */
const originalDeleteBook = deleteBook;

deleteBook = async function(id) {
  await originalDeleteBook(id);

  delete journalData[id];
  completedBooks = completedBooks.filter(bookId => bookId !== id);

  saveExtraData();
  refreshJournalBookSelect();
  updateReadingStats();
};

/* Kitap ekleme veya silme sonrasında seçiciyi yenile. */
const originalRenderAll = renderAll;

renderAll = function() {
  originalRenderAll();
  refreshJournalBookSelect();
  updateReadingStats();
};

renderAll();
/* ==========================================
   SAYFA. — AYRI EKRANLAR VE MENÜ GEÇİŞLERİ
   ========================================== */

(function setupAppPages() {
  const main = $("homeScreen");
  if (!main || $("profilePanel") || $("settingsPanel")) return;

  const hero = main.querySelector(".hero");
  const continueSection = $("continueSection");
  const addSection = $("addSection");
  const catalogSection = $("bookGrid")?.closest(".section");
  const journalPanel = $("readingJournalPanel");

  // Profil ekranı
  const profilePanel = document.createElement("section");
  profilePanel.id = "profilePanel";
  profilePanel.className = "section feature-panel hidden";

  profilePanel.innerHTML = `
    <p class="eyebrow">KİŞİSEL ALANIN</p>
    <h2>Okuma profilim</h2>
    <p class="feature-small">
      Okuma yolculuğuna göz at. Her kitap kendine ayırdığın bir zaman.
    </p>

    <div class="feature-grid">
      <div class="feature-stat">
        <strong id="profileBookCount">0</strong>
        <span>Kitaplığındaki kitaplar</span>
      </div>
      <div class="feature-stat">
        <strong id="profileFavoriteCount">0</strong>
        <span>Favori kitapların</span>
      </div>
      <div class="feature-stat">
        <strong id="profileCompletedCount">0</strong>
        <span>Bitirdiğin kitaplar</span>
      </div>
      <div class="feature-stat">
        <strong id="profileRatedCount">0</strong>
        <span>Puanladığın kitaplar</span>
      </div>
    </div>

    <hr class="feature-divider">

    <h3>Okuma yolculuğun</h3>
    <p id="profileReadingSummary" class="feature-small">
      Kitaplarını okumaya başladıkça istatistiklerin burada görünecek.
    </p>

    <button id="profileJournalButton" class="primary-btn" type="button">
      Okuma günlüğüme git
    </button>
  `;

  // Ayarlar ekranı
  const settingsPanel = document.createElement("section");
  settingsPanel.id = "settingsPanel";
  settingsPanel.className = "section feature-panel hidden";

  settingsPanel.innerHTML = `
    <p class="eyebrow">SANA GÖRE DÜZENLE</p>
    <h2>Ayarlar</h2>
    <p class="feature-small">
      Sayfa. deneyimini düzenle ve kayıtlarının yedeğini güvenli bir yerde sakla.
    </p>

    <hr class="feature-divider">

    <h3>Görünüm</h3>
    <p class="feature-small">
      Açık ve koyu tema arasında geçiş yapabilirsin.
    </p>
    <div class="feature-actions">
      <button id="settingsThemeButton" class="primary-btn" type="button">
        Temayı değiştir
      </button>
    </div>

    <hr class="feature-divider">

    <div id="settingsBackupArea"></div>
  `;

  main.appendChild(profilePanel);
  main.appendChild(settingsPanel);

  // Yedekleme kontrollerini günlükten ayarlara taşı.
  // Mevcut düğmeler ve olay dinleyicileri korunur.
  const backupHeading = journalPanel
    ? [...journalPanel.querySelectorAll("h3")]
        .find(element => element.textContent.includes("Verilerini yedekle"))
    : null;

  if (backupHeading) {
    const backupDescription = backupHeading.nextElementSibling;
    const backupActions = backupDescription?.nextElementSibling;
    const backupMessage = backupActions?.nextElementSibling;
    const backupArea = $("settingsBackupArea");

    [
      backupHeading,
      backupDescription,
      backupActions,
      backupMessage
    ].forEach(element => {
      if (element) backupArea.appendChild(element);
    });
  }

  // Profil istatistiklerini güncelle.
  function updateProfile() {
    $("profileBookCount").textContent = books.length;
    $("profileFavoriteCount").textContent = favorites.length;
    $("profileCompletedCount").textContent = completedBooks.length;

    $("profileRatedCount").textContent = Object.values(journalData)
      .filter(item => Number(item.rating) > 0).length;

    const startedCount = Object.values(progress)
      .filter(item => Number(item.page || 0) > 0).length;

    $("profileReadingSummary").textContent =
      `Şimdiye kadar ${startedCount} kitapta okuma ilerlemesi kaydettin. ` +
      `${completedBooks.length} kitabı bitirdin.`;
  }

  // Bir ekrandan diğerine geç.
  function openPage(page) {
    // Varsa okuyucuyu kapatıp ana uygulama alanına dön.
    showHome();

    const visibleSections = {
      home: [hero, continueSection, catalogSection],
      library: [catalogSection, addSection],
      journal: [journalPanel],
      profile: [profilePanel],
      settings: [settingsPanel]
    };

    const allSections = [
      hero,
      continueSection,
      addSection,
      catalogSection,
      journalPanel,
      profilePanel,
      settingsPanel
    ];

    allSections.forEach(section => {
      if (section) section.classList.add("hidden");
    });

    (visibleSections[page] || visibleSections.home).forEach(section => {
      if (section) section.classList.remove("hidden");
    });

    if (page === "profile") updateProfile();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Ana sayfa: tüm kitapları göster.
  $("homeTab").addEventListener("click", () => {
    savedOnly = false;
    $("savedTab").textContent = "♡ Kitaplığım";
    renderCatalog();
    openPage("home");
  });

  // Mevcut favori filtresi korunur.
  $("savedTab").addEventListener("click", () => {
    openPage("library");
  });

  $("journalTab").addEventListener("click", () => {
    openPage("journal");
  });

  $("profileTab").addEventListener("click", () => {
    openPage("profile");
  });

  $("settingsTab").addEventListener("click", () => {
    openPage("settings");
  });

  $("profileJournalButton").addEventListener("click", () => {
    openPage("journal");
  });

  $("settingsThemeButton").addEventListener("click", () => {
    $("themeToggle").click();
  });

  // Başlangıçta ana sayfa görünür kalsın.
  openPage("home");
})();

/* ==========================================
   SAYFA. — ANA SAYFA KİTAP ALINTILARI
   Bu kodu mevcut JavaScript'in en sonuna ekle.
   ========================================== */

(function setupSayfaBookQuotes() {
  "use strict";

  const home = document.getElementById("homeScreen");
  if (!home || document.getElementById("bookQuotePanel")) return;

  const quotes = [
    {
      text: "İnsan ancak yüreğiyle baktığı zaman doğruyu görebilir.",
      book: "Küçük Prens",
      author: "Antoine de Saint-Exupéry",
      category: "Felsefe · Dostluk",
      description:
        "Sevgi, dostluk, sorumluluk ve hayata çocukların gözünden bakmak üzerine düşündüren bir klasik."
    },
    {
      text: "Bir sabah, huzursuz düşlerden uyanan Gregor Samsa...",
      book: "Dönüşüm",
      author: "Franz Kafka",
      category: "Klasik · Varoluş",
      description:
        "Bir insanın beklenmedik dönüşümü üzerinden yabancılaşmayı, aile ilişkilerini ve toplumun bireye bakışını sorgular."
    },
    {
      text: "Bütün mutlu aileler birbirine benzer; her mutsuz aile ise kendine özgüdür.",
      book: "Anna Karenina",
      author: "Lev Tolstoy",
      category: "Klasik · Psikoloji",
      description:
        "Aşk, evlilik, toplumsal beklentiler ve insanın iç çatışmaları üzerine derin bir roman."
    },
    {
      text: "Olmak ya da olmamak, işte bütün mesele bu.",
      book: "Hamlet",
      author: "William Shakespeare",
      category: "Tiyatro · Felsefe",
      description:
        "Kararsızlık, vicdan, intikam ve yaşamın anlamı üzerine edebiyatın en çok tartışılan eserlerinden biri."
    },
    {
      text: "Genel kabul gören bir gerçek şudur ki, büyük bir servete sahip bekâr bir erkek mutlaka bir eş arıyordur.",
      book: "Gurur ve Önyargı",
      author: "Jane Austen",
      category: "Klasik · Aşk",
      description:
        "Önyargılar, gurur, aile, sınıf farklılıkları ve aşk üzerine zekice gözlemler içeren bir roman."
    },
    {
      text: "Bir şeyi gerçekten istediğin zaman, bütün evren onu gerçekleştirebilmen için iş birliği yapar.",
      book: "Simyacı",
      author: "Paulo Coelho",
      category: "Roman · Kendini keşfetme",
      description:
        "Hayallerinin peşinden giden bir çobanın yolculuğu üzerinden cesaret, seçimler ve kişisel keşfi anlatır."
    },
    {
      text: "Büyük bir güce sahip olmak, büyük bir sorumluluğu da beraberinde getirir.",
      book: "Spider-Man çizgi romanları",
      author: "Stan Lee ve Steve Ditko ile ilişkilendirilen söz",
      category: "Çizgi roman · Sorumluluk",
      description:
        "Gücün yanında sorumluluk taşımanın önemini hatırlatan, popüler kültürde iz bırakmış bir ifade."
    },
    {
      text: "İnsan ne ile yaşar?",
      book: "İnsan Ne ile Yaşar?",
      author: "Lev Tolstoy",
      category: "Öykü · İnsanlık",
      description:
        "Sevgi, merhamet ve insan hayatının anlamı üzerine düşündüren klasik bir öykü."
    }
  ];

  const storageKey = "sayfaSavedBookQuotes";

  function getSavedQuotes() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function saveSavedQuotes(data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  let savedQuotes = getSavedQuotes();
  let currentIndex = Math.floor(Math.random() * quotes.length);

  const panel = document.createElement("section");
  panel.id = "bookQuotePanel";
  panel.className = "sayfa-quote-card";
  panel.setAttribute("aria-labelledby", "bookQuoteTitle");

  panel.innerHTML = `
    <div class="sayfa-quote-top">
      <div>
        <p class="sayfa-quote-eyebrow">SAYFA. · KİTAPTAN BİR İZ</p>
        <h2 id="bookQuoteTitle">Belki de sıradaki favori kitabın.</h2>
      </div>
      <span class="sayfa-quote-symbol" aria-hidden="true">“</span>
    </div>

    <p id="bookQuoteCategory" class="sayfa-quote-category"></p>

    <blockquote id="bookQuoteText" class="sayfa-quote-text"></blockquote>

    <div class="sayfa-quote-book">
      <span class="sayfa-quote-book-icon" aria-hidden="true">📖</span>
      <div>
        <p class="sayfa-quote-label">BU SÖZÜN KİTABI</p>
        <h3 id="bookQuoteBook"></h3>
        <p id="bookQuoteAuthor" class="sayfa-quote-author"></p>
      </div>
    </div>

    <p id="bookQuoteDescription" class="sayfa-quote-description"></p>

    <div class="sayfa-quote-actions">
      <button type="button" id="bookQuoteNext">Başka bir alıntı ↗</button>
      <button type="button" id="bookQuoteSave">♡ Kaydet</button>
      <button type="button" id="bookQuoteCopy">Alıntıyı kopyala</button>
      <button type="button" id="bookQuoteDiscover">Kitabı keşfet →</button>
    </div>

    <p id="bookQuoteStatus" class="sayfa-quote-status" role="status" aria-live="polite"></p>

    <p class="sayfa-quote-note">
      Not: Kitapların farklı çevirilerinde sözlerin yazımı değişebilir.
      Alıntı metinlerini yayımlamadan önce kullandığın baskıdan doğrula.
    </p>
  `;

  const style = document.createElement("style");
  style.id = "bookQuotePanelStyles";

  style.textContent = `
    #bookQuotePanel {
      margin: 24px 0;
      padding: clamp(20px, 4vw, 32px);
      border: 1px solid rgba(205, 177, 130, .28);
      border-radius: 22px;
      background: linear-gradient(135deg, #25232a, #17181e);
      color: #f3eee5;
      box-shadow: 0 12px 32px rgba(0, 0, 0, .14);
    }

    #bookQuotePanel * {
      box-sizing: border-box;
    }

    #bookQuotePanel .sayfa-quote-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 22px;
    }

    #bookQuotePanel .sayfa-quote-eyebrow {
      margin: 0 0 9px;
      color: #d5b887;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
    }

    #bookQuotePanel h2 {
      margin: 0;
      color: #f3eee5;
      font-size: clamp(20px, 3vw, 27px);
      line-height: 1.4;
      font-weight: 500;
    }

    #bookQuotePanel .sayfa-quote-symbol {
      color: #d5b887;
      font-family: Georgia, serif;
      font-size: 66px;
      line-height: .8;
    }

    #bookQuotePanel .sayfa-quote-category {
      margin: 0 0 12px;
      color: #d5b887;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    #bookQuotePanel .sayfa-quote-text {
      margin: 0 0 24px;
      padding: 0;
      border: 0;
      color: #f3eee5;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(21px, 3.5vw, 29px);
      font-style: italic;
      line-height: 1.55;
    }

    #bookQuotePanel .sayfa-quote-book {
      display: flex;
      align-items: center;
      gap: 13px;
      padding: 16px;
      border: 1px solid rgba(205, 177, 130, .2);
      border-radius: 14px;
      background: rgba(255, 255, 255, .035);
    }

    #bookQuotePanel .sayfa-quote-book-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(213, 184, 135, .12);
      font-size: 22px;
    }

    #bookQuotePanel .sayfa-quote-label {
      margin: 0 0 5px;
      color: #d5b887;
      font-size: 10px;
      letter-spacing: 1.4px;
    }

    #bookQuotePanel .sayfa-quote-book h3 {
      margin: 0;
      color: #f3eee5;
      font-size: 17px;
      line-height: 1.4;
    }

    #bookQuotePanel .sayfa-quote-author {
      margin: 4px 0 0;
      color: #c3bdc4;
      font-size: 13px;
    }

    #bookQuotePanel .sayfa-quote-description {
      margin: 17px 0 20px;
      color: #d2cdd2;
      font-size: 14px;
      line-height: 1.8;
    }

    #bookQuotePanel .sayfa-quote-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    #bookQuotePanel .sayfa-quote-actions button {
      min-height: 40px;
      padding: 10px 13px;
      border: 1px solid rgba(213, 184, 135, .3);
      border-radius: 10px;
      background: transparent;
      color: #f3eee5;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background .2s, border-color .2s;
    }

    #bookQuotePanel .sayfa-quote-actions button:hover {
      border-color: #d5b887;
      background: rgba(213, 184, 135, .1);
    }

    #bookQuotePanel #bookQuoteDiscover {
      border-color: #d5b887;
      background: #d5b887;
      color: #211a20;
      font-weight: 700;
    }

    #bookQuotePanel .sayfa-quote-status {
      min-height: 18px;
      margin: 12px 0 0;
      color: #d5b887;
      font-size: 12px;
    }

    #bookQuotePanel .sayfa-quote-note {
      margin: 12px 0 0;
      color: #a9a2ac;
      font-size: 10px;
      line-height: 1.7;
    }

    @media (max-width: 520px) {
      #bookQuotePanel {
        padding: 19px;
        border-radius: 17px;
      }

      #bookQuotePanel .sayfa-quote-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      #bookQuotePanel .sayfa-quote-actions button {
        width: 100%;
      }

      #bookQuotePanel .sayfa-quote-text {
        font-size: 22px;
      }
    }
  `;

  document.head.appendChild(style);

  const greeting = document.getElementById("homeGreeting");
  const catalog = document.getElementById("catalogSection");

  if (greeting) {
    greeting.insertAdjacentElement("afterend", panel);
  } else if (catalog) {
    home.insertBefore(panel, catalog);
  } else {
    home.appendChild(panel);
  }

  const $q = (id) => document.getElementById(id);

  function renderQuote() {
    const quote = quotes[currentIndex];

    $q("bookQuoteCategory").textContent = quote.category;
    $q("bookQuoteText").textContent = "“" + quote.text + "”";
    $q("bookQuoteBook").textContent = quote.book;
    $q("bookQuoteAuthor").textContent = quote.author;
    $q("bookQuoteDescription").textContent = quote.description;

    const isSaved = savedQuotes.some(
      (item) => item.book === quote.book && item.text === quote.text
    );

    $q("bookQuoteSave").textContent = isSaved
      ? "♥ Kaydedildi"
      : "♡ Kaydet";

    $q("bookQuoteStatus").textContent = "";
  }

  $q("bookQuoteNext").addEventListener("click", () => {
    if (quotes.length < 2) return;

    let nextIndex = currentIndex;

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * quotes.length);
    }

    currentIndex = nextIndex;
    renderQuote();
  });

  $q("bookQuoteSave").addEventListener("click", () => {
    const quote = quotes[currentIndex];
    const existingIndex = savedQuotes.findIndex(
      (item) => item.book === quote.book && item.text === quote.text
    );

    if (existingIndex >= 0) {
      savedQuotes.splice(existingIndex, 1);
      $q("bookQuoteStatus").textContent = "Alıntı kayıtlarından kaldırıldı.";
    } else {
      savedQuotes.push({
        text: quote.text,
        book: quote.book,
        author: quote.author,
        category: quote.category
      });

      $q("bookQuoteStatus").textContent = "Alıntı bu tarayıcıya kaydedildi. 🤎";
    }

    if (!saveSavedQuotes(savedQuotes)) {
      $q("bookQuoteStatus").textContent =
        "Kayıt yapılamadı. Tarayıcı depolama alanını kontrol et.";
      savedQuotes = getSavedQuotes();
    }

    renderQuote();
  });

  $q("bookQuoteCopy").addEventListener("click", async () => {
    const quote = quotes[currentIndex];
    const textToCopy =
      "“" + quote.text + "”\n— " + quote.book + ", " + quote.author;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) throw new Error("Kopyalama başarısız.");
      }

      $q("bookQuoteStatus").textContent = "Alıntı ve kitap bilgisi kopyalandı.";
    } catch (error) {
      $q("bookQuoteStatus").textContent =
        "Kopyalama desteklenmedi. Metni seçerek kopyalayabilirsin.";
    }
  });

  $q("bookQuoteDiscover").addEventListener("click", () => {
    const quote = quotes[currentIndex];
    const search = document.getElementById("searchInput");

    if (search) {
      search.value = quote.book;
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (catalog) {
      catalog.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    $q("bookQuoteStatus").textContent =
      "Kitaplığında aranıyor. Kitap bulunamazsa adını arama alanından keşfedebilirsin.";
  });

  /*
   * Alıntı kartını yalnızca ana sayfada göster.
   * Diğer sekmelerin mevcut işleyişini değiştirme.
   */
  function updateQuoteVisibility(page) {
    panel.classList.toggle("hidden", page !== "home");
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest(
      "#homeTab, #savedTab, #journalTab, #profileTab, #settingsTab, " +
      "[data-go-page], #profileJournalButton, #homeGoalJournalButton"
    );

    if (!target) return;

    const page = target.dataset.goPage;

    if (target.id === "homeTab" || page === "home") {
      updateQuoteVisibility("home");
    } else {
      updateQuoteVisibility("other");
    }
  });

  updateQuoteVisibility("home");
  renderQuote();
})();


/* ==========================================
   SAYFA. — KİŞİSEL PROFİL GELİŞTİRMESİ
   Mevcut uygulamaya ek kod
   ========================================== */

(function enhanceSayfaProfile() {
  const panel = $("profilePanel");
  if (!panel || panel.dataset.profileEnhanced === "true") return;

  panel.dataset.profileEnhanced = "true";

  const PROFILE_KEY = "sayfaPersonalProfile";

  let profile = readStorage(PROFILE_KEY, {
    name: "",
    bio: "",
    photo: ""
  });

  function saveProfile() {
    return writeStorage(PROFILE_KEY, profile);
  }

  function initials(name) {
    return name.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toLocaleUpperCase("tr-TR"))
      .join("") || "S.";
  }

  // Kişisel profil kartı
  const identity = document.createElement("div");
  identity.className = "profile-identity";

  identity.innerHTML = `
    <div class="profile-avatar-wrap">
      <div class="profile-avatar" id="personalProfileAvatar"
           aria-label="Profil fotoğrafı"></div>
    </div>
    <div class="profile-identity-content">
      <p class="eyebrow">BENİM OKUMA DÜNYAM</p>
      <h2 id="personalProfileName"></h2>
      <p id="personalProfileBio"></p>
    </div>
  `;

  panel.insertBefore(identity, panel.firstChild);

  // Profil düzenleme alanı
  const editor = document.createElement("form");
  editor.id = "personalProfileForm";
  editor.className = "profile-edit-form";

  editor.innerHTML = `
    <h3>Profilini düzenle</h3>

    <label>
      Kullanıcı adı
      <input id="personalProfileNameInput"
        type="text" maxlength="40"
        placeholder="Nasıl hitap edelim?">
    </label>

    <label>
      Kısa biyografin
      <textarea id="personalProfileBioInput"
        maxlength="240"
        placeholder="Kitaplar, hayaller ve sen..."></textarea>
    </label>

    <label class="profile-photo-label">
      📷 Galeriden fotoğraf seç
      <input id="personalProfilePhotoInput"
        type="file" accept="image/*">
    </label>

    <button class="primary-btn" type="submit">
      Profilimi kaydet
    </button>

    <p id="personalProfileMessage"
       class="profile-message" role="status"></p>
  `;

  identity.insertAdjacentElement("afterend", editor);

  // Profildeki kitap listeleri
  const extras = document.createElement("div");
  extras.id = "personalProfileExtras";

  extras.innerHTML = `
    <section class="profile-extra-section">
      <h3>♡ Favori kitaplarım</h3>
      <div id="profileFavoriteBooks" class="profile-extra-list"></div>
    </section>

    <section class="profile-extra-section">
      <h3>★ En yüksek puan verdiklerim</h3>
      <div id="profileTopRatedBooks" class="profile-extra-list"></div>
    </section>

    <section class="profile-extra-section">
      <h3>◷ Son okuduklarım</h3>
      <div id="profileRecentBooks" class="profile-extra-list"></div>
    </section>

    <section class="profile-extra-section">
      <h3>✧ Okuma başarılarım</h3>
      <div id="profileAchievements" class="profile-extra-list"></div>
    </section>
  `;

  const journalButton = $("profileJournalButton");

  if (journalButton) {
    journalButton.insertAdjacentElement("afterend", extras);
  } else {
    panel.appendChild(extras);
  }

  function renderIdentity() {
    $("personalProfileName").textContent =
      profile.name || "Kitap dostu";

    $("personalProfileBio").textContent =
      profile.bio || "Her kitap yeni bir yolculuk.";

    $("personalProfileNameInput").value = profile.name || "";
    $("personalProfileBioInput").value = profile.bio || "";

    const avatar = $("personalProfileAvatar");
    avatar.replaceChildren();

    if (profile.photo) {
      const image = document.createElement("img");
      image.src = profile.photo;
      image.alt = "Profil fotoğrafı";
      avatar.appendChild(image);
    } else {
      avatar.textContent = initials(profile.name || "Sayfa");
    }
  }

  function bookItem(book, subtitle, emoji = "📚") {
    const item = document.createElement("div");
    item.className = "profile-extra-item";

    const icon = document.createElement("span");
    icon.className = "profile-item-emoji";
    icon.textContent = emoji;

    const copy = document.createElement("div");
    copy.className = "profile-item-copy";

    const title = document.createElement("strong");
    title.textContent = book.title || "İsimsiz kitap";

    const detail = document.createElement("small");
    detail.textContent = subtitle || book.author || "";

    copy.append(title, detail);
    item.append(icon, copy);

    return item;
  }

  function renderBookList(containerId, list, emptyText, getSubtitle, emoji) {
    const container = $(containerId);
    if (!container) return;

    container.replaceChildren();

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "profile-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    list.forEach(book => {
      container.appendChild(
        bookItem(book, getSubtitle(book), emoji(book))
      );
    });
  }

  function renderAchievements() {
    const container = $("profileAchievements");
    if (!container) return;

    const today = typeof getTodayData === "function"
      ? getTodayData()
      : { pages: 0 };

    const goal = Math.max(
      1,
      Number(readingSettings?.dailyGoal || 20)
    );

    const achievements = [
      {
        icon: "📖",
        title: "İlk adım",
        detail: "Bir kitapta okuma ilerlemesi kaydet.",
        unlocked: Object.values(progress).some(
          item => Number(item.page || 0) > 0 ||
                  Number(item.percent || 0) > 0
        )
      },
      {
        icon: "🏆",
        title: "Kitap bitiren",
        detail: "İlk kitabını tamamlandı olarak işaretle.",
        unlocked: completedBooks.length > 0
      },
      {
        icon: "💜",
        title: "Kitap seçkisi",
        detail: "İlk kitabını favorilerine ekle.",
        unlocked: favorites.length > 0
      },
      {
        icon: "⭐",
        title: "Kitap eleştirmeni",
        detail: "Bir kitaba yıldız puanı ver.",
        unlocked: Object.values(journalData).some(
          item => Number(item.rating) > 0
        )
      },
      {
        icon: "🌙",
        title: "Günlük hedef",
        detail: "Günlük sayfa hedefine ulaş.",
        unlocked: Number(today.pages || 0) >= goal
      }
    ];

    container.replaceChildren();

    achievements.forEach(achievement => {
      const item = document.createElement("div");
      item.className =
        "profile-achievement " +
        (achievement.unlocked ? "unlocked" : "locked");

      const icon = document.createElement("span");
      icon.className = "achievement-icon";
      icon.textContent = achievement.unlocked
        ? achievement.icon
        : "🔒";

      const copy = document.createElement("div");
      copy.className = "profile-item-copy";

      const title = document.createElement("strong");
      title.textContent = achievement.title;

      const detail = document.createElement("small");
      detail.textContent = achievement.unlocked
        ? "Başarı kazanıldı!"
        : achievement.detail;

      copy.append(title, detail);
      item.append(icon, copy);
      container.appendChild(item);
    });
  }

  function renderProfileExtras() {
    if (!$("profileFavoriteBooks")) return;

    const favoriteBooks = books.filter(
      book => favorites.includes(book.id)
    );

    renderBookList(
      "profileFavoriteBooks",
      favoriteBooks.slice(0, 5),
      "Henüz favori kitabın yok. Kitap kartındaki kalbe dokunabilirsin.",
      book => book.author || "Yazar belirtilmemiş",
      book => book.emoji || "💜"
    );

    const topRated = books
      .filter(book => Number(journalData[book.id]?.rating) > 0)
      .sort((a, b) =>
        Number(journalData[b.id].rating) -
        Number(journalData[a.id].rating)
      )
      .slice(0, 5);

    renderBookList(
      "profileTopRatedBooks",
      topRated,
      "Kitap günlüğünden kitaplarına puan verdiğinde burada görünecek.",
      book => `${journalData[book.id].rating} / 5 yıldız · ${book.author}`,
      () => "⭐"
    );

    const recent = books
      .filter(book => progress[book.id])
      .sort((a, b) =>
        Number(progress[b.id].updatedAt || 0) -
        Number(progress[a.id].updatedAt || 0)
      )
      .slice(0, 5);

    renderBookList(
      "profileRecentBooks",
      recent,
      "Okumaya başladığın kitaplar burada görünecek.",
      book => {
        const percent = getProgressPercent(book);
        return `${book.author} · %${percent} tamamlandı`;
      },
      book => book.emoji || "📖"
    );

    renderAchievements();
  }

  // Fotoğrafı küçültüp depolama alanını koru.
  $("personalProfilePhotoInput").addEventListener(
    "change",
    event => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        $("personalProfileMessage").textContent =
          "Lütfen bir görsel dosyası seç.";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        $("personalProfileMessage").textContent =
          "Fotoğraf 10 MB sınırını aşıyor. Daha küçük bir görsel seç.";
        event.target.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const maxSize = 480;
          const ratio = Math.min(
            1,
            maxSize / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));

          const context = canvas.getContext("2d");
          if (!context) {
            $("personalProfileMessage").textContent =
              "Fotoğraf işlenemedi. Başka bir görsel dene.";
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          const previousPhoto = profile.photo;
          profile.photo = canvas.toDataURL("image/jpeg", 0.78);

          if (!saveProfile()) {
            profile.photo = previousPhoto;
            $("personalProfileMessage").textContent =
              "Fotoğraf kaydedilemedi. Daha küçük bir görsel dene.";
            return;
          }

          renderIdentity();
          $("personalProfileMessage").textContent =
            "Profil fotoğrafın kaydedildi. 🤎";
        };

        image.onerror = () => {
          $("personalProfileMessage").textContent =
            "Bu fotoğraf açılamadı. Başka bir görsel dene.";
        };

        image.src = reader.result;
      };

      reader.onerror = () => {
        $("personalProfileMessage").textContent =
          "Fotoğraf okunamadı. Tekrar deneyebilirsin.";
      };

      reader.readAsDataURL(file);
    }
  );

  editor.addEventListener("submit", event => {
    event.preventDefault();

    const previous = { ...profile };

    profile.name = $("personalProfileNameInput").value.trim();
    profile.bio = $("personalProfileBioInput").value.trim();

    if (!saveProfile()) {
      profile = previous;
      $("personalProfileMessage").textContent =
        "Profil kaydedilemedi. Tarayıcı depolama alanını kontrol et.";
      return;
    }

    renderIdentity();
    $("personalProfileMessage").textContent =
      "Profil bilgilerin kaydedildi. 🤎";
  });

  // Profil ekranı açıldığında listeleri güncelle.
  $("profileTab")?.addEventListener("click", renderProfileExtras);
  $("saveJournalBtn")?.addEventListener("click", renderProfileExtras);

  // Kitap ekleme, ilerleme ve favori değişikliklerini yansıt.
  const previousRenderAll = renderAll;

  renderAll = function() {
    previousRenderAll();
    renderProfileExtras();
  };

  const previousSaveProgress = saveCurrentProgress;

  saveCurrentProgress = function(extra = {}) {
    previousSaveProgress(extra);
    renderProfileExtras();
  };

  renderIdentity();
  renderProfileExtras();
})();


/* =========================================
   SAYFA. | AYARLAR > GÖRÜNÜM
   ========================================= */
(function () {
  "use strict";

  if (document.getElementById("sayfa-view-settings")) return;

  var KEY = "sayfaAppearanceSettings";
  var defaults = {
    fontSize: "medium",
    accent: "pink"
  };

  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch (e) {
    saved = {};
  }

  var settings = {
    fontSize: ["small", "medium", "large"].includes(saved.fontSize)
      ? saved.fontSize : defaults.fontSize,
    accent: ["pink", "purple", "blue", "green"].includes(saved.accent)
      ? saved.accent : defaults.accent
  };

  var colors = {
    pink: "#d99ac7",
    purple: "#b69ae8",
    blue: "#88bce8",
    green: "#8dc9a7"
  };

  var css = document.createElement("style");
  css.id = "sayfa-view-settings-css";
  css.textContent = `
    #sayfa-view-settings {
      background: #211c27;
      color: #f4edf6;
      border: 1px solid #493a50;
      border-radius: 16px;
      padding: 20px;
      margin: 20px 0;
      width: 100%;
      box-sizing: border-box;
    }

    #sayfa-view-settings * { box-sizing: border-box; }

    #sayfa-view-settings h3 {
      margin: 0 0 8px;
      font-size: 20px;
    }

    #sayfa-view-settings .sayfa-hint {
      color: #c5b7cc;
      font-size: 13px;
      line-height: 1.6;
      margin: 0 0 18px;
    }

    #sayfa-view-settings .sayfa-option {
      padding: 16px 0;
      border-top: 1px solid #45364b;
    }

    #sayfa-view-settings label {
      display: block;
      margin-bottom: 9px;
      font-weight: 600;
    }

    #sayfa-view-settings select {
      display: block;
      width: 100%;
      min-height: 44px;
      padding: 10px;
      border: 1px solid #65516b;
      border-radius: 9px;
      background: #302735;
      color: #fff;
      font: inherit;
    }

    #sayfa-view-settings .sayfa-colors {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    #sayfa-view-settings .sayfa-color {
      width: 38px;
      height: 38px;
      border: 3px solid #211c27;
      border-radius: 50%;
      cursor: pointer;
      outline: 1px solid #76617e;
    }

    #sayfa-view-settings .sayfa-color[aria-pressed="true"] {
      outline: 2px solid white;
      outline-offset: 2px;
    }

    #sayfa-view-settings .sayfa-save-status {
      color: #e5b8d9;
      font-size: 13px;
      min-height: 20px;
      margin-top: 12px;
    }

    #sayfa-view-settings .sayfa-reset {
      background: transparent;
      color: #f4edf6;
      border: 1px solid #806287;
      border-radius: 9px;
      padding: 10px 14px;
      cursor: pointer;
      font: inherit;
    }

    body.sayfa-font-small { --sayfa-user-font: 14px; }
    body.sayfa-font-medium { --sayfa-user-font: 16px; }
    body.sayfa-font-large { --sayfa-user-font: 18px; }

    #sayfa-view-settings .sayfa-font-demo {
      color: var(--sayfa-user-accent, #d99ac7);
      font-size: var(--sayfa-user-font, 16px);
      margin-top: 10px;
    }
  `;
  document.head.appendChild(css);

  var panel = document.createElement("section");
  panel.id = "sayfa-view-settings";
  panel.innerHTML = `
    <h3>Görünüm ve kişiselleştirme</h3>
    <p class="sayfa-hint">
      Uygulamanın görünümünü kendine göre düzenle.
      Gece teması korunur; seçimlerin bu tarayıcıda saklanır.
    </p>

    <div class="sayfa-option">
      <label for="sayfa-font-choice">Yazı boyutu</label>
      <select id="sayfa-font-choice">
        <option value="small">Küçük</option>
        <option value="medium">Orta</option>
        <option value="large">Büyük</option>
      </select>
      <div class="sayfa-font-demo">Örnek metin — Kitaplığım</div>
    </div>

    <div class="sayfa-option">
      <label>Vurgu rengi</label>
      <div class="sayfa-colors">
        <button class="sayfa-color" type="button"
          data-color="pink" aria-label="Pembe"
          style="background:#d99ac7"></button>
        <button class="sayfa-color" type="button"
          data-color="purple" aria-label="Mor"
          style="background:#b69ae8"></button>
        <button class="sayfa-color" type="button"
          data-color="blue" aria-label="Mavi"
          style="background:#88bce8"></button>
        <button class="sayfa-color" type="button"
          data-color="green" aria-label="Yeşil"
          style="background:#8dc9a7"></button>
      </div>
    </div>

    <div class="sayfa-option">
      <button class="sayfa-reset" id="sayfa-view-reset" type="button">
        Görünüm ayarlarını sıfırla
      </button>
      <div class="sayfa-save-status" id="sayfa-view-status"
        role="status" aria-live="polite"></div>
    </div>
  `;

  var settingsScreen =
    document.getElementById("settingsScreen") ||
    document.querySelector('[data-screen="settings"]') ||
    document.querySelector(".settings-screen");

  var app = document.querySelector(".app") || document.body;

  if (settingsScreen) {
    settingsScreen.appendChild(panel);
  } else {
    // Ayarlar ekranı tanınmazsa yanlış yere gizlice eklemek yerine
    // uygulamanın sonuna görünür bir bölüm ekle.
    app.appendChild(panel);
  }

  var fontSelect = panel.querySelector("#sayfa-font-choice");
  var status = panel.querySelector("#sayfa-view-status");
  var demo = panel.querySelector(".sayfa-font-demo");

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      status.textContent = "Ayarların kaydedildi.";
    } catch (error) {
      status.textContent = "Kaydedilemedi. Tarayıcı depolamasını kontrol et.";
    }
  }

  function apply() {
    document.body.classList.remove(
      "sayfa-font-small",
      "sayfa-font-medium",
      "sayfa-font-large"
    );
    document.body.classList.add("sayfa-font-" + settings.fontSize);

    var color = colors[settings.accent] || colors.pink;
    panel.style.setProperty("--sayfa-user-accent", color);
    demo.style.color = color;
    fontSelect.value = settings.fontSize;

    panel.querySelectorAll("[data-color]").forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.color === settings.accent)
      );
    });
  }

  fontSelect.addEventListener("change", function () {
    settings.fontSize = fontSelect.value;
    apply();
    save();
  });

  panel.querySelectorAll("[data-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      settings.accent = button.dataset.color;
      apply();
      save();
    });
  });

  panel.querySelector("#sayfa-view-reset").addEventListener("click", function () {
    settings = {
      fontSize: defaults.fontSize,
      accent: defaults.accent
    };
    apply();
    save();
  });

  apply();
})();


/* SAYFA. — OKUMA AYARLARI VE HEDEFLER */
(() => {
  "use strict";

  const SETTINGS_KEY = "sayfaReadingSettings";
  const EXTENSION_ID = "sayfa-reading-goals-extension";

  const defaults = {
    dailyMinutes: 30,
    dailyPages: 20,
    reminderTime: "21:00"
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        dailyMinutes: Number(saved.dailyMinutes) || defaults.dailyMinutes,
        dailyPages: Number(saved.dailyPages) || defaults.dailyPages,
        reminderTime: saved.reminderTime || defaults.reminderTime
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function findSettingsScreen() {
    return document.getElementById("settingsScreen")
      || document.querySelector('[data-screen="settings"]')
      || document.querySelector(".settings-screen");
  }

  function createExtension() {
    let panel = document.getElementById(EXTENSION_ID);
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = EXTENSION_ID;
    panel.className = "sayfa-reading-goals";
    panel.innerHTML = `
      <div class="sayfa-goals-heading">
        <span class="sayfa-goals-icon">📖</span>
        <div>
          <h2>Okuma Ayarları ve Hedefler</h2>
          <p>Kendi okuma düzenini oluştur</p>
        </div>
      </div>

      <div class="sayfa-goals-card">
        <label for="sayfaDailyMinutes">Günlük okuma hedefi (dakika)</label>
        <input id="sayfaDailyMinutes" type="number" min="1" max="1440" step="1">

        <label for="sayfaDailyPages">Günlük sayfa hedefi</label>
        <input id="sayfaDailyPages" type="number" min="1" max="5000" step="1">

        <label for="sayfaReminderTime">Hatırlatma saati tercihi</label>
        <input id="sayfaReminderTime" type="time">

        <button type="button" id="sayfaSaveReadingGoals">
          Ayarları Kaydet
        </button>
        <p id="sayfaGoalsStatus" role="status" aria-live="polite"></p>
      </div>

      <div class="sayfa-goals-card">
        <h3>🎯 Günlük hedefin</h3>
        <p id="sayfaGoalSummary"></p>
        <p class="sayfa-goals-note">
          Okuma süresi ve sayfa ilerlemesi, uygulamanın mevcut okuma takibiyle
          bağlantı kurulana kadar hedef tercihlerine göre gösterilir.
        </p>
      </div>
    `;

    const styles = document.createElement("style");
    styles.id = "sayfa-reading-goals-styles";
    styles.textContent = `
      #${EXTENSION_ID} {
        color: inherit;
        padding: 18px;
        margin: 16px 0;
        border: 1px solid rgba(220, 160, 195, .25);
        border-radius: 18px;
        background: rgba(255, 255, 255, .035);
        box-sizing: border-box;
        width: 100%;
      }

      #${EXTENSION_ID} * {
        box-sizing: border-box;
      }

      #${EXTENSION_ID} .sayfa-goals-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
      }

      #${EXTENSION_ID} .sayfa-goals-icon {
        font-size: 30px;
      }

      #${EXTENSION_ID} h2 {
        font-size: 19px;
        margin: 0 0 5px;
      }

      #${EXTENSION_ID} h3 {
        font-size: 16px;
        margin: 0 0 12px;
      }

      #${EXTENSION_ID} .sayfa-goals-heading p,
      #${EXTENSION_ID} .sayfa-goals-note {
        opacity: .72;
        font-size: 13px;
        margin: 0;
        line-height: 1.5;
      }

      #${EXTENSION_ID} .sayfa-goals-card {
        padding: 16px;
        margin-top: 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, .035);
        border: 1px solid rgba(220, 160, 195, .15);
      }

      #${EXTENSION_ID} label {
        display: block;
        font-size: 14px;
        margin: 14px 0 7px;
      }

      #${EXTENSION_ID} input {
        display: block;
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid rgba(220, 160, 195, .35);
        border-radius: 10px;
        background: rgba(0, 0, 0, .18);
        color: inherit;
        font: inherit;
      }

      #${EXTENSION_ID} button {
        width: 100%;
        min-height: 46px;
        margin-top: 18px;
        border: 0;
        border-radius: 12px;
        background: #d99abb;
        color: #241723;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      #${EXTENSION_ID} #sayfaGoalsStatus {
        min-height: 18px;
        font-size: 13px;
        margin: 10px 0 0;
      }
    `;

    if (!document.getElementById(styles.id)) {
      document.head.appendChild(styles);
    }

    const settingsScreen = findSettingsScreen();

    if (settingsScreen) {
      settingsScreen.appendChild(panel);
    } else {
      const appRoot = document.querySelector(".app")
        || document.querySelector("#app")
        || document.querySelector("main");

      if (appRoot) {
        appRoot.appendChild(panel);
      } else {
        document.body.appendChild(panel);
      }

      console.warn(
        "SAYFA.: Ayarlar ekranı bulunamadı. Okuma ayarları paneli uygulamanın sonuna eklendi."
      );
    }

    return panel;
  }

  function initialize() {
    const panel = createExtension();
    const settings = loadSettings();

    const minutesInput = panel.querySelector("#sayfaDailyMinutes");
    const pagesInput = panel.querySelector("#sayfaDailyPages");
    const reminderInput = panel.querySelector("#sayfaReminderTime");
    const saveButton = panel.querySelector("#sayfaSaveReadingGoals");
    const status = panel.querySelector("#sayfaGoalsStatus");
    const summary = panel.querySelector("#sayfaGoalSummary");

    minutesInput.value = settings.dailyMinutes;
    pagesInput.value = settings.dailyPages;
    reminderInput.value = settings.reminderTime;

    function updateSummary() {
      summary.textContent =
        `Günlük hedefin: ${minutesInput.value || 30} dakika ve ` +
        `${pagesInput.value || 20} sayfa. Hatırlatma tercihin: ` +
        `${reminderInput.value || "21:00"}.`;
    }

    updateSummary();

    saveButton.addEventListener("click", () => {
      const dailyMinutes = Number(minutesInput.value);
      const dailyPages = Number(pagesInput.value);
      const reminderTime = reminderInput.value;

      if (
        !Number.isInteger(dailyMinutes) ||
        dailyMinutes < 1 ||
        dailyMinutes > 1440
      ) {
        status.textContent = "Dakika hedefi 1 ile 1440 arasında olmalı.";
        minutesInput.focus();
        return;
      }

      if (
        !Number.isInteger(dailyPages) ||
        dailyPages < 1 ||
        dailyPages > 5000
      ) {
        status.textContent = "Sayfa hedefi 1 ile 5000 arasında olmalı.";
        pagesInput.focus();
        return;
      }

      const updated = {
        dailyMinutes,
        dailyPages,
        reminderTime: reminderTime || defaults.reminderTime
      };

      try {
        saveSettings(updated);
        status.textContent = "Ayarların kaydedildi 💗";
        updateSummary();
      } catch (error) {
        console.error("SAYFA. okuma ayarları kaydedilemedi:", error);
        status.textContent = "Kaydedilemedi. Tarayıcı depolama alanını kontrol et.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();


/* SAYFA. — BİLDİRİM VE HATIRLATICILAR */
(() => {
  "use strict";

  const PANEL_ID = "sayfa-notifications-extension";
  const STORAGE_KEY = "sayfaNotificationSettings";

  const defaults = {
    enabled: false,
    time: "21:00",
    dailyReminder: true,
    goalReminder: true
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        enabled: saved.enabled === true,
        time: /^\d{2}:\d{2}$/.test(saved.time || "")
          ? saved.time
          : defaults.time,
        dailyReminder: saved.dailyReminder !== false,
        goalReminder: saved.goalReminder !== false
      };
    } catch {
      return { ...defaults };
    }
  }

  function findSettingsScreen() {
    return document.getElementById("settingsScreen")
      || document.querySelector('[data-screen="settings"]')
      || document.querySelector(".settings-screen");
  }

  function addStyles() {
    if (document.getElementById("sayfa-notifications-styles")) return;

    const style = document.createElement("style");
    style.id = "sayfa-notifications-styles";
    style.textContent = `
      #${PANEL_ID} {
        box-sizing: border-box;
        width: 100%;
        padding: 18px;
        margin: 16px 0;
        border: 1px solid rgba(220,160,195,.25);
        border-radius: 18px;
        color: inherit;
        background: rgba(255,255,255,.035);
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .sayfa-notif-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      #${PANEL_ID} .sayfa-notif-icon { font-size: 29px; }
      #${PANEL_ID} h2 { margin: 0 0 5px; font-size: 19px; }
      #${PANEL_ID} h3 { margin: 0 0 10px; font-size: 16px; }
      #${PANEL_ID} p {
        font-size: 13px;
        line-height: 1.55;
        opacity: .8;
      }
      #${PANEL_ID} .sayfa-notif-card {
        padding: 15px;
        margin-top: 12px;
        border-radius: 14px;
        border: 1px solid rgba(220,160,195,.15);
        background: rgba(255,255,255,.025);
      }
      #${PANEL_ID} .sayfa-notif-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid rgba(220,160,195,.12);
      }
      #${PANEL_ID} .sayfa-notif-row:last-child { border-bottom: 0; }
      #${PANEL_ID} .sayfa-notif-row label { font-size: 14px; }
      #${PANEL_ID} input[type="checkbox"] {
        width: 20px;
        height: 20px;
        accent-color: #d99abb;
        flex-shrink: 0;
      }
      #${PANEL_ID} input[type="time"] {
        min-height: 40px;
        padding: 7px;
        border-radius: 9px;
        border: 1px solid rgba(220,160,195,.35);
        background: rgba(0,0,0,.18);
        color: inherit;
      }
      #${PANEL_ID} button {
        width: 100%;
        min-height: 44px;
        margin-top: 12px;
        padding: 10px;
        border: 0;
        border-radius: 11px;
        background: #d99abb;
        color: #241723;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      #${PANEL_ID} #sayfaNotifStatus {
        min-height: 18px;
        margin-bottom: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function initialize() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return;

    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="sayfa-notif-heading">
        <span class="sayfa-notif-icon">🔔</span>
        <div>
          <h2>Bildirim ve Hatırlatıcılar</h2>
          <p>Okuma rutinini kendine göre düzenle</p>
        </div>
      </div>

      <div class="sayfa-notif-card">
        <div class="sayfa-notif-row">
          <label for="sayfaNotifEnabled">Hatırlatıcıları etkinleştir</label>
          <input id="sayfaNotifEnabled" type="checkbox">
        </div>
        <div class="sayfa-notif-row">
          <label for="sayfaNotifDaily">Günlük okuma hatırlatması</label>
          <input id="sayfaNotifDaily" type="checkbox">
        </div>
        <div class="sayfa-notif-row">
          <label for="sayfaNotifGoal">Hedef hatırlatması</label>
          <input id="sayfaNotifGoal" type="checkbox">
        </div>
        <div class="sayfa-notif-row">
          <label for="sayfaNotifTime">Hatırlatma saati</label>
          <input id="sayfaNotifTime" type="time">
        </div>
        <button type="button" id="sayfaNotifSave">Tercihleri Kaydet</button>
        <button type="button" id="sayfaNotifTest">Test Bildirimi Gönder</button>
        <p id="sayfaNotifStatus" role="status" aria-live="polite"></p>
      </div>

      <div class="sayfa-notif-card">
        <h3>Bilmen gerekenler</h3>
        <p>Bildirim göndermek için tarayıcı izni gerekir. Bu panel tercihlerini kaydeder ve test bildirimi göndermeyi dener. Düzenli saatte otomatik bildirim için uygulamanın açık kalması ve ek zamanlama kodu gerekir.</p>
      </div>
    `;

    addStyles();

    const settingsScreen =
      document.getElementById("settingsScreen")
      || document.querySelector('[data-screen="settings"]')
      || document.querySelector(".settings-screen");

    const appRoot = document.querySelector(".app")
      || document.querySelector("#app")
      || document.querySelector("main");

    (settingsScreen || appRoot || document.body).appendChild(panel);

    const enabled = panel.querySelector("#sayfaNotifEnabled");
    const daily = panel.querySelector("#sayfaNotifDaily");
    const goal = panel.querySelector("#sayfaNotifGoal");
    const time = panel.querySelector("#sayfaNotifTime");
    const status = panel.querySelector("#sayfaNotifStatus");

    function applySettings(settings) {
      enabled.checked = settings.enabled;
      daily.checked = settings.dailyReminder;
      goal.checked = settings.goalReminder;
      time.value = settings.time;
    }

    function getSettings() {
      return {
        enabled: enabled.checked,
        dailyReminder: daily.checked,
        goalReminder: goal.checked,
        time: time.value || defaults.time
      };
    }

    applySettings(loadSettings());

    panel.querySelector("#sayfaNotifSave").addEventListener("click", () => {
      const settings = getSettings();

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        status.textContent = "Bildirim tercihlerin kaydedildi 💗";

        if (settings.enabled && !("Notification" in window)) {
          status.textContent =
            "Tercihler kaydedildi ancak bu tarayıcı bildirimleri desteklemiyor.";
        } else if (
          settings.enabled &&
          Notification.permission === "denied"
        ) {
          status.textContent =
            "Tercihler kaydedildi. Bildirim izni tarayıcı ayarlarından engellenmiş.";
        }
      } catch (error) {
        console.error("SAYFA. bildirim ayarları kaydedilemedi:", error);
        status.textContent = "Kaydedilemedi. Tarayıcı depolama ayarlarını kontrol et.";
      }
    });

    panel.querySelector("#sayfaNotifTest").addEventListener("click", async () => {
      if (!("Notification" in window)) {
        status.textContent = "Bu tarayıcı bildirim özelliğini desteklemiyor.";
        return;
      }

      if (!window.isSecureContext) {
        status.textContent =
          "Bildirim için güvenli bağlantı gerekir. CodePen'in HTTPS önizlemesini kullan.";
        return;
      }

      try {
        let permission = Notification.permission;

        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
          status.textContent =
            "Bildirim izni verilmedi. Tarayıcı izinlerini kontrol et.";
          return;
        }

        new Notification("SAYFA. 📖", {
          body: "Kendine ayırdığın birkaç dakika bile değerlidir. Okuma zamanı!",
          tag: "sayfa-test-notification"
        });

        status.textContent = "Test bildirimi gönderildi 💗";
      } catch (error) {
        console.error("SAYFA. test bildirimi başarısız:", error);
        status.textContent = "Bildirim gönderilemedi. Tarayıcı izinlerini kontrol et.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();


/* SAYFA. — OKUMA DENEYİMİ VE KİTAP TAKİBİ */
(() => {
  "use strict";

  const PANEL_ID = "sayfa-reading-tracker";
  const STORAGE_KEY = "sayfaReadingTrackerV1";

  const defaults = {
    books: {},
    history: []
  };

  function loadData() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        books: data.books && typeof data.books === "object" ? data.books : {},
        history: Array.isArray(data.history) ? data.history : []
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function findSettingsScreen() {
    return document.getElementById("settingsScreen")
      || document.querySelector('[data-screen="settings"]')
      || document.querySelector(".settings-screen");
  }

  function addStyles() {
    if (document.getElementById("sayfa-tracker-styles")) return;

    const style = document.createElement("style");
    style.id = "sayfa-tracker-styles";
    style.textContent = `
      #${PANEL_ID} {
        width: 100%;
        box-sizing: border-box;
        padding: 18px;
        margin: 16px 0;
        border: 1px solid rgba(220,160,195,.25);
        border-radius: 18px;
        color: inherit;
        background: rgba(255,255,255,.035);
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} h2 { font-size: 19px; margin: 0 0 7px; }
      #${PANEL_ID} h3 { font-size: 16px; margin: 0 0 12px; }
      #${PANEL_ID} p { font-size: 13px; line-height: 1.5; }
      #${PANEL_ID} .sayfa-tracker-card {
        padding: 15px;
        margin-top: 13px;
        border: 1px solid rgba(220,160,195,.15);
        border-radius: 14px;
        background: rgba(255,255,255,.025);
      }
      #${PANEL_ID} label {
        display: block;
        margin: 12px 0 6px;
        font-size: 14px;
      }
      #${PANEL_ID} input,
      #${PANEL_ID} select {
        width: 100%;
        min-height: 42px;
        padding: 9px 11px;
        border: 1px solid rgba(220,160,195,.3);
        border-radius: 10px;
        color: inherit;
        background: rgba(0,0,0,.18);
        font: inherit;
      }
      #${PANEL_ID} button {
        min-height: 42px;
        padding: 9px 12px;
        border: 0;
        border-radius: 10px;
        background: #d99abb;
        color: #241723;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      #${PANEL_ID} .sayfa-tracker-primary {
        width: 100%;
        margin-top: 15px;
      }
      #${PANEL_ID} .sayfa-tracker-book {
        padding: 13px 0;
        border-bottom: 1px solid rgba(220,160,195,.14);
      }
      #${PANEL_ID} .sayfa-tracker-book:last-child { border-bottom: 0; }
      #${PANEL_ID} .sayfa-tracker-book-title {
        font-weight: 700;
        margin-bottom: 7px;
      }
      #${PANEL_ID} .sayfa-tracker-meta {
        opacity: .75;
        font-size: 13px;
        margin: 5px 0;
      }
      #${PANEL_ID} .sayfa-tracker-progress {
        height: 7px;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(255,255,255,.12);
        margin: 9px 0;
      }
      #${PANEL_ID} .sayfa-tracker-progress span {
        display: block;
        height: 100%;
        background: #d99abb;
        border-radius: inherit;
      }
      #${PANEL_ID} .sayfa-tracker-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      #${PANEL_ID} .sayfa-tracker-actions button {
        flex: 1 1 110px;
        font-size: 12px;
      }
      #${PANEL_ID} .sayfa-tracker-status {
        min-height: 18px;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  function initialize() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h2>📚 Okuma Deneyimi ve Kitap Takibi</h2>
      <p>Kitaplarını, kaldığın sayfayı ve okuma ilerlemeni takip et.</p>

      <div class="sayfa-tracker-card">
        <h3>Kitap ekle veya ilerlemeni güncelle</h3>

        <label for="sayfaTrackerTitle">Kitap adı</label>
        <input id="sayfaTrackerTitle" maxlength="180"
          placeholder="Örn. Küçük Prens">

        <label for="sayfaTrackerAuthor">Yazar</label>
        <input id="sayfaTrackerAuthor" maxlength="120"
          placeholder="Yazar adı (isteğe bağlı)">

        <label for="sayfaTrackerCurrent">Şu anki sayfan</label>
        <input id="sayfaTrackerCurrent" type="number"
          min="0" max="1000000" step="1" value="0">

        <label for="sayfaTrackerTotal">Toplam sayfa</label>
        <input id="sayfaTrackerTotal" type="number"
          min="1" max="1000000" step="1" placeholder="Örn. 250">

        <label for="sayfaTrackerStatus">Kitap durumu</label>
        <select id="sayfaTrackerStatus">
          <option value="reading">Okuyorum</option>
          <option value="want">Okuyacağım</option>
          <option value="completed">Bitirdim</option>
          <option value="paused">Ara verdim</option>
        </select>

        <button class="sayfa-tracker-primary" id="sayfaTrackerSave">
          Kitabı Kaydet
        </button>
        <p class="sayfa-tracker-status" id="sayfaTrackerMessage"
          role="status" aria-live="polite"></p>
      </div>

      <div class="sayfa-tracker-card">
        <h3>Kitaplığım</h3>
        <div id="sayfaTrackerBookList"></div>
      </div>

      <div class="sayfa-tracker-card">
        <h3>📅 Son okuma hareketleri</h3>
        <div id="sayfaTrackerHistory"></div>
      </div>
    `;

    addStyles();

    const appRoot = document.querySelector(".app")
      || document.querySelector("#app")
      || document.querySelector("main")
      || document.body;

    appRoot.appendChild(panel);

    const titleInput = panel.querySelector("#sayfaTrackerTitle");
    const authorInput = panel.querySelector("#sayfaTrackerAuthor");
    const currentInput = panel.querySelector("#sayfaTrackerCurrent");
    const totalInput = panel.querySelector("#sayfaTrackerTotal");
    const statusInput = panel.querySelector("#sayfaTrackerStatus");
    const message = panel.querySelector("#sayfaTrackerMessage");
    const list = panel.querySelector("#sayfaTrackerBookList");
    const history = panel.querySelector("#sayfaTrackerHistory");

    let data = loadData();
    let editingId = null;

    function safeText(value) {
      return String(value ?? "");
    }

    function escapeHTML(value) {
      return safeText(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }

    function statusLabel(status) {
      return ({
        reading: "Okuyorum",
        want: "Okuyacağım",
        completed: "Bitirdim",
        paused: "Ara verdim"
      })[status] || "Okuyorum";
    }

    function progress(book) {
      if (!book.totalPages) return 0;
      return Math.min(100, Math.round(
        (book.currentPage / book.totalPages) * 100
      ));
    }

    function logActivity(book, action) {
      data.history.unshift({
        title: book.title,
        action,
        date: new Date().toISOString()
      });
      data.history = data.history.slice(0, 50);
    }

    function render() {
      const books = Object.values(data.books);

      if (!books.length) {
        list.innerHTML = "<p>Henüz kitap eklemedin. İlk kitabını yukarıdan ekleyebilirsin.</p>";
      } else {
        list.innerHTML = books.map(book => {
          const percent = progress(book);
          return `
            <div class="sayfa-tracker-book">
              <div class="sayfa-tracker-book-title">${escapeHTML(book.title)}</div>
              <div class="sayfa-tracker-meta">
                ${escapeHTML(book.author || "Yazar belirtilmedi")} ·
                ${escapeHTML(statusLabel(book.status))}
              </div>
              <div class="sayfa-tracker-meta">
                ${book.currentPage} / ${book.totalPages} sayfa · %${percent}
              </div>
              <div class="sayfa-tracker-progress">
                <span style="width:${percent}%"></span>
              </div>
              <div class="sayfa-tracker-actions">
                <button data-action="continue" data-id="${escapeHTML(book.id)}">
                  Kaldığım yeri güncelle
                </button>
                <button data-action="complete" data-id="${escapeHTML(book.id)}">
                  Bitirdim
                </button>
                <button data-action="delete" data-id="${escapeHTML(book.id)}">
                  Sil
                </button>
              </div>
            </div>
          `;
        }).join("");
      }

      if (!data.history.length) {
        history.innerHTML = "<p>Okuma hareketlerin burada görünecek.</p>";
      } else {
        history.innerHTML = data.history.slice(0, 10).map(item => `
          <p>
            <strong>${escapeHTML(item.title)}</strong> —
            ${escapeHTML(item.action)}
            <br>
            <span class="sayfa-tracker-meta">
              ${escapeHTML(new Date(item.date).toLocaleString("tr-TR"))}
            </span>
          </p>
        `).join("");
      }
    }

    function clearForm() {
      editingId = null;
      titleInput.value = "";
      authorInput.value = "";
      currentInput.value = "0";
      totalInput.value = "";
      statusInput.value = "reading";
      panel.querySelector("#sayfaTrackerSave").textContent = "Kitabı Kaydet";
    }

    panel.querySelector("#sayfaTrackerSave").addEventListener("click", () => {
      const title = titleInput.value.trim();
      const author = authorInput.value.trim();
      const currentPage = Number(currentInput.value);
      const totalPages = Number(totalInput.value);
      const status = statusInput.value;

      if (!title) {
        message.textContent = "Önce kitap adını yaz.";
        titleInput.focus();
        return;
      }

      if (
        !Number.isInteger(currentPage) ||
        currentPage < 0 ||
        !Number.isInteger(totalPages) ||
        totalPages < 1 ||
        currentPage > totalPages
      ) {
        message.textContent =
          "Sayfa bilgilerini kontrol et. Şu anki sayfa, toplam sayfadan büyük olamaz.";
        return;
      }

      const id = editingId || (
        "book-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
      );

      const book = {
        id,
        title,
        author,
        currentPage,
        totalPages,
        status: status === "completed" ? "completed" : status,
        updatedAt: new Date().toISOString()
      };

      if (book.status === "completed") {
        book.currentPage = book.totalPages;
      }

      data.books[id] = book;
      logActivity(book, editingId ? "Okuma ilerlemesi güncellendi" : "Kitap eklendi");

      try {
        saveData(data);
        message.textContent = "Kitap bilgileri kaydedildi 💗";
        clearForm();
        render();
      } catch (error) {
        console.error("SAYFA. kitap takibi kaydedilemedi:", error);
        message.textContent = "Kaydedilemedi. Tarayıcı depolama alanını kontrol et.";
      }
    });

    list.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const book = data.books[button.dataset.id];
      if (!book) return;

      const action = button.dataset.action;

      if (action === "continue") {
        editingId = book.id;
        titleInput.value = book.title;
        authorInput.value = book.author;
        currentInput.value = book.currentPage;
        totalInput.value = book.totalPages;
        statusInput.value = book.status === "completed" ? "reading" : book.status;
        panel.querySelector("#sayfaTrackerSave").textContent = "İlerlemeyi Kaydet";
        titleInput.scrollIntoView({ behavior: "smooth", block: "center" });
        message.textContent = "Bilgileri düzenle ve kaydet.";
      }

      if (action === "complete") {
        book.currentPage = book.totalPages;
        book.status = "completed";
        book.updatedAt = new Date().toISOString();
        logActivity(book, "Kitap tamamlandı");

        try {
          saveData(data);
          message.textContent = "Tebrikler, kitabı bitirdin! 🎉";
          render();
        } catch (error) {
          console.error(error);
          message.textContent = "Değişiklik kaydedilemedi.";
        }
      }

      if (action === "delete") {
        if (!window.confirm(`"${book.title}" takip listesinden silinsin mi?`)) {
          return;
        }

        delete data.books[book.id];
        logActivity(book, "Takip listesinden silindi");

        try {
          saveData(data);
          message.textContent = "Kitap takip listesinden silindi.";
          render();
        } catch (error) {
          console.error(error);
          message.textContent = "Silme işlemi kaydedilemedi.";
        }
      }
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();