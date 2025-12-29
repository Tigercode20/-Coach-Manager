/* =========================================================
   🏆 Coach Manager - Combined Diet & Workout Generator
   ========================================================= */

// --- Global State ---
let currentCoachMode = 'nutrition'; // 'nutrition' or 'training'
const $ = id => document.getElementById(id);

// --- Content Storage per Mode ---
const modeContent = {
    nutrition: '',
    training: ''
};

// --- Exercise Map (for Training mode) ---
const exerciseMap = new Map();

// --- Meal Constants (for Nutrition mode) ---
const mealsOrder = [
    'وجبة الإفطار', 'الإفطار', 'الفطار',
    'وجبة خفيفة', 'سناك',
    'الغداء',
    'وجبة قبل التمرين', 'قبل التمرين',
    'وجبة بعد التمرين', 'بعد التمرين',
    'العشاء',
    'ملاحظات عامة', 'ملاحظات',
    'وجبة السحور', 'السحور'
];

const mealIcons = {
    'وجبة الإفطار': '🌅', 'الإفطار': '🌅', 'الفطار': '🌅',
    'وجبة خفيفة': '🍎', 'سناك': '🍎',
    'الغداء': '🍽️',
    'وجبة قبل التمرين': '💪', 'قبل التمرين': '💪',
    'وجبة بعد التمرين': '🏋️', 'بعد التمرين': '🏋️',
    'العشاء': '🌙',
    'ملاحظات عامة': '📝', 'ملاحظات': '📝',
    'وجبة السحور': '🌙', 'السحور': '🌙'
};

// --- Initialize on Load ---
window.addEventListener('DOMContentLoaded', () => {
    // Load exercises data
    if (typeof exercisesData !== 'undefined') {
        for (const category in exercisesData) {
            exercisesData[category].forEach(ex => {
                exerciseMap.set(ex.name.trim().toUpperCase(), ex.link);
            });
        }
    }

    // Load API key
    loadApiKey();
    setMode('manual');
    switchCoachMode('nutrition');
    checkMasterFile();

    // Apply background for printing
    window.addEventListener('beforeprint', () => {
        const bgDataUrl = (typeof BG_DATA !== 'undefined') ? BG_DATA : null;
        if (bgDataUrl) {
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => {
                page.style.setProperty('background-image', `url("${bgDataUrl}")`, 'important');
                page.style.setProperty('background-size', '100% 100%', 'important');
            });
        }
    });
});

/* =========================================================
   Coach Mode Switching (Main Feature)
   ========================================================= */

function switchCoachMode(mode) {
    const inputText = $('inputText');

    // حفظ المحتوى الحالي قبل التبديل
    modeContent[currentCoachMode] = inputText.value;

    // تغيير الوضع الحالي
    currentCoachMode = mode;

    const btnNutrition = $('btnNutrition');
    const btnTraining = $('btnTraining');
    const beforeAfterSection = $('beforeAfterSection');
    const inputSectionTitle = $('inputSectionTitle');
    const pdfSectionTitle = $('pdfSectionTitle');

    // Update button states with animation
    if (mode === 'nutrition') {
        btnNutrition.classList.add('active');
        btnTraining.classList.remove('active');
        beforeAfterSection.classList.remove('section-hidden');
        inputSectionTitle.textContent = '📥 أدخل النظام الغذائي';
        pdfSectionTitle.textContent = '📄 دمج مع ملف Nutrition PDF';
        inputText.placeholder = 'الصق النظام الغذائي هنا...';
        document.documentElement.style.setProperty('--highlight-color', 'var(--nutrition-color)');
    } else {
        btnTraining.classList.add('active');
        btnNutrition.classList.remove('active');
        beforeAfterSection.classList.add('section-hidden');
        inputSectionTitle.textContent = '📥 أدخل خطة التمرين';
        pdfSectionTitle.textContent = '📄 دمج مع ملف Training PDF';
        inputText.placeholder = 'الصق خطة التمرين هنا...';
        document.documentElement.style.setProperty('--highlight-color', 'var(--training-color)');
    }

    // استعادة محتوى الوضع الجديد
    inputText.value = modeContent[mode];

    // Clear output and re-render if there's content
    $('output').innerHTML = '';
    if (modeContent[mode].trim()) {
        render();
    }

    // تحديث ملف PDF الرئيسي عند التبديل
    checkMasterFile();
}

/* =========================================================
   Nutrition Parser Logic
   ========================================================= */

function parseDietPlan(text) {
    const keywords = [
        'وجبة الإفطار', 'الإفطار', 'الفطار',
        'وجبة خفيفة', 'سناك', 'الغداء',
        'وجبة قبل التمرين', 'قبل التmرين',
        'وجبة بعد التمرين', 'بعد التمرين',
        'العشاء', 'ملاحظات عامة', 'ملاحظات', 'وجبة السحور', 'السحور',
        'سعرات', 'بروتين', 'كارب', 'كربوهيدرات', 'دهون'
    ];

    let cleaned = text.replace(/^["""]|["""]$/g, '').trim();
    const pattern = new RegExp(`(^|\\s)(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    cleaned = cleaned.replace(pattern, '\n$2');

    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const meals = [];
    const stats = {};
    let current = null;

    lines.forEach((line, idx) => {
        const matchedTitle = mealsOrder.find(m => line.startsWith(m));
        if (matchedTitle) {
            if (current) meals.push(current);
            const isNotes = matchedTitle.includes('ملاحظات');
            current = {
                title: matchedTitle,
                items: '',
                isNotes: isNotes,
                icon: mealIcons[matchedTitle] || '🍴'
            };
            let rest = line.substring(matchedTitle.length).trim();
            rest = rest.replace(/^[:\-]\s*/, '');
            if (rest) current.items += rest;
        } else if (/^(سعرات|بروتين|كارب|كربوهيدرات|دهون)/.test(line)) {
            const key = line.includes('سعرات') ? 'calories'
                : line.includes('بروتين') ? 'protein'
                    : /كارب|كربوهيدرات/.test(line) ? 'carbs' : 'fats';
            const sameLineMatch = line.match(/\d+/);
            if (sameLineMatch) {
                stats[key] = sameLineMatch[0];
            } else {
                const next = lines[idx + 1] || '';
                if (/^\d+$/.test(next)) {
                    stats[key] = next;
                }
            }
        } else if (current) {
            if (/^\d+$/.test(line) && lines[idx - 1] && /^(سعرات|بروتين|كارب|كربوهيدرات|دهون)/.test(lines[idx - 1])) {
                return;
            }
            current.items += (current.items ? '<br>' : '') + line;
        }
    });

    if (current) meals.push(current);
    return { meals, stats };
}

/* =========================================================
   Training Parser Logic
   ========================================================= */

function parseWorkoutPlan(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const result = { title: '', notes: '', days: [] };

    let currentSection = null;
    let currentDay = null;

    // خريطة تحويل الأرقام العربية المكتوبة إلى أرقام
    const arabicNumbers = {
        'الأول': '1', 'الاول': '1',
        'الثاني': '2', 'الثانى': '2',
        'الثالث': '3',
        'الرابع': '4',
        'الخامس': '5',
        'السادس': '6',
        'السابع': '7',
        'الثامن': '8',
        'التاسع': '9',
        'العاشر': '10'
    };

    const promoPattern = /1️⃣|2️⃣|3️⃣|🗓️/g;
    // Pattern يدعم الأرقام العادية والكلمات العربية
    const dayPattern = /^(?:Day|اليوم)[\s\-_]*(\d+|الأول|الاول|الثاني|الثانى|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)(?:[\s:\-–\.،]+(.*))?$/i;
    const statsPattern = /(\d+\s*(?:Sets|Sets|x|×).*)/i;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        line = line.replace(/[*_#]/g, '').trim();

        if (line.includes('ملاحظات عامة') || line.startsWith('1️⃣')) {
            if (!line.includes('Workout Plan')) {
                currentSection = 'notes';
                line = line.replace(/^[1️⃣\d\.]*\s*ملاحظات عامة\s*[:\-–]?/, '').trim();
                if (line) result.notes += line + '\n';
                continue;
            }
        }

        if (line.includes('Workout Plan') || line.includes('Mohamed El-Tawil') || line.includes('Mohamed ElTawil')) {
            result.title = line.replace(promoPattern, '').replace(/^[-\s]+/, '').trim();
            currentSection = 'days';
            continue;
        }

        if (line.match(/^[-—⸻_]+$/)) continue;

        const dayMatch = line.match(dayPattern);
        if (dayMatch) {
            currentSection = 'days';
            let dayNum = dayMatch[1];
            // تحويل الكلمات العربية إلى أرقام إن وجدت
            if (arabicNumbers[dayNum]) {
                dayNum = arabicNumbers[dayNum];
            }
            const dayFocus = dayMatch[2] ? dayMatch[2].trim() : '';
            currentDay = { id: `Day ${dayNum}`, focus: dayFocus, exercises: [] };
            result.days.push(currentDay);
            continue;
        }

        if (currentSection === 'notes') {
            if (dayPattern.test(line)) { i--; continue; }
            result.notes += line + '\n';
        } else if (currentSection === 'days') {
            if (line.toLowerCase().includes('cardio & abs')) {
                if (currentDay) currentDay.exercises.push({ name: line, isHeader: true, stats: '' });
                continue;
            }
            if (!currentDay) continue;

            const statsMatch = line.match(statsPattern);
            if (statsMatch) {
                const splitIndex = statsMatch.index;
                const namePart = line.substring(0, splitIndex).trim();
                const statsPart = line.substring(splitIndex).trim();
                if (namePart.length > 2) {
                    const link = exerciseMap.get(namePart.replace(/[^\w\s]/g, '').toUpperCase()) || '';
                    currentDay.exercises.push({ name: namePart, stats: statsPart, link: link });
                } else {
                    if (currentDay.exercises.length > 0) {
                        currentDay.exercises[currentDay.exercises.length - 1].stats = line;
                    }
                }
            } else {
                if (line.includes(':') && line.length < 40) {
                    currentDay.exercises.push({ name: line, isHeader: true, stats: '' });
                } else {
                    const exName = line;
                    const cleanName = exName.replace(/[^\w\s]/g, '').toUpperCase();
                    const link = exerciseMap.get(cleanName) || '';
                    currentDay.exercises.push({ name: exName, stats: '', link: link });
                }
            }
        }
    }
    return result;
}

/* =========================================================
   Render Functions
   ========================================================= */

function render() {
    if (currentCoachMode === 'nutrition') {
        renderNutrition();
    } else {
        renderTraining();
    }
}

function renderNutrition() {
    const text = $('inputText').value;
    const data = parseDietPlan(text);
    const output = $('output');
    output.innerHTML = '';

    const notes = data.meals.find(m => m.isNotes);
    const regularMeals = data.meals.filter(m => !m.isNotes);

    if (notes && notes.items.trim()) {
        const notesPage = document.createElement('div');
        notesPage.className = 'page notes-page';
        notesPage.innerHTML = `
            <h1>ملاحظات عامة 📝</h1>
            <div class="notes-content">${notes.items.replace(/\n/g, '<br>')}</div>
        `;
        output.appendChild(notesPage);
    }

    if (regularMeals.length > 0 || Object.keys(data.stats).length > 0) {
        const dietPage = document.createElement('div');
        dietPage.className = 'page diet-page';

        let mealsHtml = '';
        regularMeals.forEach(meal => {
            mealsHtml += `
                <div class="meal-card">
                    <h4>${meal.icon} ${meal.title}</h4>
                    <div class="meal-content">${meal.items}</div>
                </div>
            `;
        });

        const macrosHtml = `
            <div class="macros-container">
                <div class="macro-stat calories">
                    <span class="label">السعرات</span>
                    <span class="value">${data.stats.calories || '0'}</span>
                    <span class="unit">kcal</span>
                </div>
                <div class="macro-stat protein">
                    <span class="label">البروتين</span>
                    <span class="value">${data.stats.protein || '0'}</span>
                    <span class="unit">g</span>
                </div>
                <div class="macro-stat carbs">
                    <span class="label">الكارب</span>
                    <span class="value">${data.stats.carbs || '0'}</span>
                    <span class="unit">g</span>
                </div>
                <div class="macro-stat fats">
                    <span class="label">الدهون</span>
                    <span class="value">${data.stats.fats || '0'}</span>
                    <span class="unit">g</span>
                </div>
            </div>
        `;

        dietPage.innerHTML = `
            <div class="diet-header">
                <h2>🍎 النظام الغذائي</h2>
                <h3>Your Daily Nutrition Plan</h3>
            </div>
            <div class="meals-container">${mealsHtml}</div>
            ${macrosHtml}
        `;
        output.appendChild(dietPage);
    }
}

function renderTraining() {
    const text = $('inputText').value;
    const data = parseWorkoutPlan(text);
    const output = $('output');
    output.innerHTML = '';

    if (data.notes.trim()) {
        const notesPage = document.createElement('div');
        notesPage.className = 'page notes-page';
        notesPage.innerHTML = `
            <h1>ملاحظات عامة 📝</h1>
            <div class="notes-content">${data.notes.replace(/\n/g, '<br>')}</div>
        `;
        output.appendChild(notesPage);
    }

    if (data.title) {
        const titlePage = document.createElement('div');
        titlePage.className = 'page title-page';
        titlePage.innerHTML = `
            <div class="title-container">
                <div class="main-title">WORKOUT PLAN</div>
                <div class="sub-title">${data.title}</div>
            </div>
        `;
        output.appendChild(titlePage);
    }

    data.days.forEach(day => {
        const dayPage = document.createElement('div');
        dayPage.className = 'page day-page';

        let rows = '';
        day.exercises.forEach((ex, idx) => {
            if (ex.isHeader) {
                rows += `<tr class="section-header-row"><td colspan="3" style="text-align: center; background: rgba(0, 255, 255, 0.15); color: var(--training-color); font-weight: 900;">${ex.name}</td></tr>`;
                return;
            }
            const hasLink = !!ex.link;
            const nameHtml = hasLink ? `<a href="${ex.link}" target="_blank" class="ex-link">${ex.name} 🔗</a>` : ex.name;
            rows += `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td class="ex-name-cell">${nameHtml}</td>
                    <td class="stats-cell">${ex.stats}</td>
                </tr>
            `;
        });

        dayPage.innerHTML = `
            <div class="day-header">
                <h2>${day.id}</h2>
                <h3>${day.focus}</h3>
            </div>
            <div class="table-container">
                <table class="workout-table">
                    <thead>
                        <tr>
                            <th style="width: 60px">#</th>
                            <th>التمرين</th>
                            <th style="width: 35%">المجموعات / التكرار</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        output.appendChild(dayPage);
    });
}

function clearAll() {
    $('inputText').value = '';
    $('output').innerHTML = '';
}

/* =========================================================
   Before/After Photo (Nutrition Mode Only)
   ========================================================= */

async function previewBeforeAfter() {
    const output = $('output');
    const clientName = $('clientName')?.value || '';
    const beforeText = $('beforeText')?.value || 'Before';
    const afterText = $('afterText')?.value || 'After';
    const baNotes = $('baNotesInput')?.value || '';
    const beforeInput = $('beforeImg');
    const afterInput = $('afterImg');

    let baPage = document.querySelector('.ba-page');
    if (!baPage) {
        baPage = document.createElement('div');
        baPage.className = 'page ba-page';
        if (output.firstChild) {
            output.insertBefore(baPage, output.firstChild);
        } else {
            output.appendChild(baPage);
        }
    }

    const getImageUrl = (input) => {
        return new Promise((resolve) => {
            if (input && input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(input.files[0]);
            } else {
                resolve('');
            }
        });
    };

    const [beforeUrl, afterUrl] = await Promise.all([getImageUrl(beforeInput), getImageUrl(afterInput)]);

    baPage.innerHTML = `
        <div class="ba-content">
            <h2 class="ba-client-name">${clientName || 'اسم العميل'}</h2>
            <div class="ba-images-row">
                <div class="ba-image-box">
                    ${afterUrl ? `<img src="${afterUrl}" alt="After">` : '<div class="ba-placeholder">After</div>'}
                    <p class="ba-label ba-after">${afterText}</p>
                </div>
                <div class="ba-image-box">
                    ${beforeUrl ? `<img src="${beforeUrl}" alt="Before">` : '<div class="ba-placeholder">Before</div>'}
                    <p class="ba-label ba-before">${beforeText}</p>
                </div>
            </div>
            ${baNotes ? `
            <div class="ba-notes-section">
                <h3>ملاحظات</h3>
                <div class="ba-notes-box">${baNotes.replace(/\n/g, '<br>')}</div>
            </div>
            ` : ''}
        </div>
    `;

    const images = baPage.querySelectorAll('img');
    if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
            return new Promise(resolve => {
                if (img.complete) resolve();
                else { img.onload = resolve; img.onerror = resolve; }
            });
        }));
    }
    return baPage;
}

/* =========================================================
   PDF Merge Logic
   ========================================================= */

let masterPdfBytes = null;

async function checkMasterFile() {
    const statusEl = $('masterStatus');
    const filename = currentCoachMode === 'nutrition' ? 'Nutrition_Master.pdf' : 'Training_Master.pdf';
    try {
        const res = await fetch(filename);
        if (!res.ok) throw new Error('Not Found');
        masterPdfBytes = await res.arrayBuffer();
        statusEl.textContent = `✅ ملف ${filename} جاهز`;
        statusEl.style.color = '#00ff99';
    } catch (err) {
        statusEl.textContent = '⚠️ المتصفح منع تحميل الملف تلقائياً';
        statusEl.style.color = '#ffcc00';
    }
}

async function handleManualFile(input) {
    const statusEl = $('masterStatus');
    const file = input.files[0];
    if (file) {
        masterPdfBytes = await file.arrayBuffer();
        statusEl.textContent = `✅ تم اختيار: ${file.name}`;
        statusEl.style.color = '#00ff99';
    }
}

async function mergeAndDownload() {
    render();

    if (currentCoachMode === 'nutrition') {
        const hasBAData = $('clientName')?.value || $('beforeImg')?.files?.length || $('afterImg')?.files?.length;
        if (hasBAData) {
            await previewBeforeAfter();
        }
    }

    const safeTitle = currentCoachMode === 'nutrition' ? 'NutritionPlan' : 'WorkoutPlan';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
    const finalFileName = `${safeTitle}_${dateStr}_${timeStr}.pdf`;

    const msgEl = $('msg');

    if (!masterPdfBytes) {
        const manualInput = $('manualMasterPdf');
        if (manualInput.files && manualInput.files[0]) {
            masterPdfBytes = await manualInput.files[0].arrayBuffer();
        }
    }

    if (!masterPdfBytes) {
        msgEl.textContent = '❌ يجب اختيار ملف PDF الرئيسي أولاً!';
        msgEl.style.color = '#ff4d4d';
        return;
    }

    const pagesContainer = $('output');
    const allPages = pagesContainer.querySelectorAll('.page');
    if (allPages.length === 0) {
        msgEl.textContent = '❌ لا توجد صفحات لدمجها!';
        msgEl.style.color = '#ff4d4d';
        return;
    }

    const baPage = currentCoachMode === 'nutrition' ? pagesContainer.querySelector('.ba-page') : null;
    const otherPages = Array.from(allPages).filter(p => !p.classList.contains('ba-page'));
    const totalPages = (baPage ? 1 : 0) + otherPages.length;

    msgEl.textContent = `⏳ جاري معالجة ${totalPages} صفحات...`;
    msgEl.style.color = '#ffcc00';

    try {
        const { PDFDocument, PDFName, PDFArray, PDFString } = PDFLib;
        const pdfDoc = await PDFDocument.load(masterPdfBytes);
        const insertAfterPage = parseInt($('insertPage').value) || 5;

        const A4_WIDTH = 595.28;
        const A4_HEIGHT = 841.89;
        const bgDataUrl = (typeof BG_DATA !== 'undefined') ? BG_DATA : null;

        async function renderPageToPdf(pageEl, insertIndex) {
            // جمع روابط التمارين قبل التحويل
            const exerciseLinks = [];
            const linkElements = pageEl.querySelectorAll('a.ex-link');

            linkElements.forEach(linkEl => {
                const rect = linkEl.getBoundingClientRect();
                const pageRect = pageEl.getBoundingClientRect();

                // حساب الموقع النسبي داخل الصفحة
                const relativeX = rect.left - pageRect.left;
                const relativeY = rect.top - pageRect.top;
                const width = rect.width;
                const height = rect.height;

                exerciseLinks.push({
                    url: linkEl.href,
                    x: relativeX,
                    y: relativeY,
                    width: width,
                    height: height
                });
            });

            if (bgDataUrl) pageEl.style.setProperty('background-image', `url("${bgDataUrl}")`, 'important');
            const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const imgImage = await pdfDoc.embedJpg(imgData);
            if (bgDataUrl) pageEl.style.backgroundImage = '';

            const newPage = pdfDoc.insertPage(insertIndex, [A4_WIDTH, A4_HEIGHT]);
            newPage.drawImage(imgImage, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });

            // إضافة روابط قابلة للنقر في PDF
            exerciseLinks.forEach(link => {
                // تحويل إحداثيات HTML إلى إحداثيات PDF
                // HTML: top-left origin, PDF: bottom-left origin
                const pdfX = (link.x / pageEl.offsetWidth) * A4_WIDTH;
                const pdfY = A4_HEIGHT - ((link.y + link.height) / pageEl.offsetHeight) * A4_HEIGHT;
                const pdfWidth = (link.width / pageEl.offsetWidth) * A4_WIDTH;
                const pdfHeight = (link.height / pageEl.offsetHeight) * A4_HEIGHT;

                newPage.node.set(PDFName.of('Annots'),
                    newPage.node.get(PDFName.of('Annots')) || pdfDoc.context.obj([]));

                const annots = newPage.node.lookup(PDFName.of('Annots'), PDFArray);

                const linkAnnotation = pdfDoc.context.obj({
                    Type: 'Annot',
                    Subtype: 'Link',
                    Rect: [pdfX, pdfY, pdfX + pdfWidth, pdfY + pdfHeight],
                    Border: [0, 0, 0],
                    A: {
                        S: 'URI',
                        URI: PDFString.of(link.url)
                    }
                });

                annots.push(linkAnnotation);
            });
        }

        let processedCount = 0;

        if (baPage) {
            await renderPageToPdf(baPage, 1);
            processedCount++;
            msgEl.textContent = `⏳ جاري معالجة صفحة ${processedCount}/${totalPages} (Before/After)...`;
        }

        let insertIndex = insertAfterPage + (baPage ? 1 : 0);
        for (let i = 0; i < otherPages.length; i++) {
            await renderPageToPdf(otherPages[i], insertIndex + i);
            processedCount++;
            msgEl.textContent = `⏳ جاري معالجة صفحة ${processedCount}/${totalPages}...`;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = $('downloadLink');
        link.href = url;
        link.download = finalFileName;
        link.click();

        msgEl.textContent = `✅ تم الحفظ باسم: ${finalFileName}`;
        msgEl.style.color = '#00ff99';
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err) {
        console.error(err);
        msgEl.textContent = '❌ حدث خطأ: ' + err.message;
        msgEl.style.color = '#ff4d4d';
    }
}

/* =========================================================
   AI Integration Logic
   ========================================================= */

function setMode(mode) {
    const btnManual = $('btnManual');
    const btnAI = $('btnAI');
    const aiInputContainer = $('aiInputContainer');
    const aiSettings = $('aiSettings');
    const mainInput = $('inputText');

    if (mode === 'manual') {
        btnManual.classList.add('active');
        btnAI.classList.remove('active');
        aiInputContainer.style.display = 'none';
        aiSettings.style.display = 'none';
        mainInput.placeholder = currentCoachMode === 'nutrition' ? "الصق النظام الغذائي هنا..." : "الصق خطة التمرين هنا...";
    } else {
        btnManual.classList.remove('active');
        btnAI.classList.add('active');
        aiInputContainer.style.display = 'block';
        mainInput.placeholder = "النتيجة ستظهر هنا...";
        if (!$('apiKey').value) {
            aiSettings.style.display = 'block';
        }
    }
}

function toggleSettings() {
    const el = $('aiSettings');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveApiKey() {
    const key = $('apiKey').value.trim();
    if (key) {
        localStorage.setItem('coach_api_key', key);
        alert('تم حفظ المفتاح بنجاح! ✅');
    }
}

function loadApiKey() {
    const savedKey = localStorage.getItem('coach_api_key') || '';
    $('apiKey').value = savedKey;
}

async function generatePlan() {
    const aiInputEl = $('aiInputText');
    const outputEl = $('inputText');
    const userApiKey = $('apiKey').value.trim();
    const btn = document.querySelector('.generate-btn');

    if (!aiInputEl.value.trim()) {
        alert('⚠️ الرجاء إدخال بيانات العميل');
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = '⏳ جاري التفكير والكتابة...';
    btn.disabled = true;

    try {
        const userContent = aiInputEl.value;
        const SYSTEM_PROMPT = currentCoachMode === 'nutrition'
            ? (typeof NUTRITION_PROMPT !== 'undefined' ? NUTRITION_PROMPT : '')
            : (typeof TRAINING_PROMPT !== 'undefined' ? TRAINING_PROMPT : '');

        const fullPrompt = SYSTEM_PROMPT + "\n\n🚀 CLIENT DATA:\n" + userContent;
        let generatedText = "";

        // Try Server API first (uses GEMINI_API_KEY from environment)
        try {
            const serverResponse = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fullPrompt })
            });

            const serverData = await serverResponse.json();

            if (serverResponse.ok && serverData.text) {
                generatedText = serverData.text;
            } else {
                throw new Error(serverData.error || 'Server API failed');
            }
        } catch (serverErr) {
            console.warn('Server API failed, trying user key:', serverErr.message);

            // Fallback to user's API key if provided
            if (!userApiKey) {
                throw new Error('الخادم غير متاح. يرجى إدخال API Key الخاص بك في الإعدادات ⚙️');
            }

            // Direct Gemini API call with user key
            const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.0-flash'];
            let data = null;
            let success = false;
            let lastError = null;

            for (const model of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
                    });

                    data = await response.json();
                    if (data.error) {
                        if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
                            throw new Error(`⚠️ ضغط كبير على السيرفر. يرجى الانتظار دقيقة.`);
                        }
                        throw new Error(data.error.message);
                    }
                    success = true;
                    break;
                } catch (err) {
                    if (err.message.includes('ضغط كبير')) throw err;
                    console.warn(`Model ${model} failed:`, err);
                    lastError = err;
                }
            }

            if (!success) throw lastError || new Error('All models failed.');
            generatedText = data.candidates[0].content.parts[0].text;
        }

        // حفظ المحتوى في الـ mode الحالي
        modeContent[currentCoachMode] = generatedText;
        outputEl.value = generatedText;
        render();

        btn.innerText = '✅ تم التوليد بنجاح!';
        setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);

    } catch (err) {
        console.error(err);
        alert('❌ حدث خطأ: ' + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

/* =========================================================
   Custom Right-Click Menu
   ========================================================= */

const menu = document.getElementById('customContextMenu');

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
}, false);

document.addEventListener('click', function (e) {
    menu.style.display = 'none';
});

async function execCommand(command) {
    menu.style.display = 'none';
    try {
        if (command === 'copy') {
            const selectedText = window.getSelection().toString();
            await navigator.clipboard.writeText(selectedText);
        } else if (command === 'cut') {
            document.execCommand('cut');
        } else if (command === 'paste') {
            const text = await navigator.clipboard.readText();
            if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
                const start = document.activeElement.selectionStart;
                const end = document.activeElement.selectionEnd;
                const val = document.activeElement.value;
                document.activeElement.value = val.slice(0, start) + text + val.slice(end);
            }
        }
    } catch (err) {
        console.error('Command failed: ', err);
        alert('⚠️ المتصفح يرفض الوصول للحافظة.');
    }
}

// Keyboard shortcuts blocking
document.onkeydown = function (e) {
    if (e.keyCode == 123) return false;
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false;
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false;
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
}
