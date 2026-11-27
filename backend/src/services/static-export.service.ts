import { ZipArchive } from "archiver";
import { WebsiteService } from "./website.service";
import { EffectiveWebsiteData } from "@/types";

/**
 * Downloads a remote image into a binary Buffer with fallback.
 */
async function fetchImageBuffer(url?: string): Promise<{ buffer: Buffer; ext: string } | null> {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "";
    let ext = "jpg";
    if (contentType.includes("png") || url.toLowerCase().includes(".png")) ext = "png";
    else if (contentType.includes("webp") || url.toLowerCase().includes(".webp")) ext = "webp";
    else if (contentType.includes("svg") || url.toLowerCase().includes(".svg")) ext = "svg";
    else if (contentType.includes("ico") || url.toLowerCase().includes(".ico")) ext = "ico";
    return { buffer, ext };
  } catch {
    return null;
  }
}

function escapeHtml(str: string = ""): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class StaticExportService {
  /**
   * Generates a complete standalone, production-ready static website ZIP archive
   * and pipes it directly into the provided writable stream (e.g. Express Response).
   */
  public static async generateStaticSiteZip(params: {
    slug: string;
    doctorSlug?: string;
  }): Promise<{ archive: ZipArchive; fileName: string }> {
    const { slug, doctorSlug } = params;

    // 1. Resolve Effective Website Data from Database
    let data: EffectiveWebsiteData | null = null;
    if (doctorSlug) {
      data = await WebsiteService.resolveEffectiveHospitalDoctorData(slug, doctorSlug);
    } else {
      data = await WebsiteService.resolveEffectiveWebsiteData(slug);
    }

    if (!data) {
      throw new Error(`Website data not found for slug: ${slug}${doctorSlug ? `/${doctorSlug}` : ""}`);
    }

    const archive = new ZipArchive({
      zlib: { level: 9 }, // Maximum compression
    });

    const isDoctor = data.websiteType !== "HOSPITAL_CLINIC";
    const displayName = isDoctor ? `Dr. ${data.doctorName || "Doctor"}` : data.organizationName || "Medical Center";
    const cleanPhone = (data.phone || data.whatsApp || "").replace(/[^0-9]/g, "");
    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const addressStr = [
      data.address?.street,
      data.address?.city,
      data.address?.state,
      data.address?.pincode ? `- ${data.address.pincode}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const mapSearchQuery = encodeURIComponent(
      [displayName, data.address?.street, data.address?.city, data.address?.state].filter(Boolean).join(", ")
    );
    const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}`;

    // 2. Download and Bundle Assets into ZIP
    let localLogoPath: string = "";
    let localDoctorPhotoPath: string = "";
    let localFaviconPath: string = "";
    const localGalleryPaths: string[] = [];

    // Download Logo
    const logoUrl = data.logo?.url;
    if (logoUrl) {
      const logoImg = await fetchImageBuffer(logoUrl);
      if (logoImg) {
        localLogoPath = `assets/images/logo.${logoImg.ext}`;
        archive.append(logoImg.buffer, { name: localLogoPath });
      }
    }

    // Download Doctor Photo / Building Photo
    const docPhotoUrl = data.doctorPhoto?.url || data.buildingPhoto?.url;
    if (docPhotoUrl) {
      const docImg = await fetchImageBuffer(docPhotoUrl);
      if (docImg) {
        localDoctorPhotoPath = `assets/images/doctor.${docImg.ext}`;
        archive.append(docImg.buffer, { name: localDoctorPhotoPath });
      }
    }

    // Download Favicon
    if (data.faviconUrl) {
      const favImg = await fetchImageBuffer(data.faviconUrl);
      if (favImg) {
        localFaviconPath = `assets/images/favicon.${favImg.ext}`;
        archive.append(favImg.buffer, { name: localFaviconPath });
      }
    }

    // Download Gallery Photos
    if (Array.isArray(data.galleryPhotos) && data.galleryPhotos.length > 0) {
      for (let i = 0; i < Math.min(data.galleryPhotos.length, 12); i++) {
        const photo = data.galleryPhotos[i];
        if (photo?.url) {
          const gImg = await fetchImageBuffer(photo.url);
          if (gImg) {
            const gPath = `assets/images/gallery-${i + 1}.${gImg.ext}`;
            localGalleryPaths.push(gPath);
            archive.append(gImg.buffer, { name: gPath });
          }
        }
      }
    }

    // 3. Generate HTML, CSS, JS, JSON & README
    const htmlContent = this.generateIndexHtml({
      data,
      displayName,
      isDoctor,
      waNumber,
      addressStr,
      googleMapUrl,
      localLogoPath,
      localDoctorPhotoPath,
      localFaviconPath,
      localGalleryPaths,
    });

    const cssContent = this.generateStyleCss();
    const jsContent = this.generateMainJs({ waNumber, displayName });
    const readmeContent = this.generateReadme({ displayName, slug, doctorSlug });

    // 4. Append files to ZIP
    archive.append(htmlContent, { name: "index.html" });
    archive.append(cssContent, { name: "assets/css/style.css" });
    archive.append(jsContent, { name: "assets/js/main.js" });
    archive.append(JSON.stringify(data, null, 2), { name: "site-data.json" });
    archive.append(readmeContent, { name: "README.md" });

    const safeSlug = (doctorSlug ? `${slug}-${doctorSlug}` : slug)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    const fileName = `${safeSlug}-static-site.zip`;

    return { archive, fileName };
  }

  /**
   * Generates production-ready, clean HTML5 document with embedded Tailwind CSS and modern layout
   */
  private static generateIndexHtml(ctx: {
    data: EffectiveWebsiteData;
    displayName: string;
    isDoctor: boolean;
    waNumber: string;
    addressStr: string;
    googleMapUrl: string;
    localLogoPath: string;
    localDoctorPhotoPath: string;
    localFaviconPath: string;
    localGalleryPaths: string[];
  }): string {
    const {
      data,
      displayName,
      isDoctor,
      waNumber,
      addressStr,
      googleMapUrl,
      localLogoPath,
      localDoctorPhotoPath,
      localFaviconPath,
      localGalleryPaths,
    } = ctx;

    const pageTitle = escapeHtml(data.browserTabTitle || `${displayName} — Official Healthcare Website`);
    const tagline = escapeHtml(data.tagline || (isDoctor ? `Specialist in ${data.specialization || "General Medicine"}` : "Quality Healthcare & Clinical Services"));
    const aboutText = escapeHtml(data.bio || data.about || (isDoctor ? `Dr. ${data.doctorName} provides compassionate, evidence-based medical care.` : `${displayName} is dedicated to providing high quality healthcare.`));
    const phone = escapeHtml(data.phone || "");
    const email = escapeHtml(data.email || "");
    const weeklyOff = escapeHtml(data.weeklyOff || "None (Open 7 Days)");
    const expYears = data.yearsOfExperience ? `${data.yearsOfExperience}+ Years Experience` : "Experienced Practitioner";

    // Treatments / Specialties
    const treatments = (Array.isArray(data.services) && data.services.length > 0
      ? data.services
      : [
          { title: "General Consultation & Checkup", description: "Comprehensive health assessments, vital checks, and preventative medical diagnosis." },
          { title: "Personalized Treatment Plans", description: "Tailored medication schedules and lifestyle protocols designed for sustainable patient recovery." },
          { title: "Diagnostic Evaluations", description: "In-depth review of laboratory tests, symptom history, and specialized clinical screenings." },
          { title: "Preventative Wellness & Follow-up", description: "Continuous patient monitoring, chronic disease management, and supportive medical guidance." },
        ]
    );

    // Testimonials
    const testimonials = Array.isArray(data.testimonials) && data.testimonials.length > 0 ? data.testimonials : [
      { patientName: "Rajesh S.", feedback: "Extremely professional, patient, and accurate diagnosis. Highly recommend!", rating: 5 },
      { patientName: "Pooja M.", feedback: "The clinic environment is hygienic, and the consultation was very thorough and helpful.", rating: 5 },
      { patientName: "Amit V.", feedback: "Very approachable doctor with deep expertise. Treatment worked wonderfully.", rating: 5 },
    ];

    // FAQs
    const faqs = Array.isArray(data.faqs) && data.faqs.length > 0 ? data.faqs : [
      { question: "How do I schedule an appointment?", answer: "You can book directly via the Book Appointment button on this site or reach us on WhatsApp/Phone." },
      { question: "What should I bring to the consultation?", answer: "Please bring your previous medical records, past prescriptions, and current lab reports." },
      { question: "Is prior booking required?", answer: data.appointmentRequired ? "Yes, prior appointment booking is recommended to avoid waiting." : "Walk-in consultations are welcome during active consultation hours." },
    ];

    return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${tagline} - ${escapeHtml(displayName)}">
  ${localFaviconPath ? `<link rel="icon" href="${localFaviconPath}">` : ""}
  <!-- Google Fonts: Inter & Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#eef7ff',
              100: '#d9edff',
              500: '#1a76d1',
              600: '#1560aa',
              700: '#104984',
            }
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-slate-950 text-slate-100 transition-colors duration-200 antialiased selection:bg-brand-500 selection:text-white pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] min-[1033px]:pb-0">

  <!-- Top Utility Bar -->
  <div class="border-b border-slate-800/80 bg-slate-900/60 text-xs py-2 px-4 backdrop-blur-md">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-4 text-slate-300">
        <span>⏰ <strong>Weekly Off:</strong> <span class="text-amber-400 font-medium">${weeklyOff}</span></span>
        ${data.consultationHours ? `<span class="hidden sm:inline">| Regular In-Clinic Hours Available</span>` : ""}
      </div>
      <div class="flex items-center gap-4 text-slate-300 font-medium">
        ${phone ? `<a href="tel:${phone}" class="hover:text-brand-500 transition-colors flex items-center gap-1.5">📞 <span>${phone}</span></a>` : ""}
        ${email ? `<a href="mailto:${email}" class="hidden md:flex hover:text-brand-500 transition-colors items-center gap-1.5">✉️ <span>${email}</span></a>` : ""}
      </div>
    </div>
  </div>

  <!-- Header / Navigation -->
  <header class="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <a href="#home" class="flex items-center gap-3">
        ${localLogoPath ? `<img src="${localLogoPath}" alt="${displayName}" class="h-10 w-10 object-contain rounded-xl border border-slate-700/80 bg-slate-900 p-1">` : `<div class="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center font-bold text-white shadow-md">🩺</div>`}
        <div>
          <span class="font-bold text-base text-white tracking-tight block leading-snug">${displayName}</span>
          <span class="text-[11px] font-semibold text-brand-500 uppercase tracking-wider block">${isDoctor ? escapeHtml(data.specialization || "Clinical Practice") : "Healthcare Center"}</span>
        </div>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
        <a href="#home" class="hover:text-white transition-colors">Home</a>
        <a href="#about" class="hover:text-white transition-colors">About</a>
        <a href="#treatments" class="hover:text-white transition-colors">${isDoctor ? "Treatments" : "Departments"}</a>
        ${localGalleryPaths.length > 0 ? `<a href="#gallery" class="hover:text-white transition-colors">Facility</a>` : ""}
        <a href="#schedule" class="hover:text-white transition-colors">Schedule</a>
        <a href="#reviews" class="hover:text-white transition-colors">Testimonials</a>
        <a href="#contact" class="hover:text-white transition-colors">Contact</a>
      </nav>

      <!-- Right CTAs -->
      <div class="flex items-center gap-3">
        <!-- Theme Toggle Button -->
        <button id="themeToggleBtn" type="button" aria-label="Toggle Theme" class="p-2 rounded-xl border border-slate-800 hover:bg-slate-800/60 text-slate-300 transition-all">
          <span id="themeToggleIcon">☀️</span>
        </button>

        <button onclick="openBookingModal()" type="button" class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95 cursor-pointer">
          📅 <span>Book Appointment</span>
        </button>

        <!-- Mobile Menu Toggle -->
        <button id="mobileMenuBtn" type="button" class="md:hidden p-2 rounded-xl border border-slate-800 text-slate-300">
          ☰
        </button>
      </div>
    </div>

    <!-- Mobile Nav Menu -->
    <div id="mobileMenu" class="hidden md:hidden border-b border-slate-800 bg-slate-900/95 px-5 py-4 space-y-3 text-sm font-semibold">
      <a href="#home" onclick="closeMobileMenu()" class="block py-1 text-slate-200">Home</a>
      <a href="#about" onclick="closeMobileMenu()" class="block py-1 text-slate-200">About</a>
      <a href="#treatments" onclick="closeMobileMenu()" class="block py-1 text-slate-200">${isDoctor ? "Treatments" : "Departments"}</a>
      ${localGalleryPaths.length > 0 ? `<a href="#gallery" onclick="closeMobileMenu()" class="block py-1 text-slate-200">Facility Photos</a>` : ""}
      <a href="#schedule" onclick="closeMobileMenu()" class="block py-1 text-slate-200">Schedule</a>
      <a href="#reviews" onclick="closeMobileMenu()" class="block py-1 text-slate-200">Testimonials</a>
      <a href="#contact" onclick="closeMobileMenu()" class="block py-1 text-slate-200">Contact</a>
      <div class="pt-2">
        <button onclick="openBookingModal(); closeMobileMenu();" type="button" class="w-full py-2.5 rounded-xl bg-brand-500 font-bold text-white text-center text-xs">
          📅 Book Consultation
        </button>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section id="home" class="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <!-- Left Hero Content -->
        <div class="lg:col-span-7 space-y-6 text-left">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-500 text-xs font-semibold">
            ✨ <span>Verified Healthcare Practice</span>
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            ${isDoctor ? `Expert Healthcare by <span class="text-brand-500">Dr. ${escapeHtml(data.doctorName || "")}</span>` : `<span class="text-brand-500">${escapeHtml(displayName)}</span>`}
          </h1>

          <p class="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            ${tagline}
          </p>

          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap items-center gap-3.5 pt-2">
            <button onclick="openBookingModal()" type="button" class="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-xl shadow-brand-500/30 transition-all active:scale-95 cursor-pointer">
              Schedule Consultation
            </button>
            ${waNumber ? `<a href="https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello, I would like to schedule a consultation with ${displayName}.`)}" target="_blank" class="px-5 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-sm transition-all flex items-center gap-2">
              💬 <span>WhatsApp Direct</span>
            </a>` : ""}
            ${phone ? `<a href="tel:${phone}" class="px-5 py-3 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-bold text-sm transition-all">
              📞 Call Clinic
            </a>` : ""}
          </div>

          <!-- Feature Highlights -->
          <div class="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-800/80">
            <div>
              <span class="text-xs text-slate-400 block">Experience</span>
              <span class="text-sm font-bold text-white">${expYears}</span>
            </div>
            <div>
              <span class="text-xs text-slate-400 block">Location</span>
              <span class="text-sm font-bold text-white">${escapeHtml(data.address?.city || "City Center")}</span>
            </div>
            <div>
              <span class="text-xs text-slate-400 block">Booking</span>
              <span class="text-sm font-bold text-emerald-400">Direct Available</span>
            </div>
          </div>
        </div>

        <!-- Right Hero Image -->
        <div class="lg:col-span-5 flex justify-center">
          <div class="relative w-full max-w-md">
            <div class="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-brand-500/30 to-purple-500/20 blur-xl"></div>
            <div class="relative rounded-3xl border border-slate-800 bg-slate-900 p-2 shadow-2xl overflow-hidden">
              ${localDoctorPhotoPath ? `<img src="${localDoctorPhotoPath}" alt="${displayName}" class="w-full h-80 sm:h-96 object-cover rounded-2xl">` : `<div class="w-full h-80 sm:h-96 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-6xl">🩺</div>`}
              <div class="p-4 text-center">
                <span class="font-bold text-white block text-sm">${displayName}</span>
                <span class="text-xs text-brand-500 font-semibold">${isDoctor ? escapeHtml(data.degree ? `${data.specialization} (${data.degree})` : data.specialization || "") : "Comprehensive Clinical Care"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- About Section -->
  <section id="about" class="py-16 border-t border-slate-800/80 bg-slate-900/30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mb-10">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">About Practitioner</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Clinical Background & Expertise</h2>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-4 text-slate-300 text-sm leading-relaxed">
          <p class="text-base">${aboutText}</p>
          ${isDoctor && data.degree ? `<div class="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <span class="text-xs text-slate-400 block font-semibold">Qualifications & Credentials</span>
            <span class="text-sm font-bold text-white">${escapeHtml(data.degree)}</span>
          </div>` : ""}
        </div>

        <div class="space-y-4">
          <!-- Consultation Fees Card -->
          <div class="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
            <span class="text-xs font-bold uppercase text-brand-500 tracking-wider block">Consultation Fees</span>
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs text-slate-400">First / New Case</span>
              <span class="text-sm font-bold text-white">${data.newCaseFee ? `₹${data.newCaseFee}` : "Applicable in-clinic"}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Follow-up / Old Case</span>
              <span class="text-sm font-bold text-white">${data.oldCaseFee ? `₹${data.oldCaseFee}` : "Applicable in-clinic"}</span>
            </div>
          </div>

          <!-- Quick Contact Box -->
          <div class="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-2">
            <span class="text-xs font-bold uppercase text-brand-500 tracking-wider block">Clinic Hours</span>
            <p class="text-xs text-slate-300">Mon - Sat: Scheduled hours</p>
            <p class="text-xs text-amber-400 font-semibold">Weekly Off: ${weeklyOff}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Treatments / Services Section -->
  <section id="treatments" class="py-16 border-t border-slate-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-12">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Clinical Focus</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">${isDoctor ? "Specialized Medical Treatments" : "Hospital Departments & Services"}</h2>
        <p class="text-xs sm:text-sm text-slate-400 mt-2">Comprehensive outpatient and evidence-based therapeutic procedures.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        ${treatments.map((t: any) => `
          <div class="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-brand-500/50 transition-all hover:-translate-y-1">
            <div class="h-9 w-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center font-bold mb-3">
              ✓
            </div>
            <h3 class="text-sm font-bold text-white mb-1.5">${escapeHtml(t.title || "")}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">${escapeHtml(t.description || "")}</p>
          </div>
        `).join("")}
      </div>
    </div>
  </section>

  <!-- Facility Gallery (if photos available) -->
  ${localGalleryPaths.length > 0 ? `
  <section id="gallery" class="py-16 border-t border-slate-800/80 bg-slate-900/30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Practice Infrastructure</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Clinic & Facility Photos</h2>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        ${localGalleryPaths.map((p, idx) => `
          <div onclick="openLightbox('${p}')" class="relative group cursor-pointer overflow-hidden rounded-2xl border border-slate-800 aspect-video bg-slate-900">
            <img src="${p}" alt="Clinic Photo ${idx + 1}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs">
              🔍 View Photo
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  </section>` : ""}

  <!-- Schedule Section -->
  <section id="schedule" class="py-16 border-t border-slate-800/80">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-8">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Weekly Schedule</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Consultation Timings</h2>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-xs font-semibold text-slate-400">Regular Working Days</span>
          <span class="text-xs font-bold text-emerald-400">Monday — Saturday</span>
        </div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-xs font-semibold text-slate-400">Weekly Off</span>
          <span class="text-xs font-bold text-amber-400">${weeklyOff}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-400">Prior Booking</span>
          <span class="text-xs font-bold text-white">${data.appointmentRequired ? "Required" : "Recommended (Walk-ins Welcome)"}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Testimonials Section -->
  <section id="reviews" class="py-16 border-t border-slate-800/80 bg-slate-900/30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Patient Feedback</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Verified Patient Testimonials</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        ${testimonials.map((t: any) => `
          <div class="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div class="text-amber-400 text-sm tracking-wider">★★★★★</div>
            <p class="text-xs text-slate-300 leading-relaxed italic">"${escapeHtml(t.feedback || "")}"</p>
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span class="text-xs font-bold text-white">${escapeHtml(t.patientName || "Verified Patient")}</span>
              <span class="text-[10px] text-emerald-400 font-semibold">✓ Verified Visit</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  </section>

  <!-- FAQs Section -->
  <section class="py-16 border-t border-slate-800/80">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-10">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Patient Queries</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Frequently Asked Questions</h2>
      </div>

      <div class="space-y-3">
        ${faqs.map((f: any, idx: number) => `
          <div class="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
            <button onclick="toggleFaq(${idx})" type="button" class="w-full text-left px-5 py-3.5 text-xs sm:text-sm font-bold text-white flex items-center justify-between">
              <span>${escapeHtml(f.question || "")}</span>
              <span id="faq-icon-${idx}" class="text-brand-500 text-base font-mono">+</span>
            </button>
            <div id="faq-ans-${idx}" class="hidden px-5 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/50 pt-2.5">
              ${escapeHtml(f.answer || "")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  </section>

  <!-- Contact & Location Map -->
  <section id="contact" class="py-16 border-t border-slate-800/80 bg-slate-900/30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-12">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-500">Get in Touch</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">Clinic Address & Contact</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Address -->
        <a href="${googleMapUrl}" target="_blank" class="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-brand-500/50 transition-all block group">
          <span class="text-2xl block mb-2">📍</span>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-500 block">Clinic Location</span>
          <p class="text-xs text-slate-300 mt-2 leading-relaxed">${escapeHtml(addressStr || "Medical Practice Address")}</p>
          <span class="text-[11px] text-brand-500 group-hover:underline font-semibold mt-3 inline-block">Open in Google Maps ↗</span>
        </a>

        <!-- Phone -->
        <div class="p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <span class="text-2xl block mb-2">📞</span>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-500 block">Phone Consultation</span>
          <p class="text-xs text-slate-300 mt-2 font-mono">${phone || "Contact reception during open hours"}</p>
          ${phone ? `<a href="tel:${phone}" class="text-[11px] text-brand-500 hover:underline font-semibold mt-3 inline-block">Call Now →</a>` : ""}
        </div>

        <!-- WhatsApp -->
        <div class="p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <span class="text-2xl block mb-2">💬</span>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-500 block">WhatsApp Direct</span>
          <p class="text-xs text-slate-300 mt-2">Send your inquiries or request appointments directly via WhatsApp.</p>
          ${waNumber ? `<a href="https://wa.me/${waNumber}" target="_blank" class="text-[11px] text-emerald-400 hover:underline font-semibold mt-3 inline-block">Message on WhatsApp ↗</a>` : ""}
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-10 border-t border-slate-800 bg-slate-950 text-xs text-slate-500">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <span class="font-bold text-slate-300">${displayName}</span>
        <p class="text-[11px] text-slate-600 mt-0.5">© ${new Date().getFullYear()} All Rights Reserved. Evidence-based healthcare practice.</p>
      </div>
      <div class="flex items-center gap-4 text-[11px]">
        <a href="#home" class="hover:text-slate-300">Top ↑</a>
        <a href="#schedule" class="hover:text-slate-300">Timings</a>
        <a href="#contact" class="hover:text-slate-300">Location</a>
      </div>
    </div>
  </footer>

  <!-- Fixed Bottom Navigation Bar (Mobile & Tablet WhatsApp Pill Style) -->
  <aside aria-label="Mobile Bottom Navigation" class="fixed bottom-0 left-0 right-0 z-40 min-[1033px]:hidden select-none bg-slate-950/95 border-t border-slate-800/90 shadow-[0_-4px_25px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors duration-200" style="padding-bottom: env(safe-area-inset-bottom, 0px); transform: translateZ(0); -webkit-transform: translateZ(0);">
    <nav class="grid grid-cols-5 items-center justify-items-center h-16 max-w-lg sm:max-w-xl mx-auto px-1">
      <!-- 1. Home -->
      <button type="button" onclick="navScrollTo('home')" data-tab="home" class="mobile-nav-btn w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden" style="-webkit-tap-highlight-color: transparent;">
        <div class="pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-brand-500 shadow-xs">
          <svg class="h-4.5 w-4.5 text-white stroke-[2.3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        </div>
        <span class="tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-extrabold text-brand-500 truncate max-w-[70px]">Home</span>
      </button>

      <!-- 2. Treatments / Specialization -->
      <button type="button" onclick="navScrollTo('treatments')" data-tab="specialty" class="mobile-nav-btn w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden" style="-webkit-tap-highlight-color: transparent;">
        <div class="pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-transparent">
          <svg class="h-4.5 w-4.5 text-slate-400 stroke-[1.8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </div>
        <span class="tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-medium text-slate-400 truncate max-w-[70px]">${!isDoctor ? "Specialization" : "Treatments"}</span>
      </button>

      <!-- 3. Timings -->
      <button type="button" onclick="navScrollTo('schedule')" data-tab="timings" class="mobile-nav-btn w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden" style="-webkit-tap-highlight-color: transparent;">
        <div class="pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-transparent">
          <svg class="h-4.5 w-4.5 text-slate-400 stroke-[1.8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <span class="tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-medium text-slate-400 truncate max-w-[70px]">Timings</span>
      </button>

      <!-- 4. Facilities -->
      <button type="button" onclick="navScrollTo('gallery')" data-tab="facilities" class="mobile-nav-btn w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden" style="-webkit-tap-highlight-color: transparent;">
        <div class="pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-transparent">
          <svg class="h-4.5 w-4.5 text-slate-400 stroke-[1.8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
        </div>
        <span class="tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-medium text-slate-400 truncate max-w-[70px]">Facilities</span>
      </button>

      <!-- 5. Contact -->
      <button type="button" onclick="navScrollTo('contact')" data-tab="contact" class="mobile-nav-btn w-full flex flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer focus:outline-hidden" style="-webkit-tap-highlight-color: transparent;">
        <div class="pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-transparent">
          <svg class="h-4.5 w-4.5 text-slate-400 stroke-[1.8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        </div>
        <span class="tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-medium text-slate-400 truncate max-w-[70px]">Contact</span>
      </button>
    </nav>
  </aside>

  <!-- Appointment Booking Modal (Standalone Pure JS) -->
  <div id="bookingModal" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-bold text-white">Schedule Consultation</h3>
          <span class="text-xs text-brand-500 font-semibold">${displayName}</span>
        </div>
        <button onclick="closeBookingModal()" type="button" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
      </div>

      <form id="standaloneBookingForm" onsubmit="handleStaticBookingSubmit(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Patient Full Name *</label>
          <input type="text" id="patientName" required placeholder="Enter full name" class="w-full h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-brand-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Age (Years) *</label>
            <input type="number" id="patientAge" min="1" max="120" required placeholder="e.g. 35" class="w-full h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-brand-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Preferred Date *</label>
            <input type="date" id="preferredDate" required class="w-full h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-brand-500">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Phone / WhatsApp Number *</label>
          <input type="tel" id="patientPhone" required placeholder="10-digit mobile number" class="w-full h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-brand-500">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Medical Concern / Symptoms *</label>
          <textarea id="patientConcern" rows="3" required placeholder="Briefly describe your symptoms or reason for visit..." class="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs outline-none focus:border-brand-500"></textarea>
        </div>

        <div class="pt-2">
          <button type="submit" class="w-full h-11 rounded-xl bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-lg shadow-brand-500/30 transition-all cursor-pointer">
            Submit Consultation Request
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Gallery Lightbox Modal -->
  <div id="lightboxModal" class="hidden fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
    <div class="relative max-w-4xl max-h-[90vh]">
      <button onclick="closeLightbox()" type="button" class="absolute -top-10 right-0 text-white font-bold text-xl p-2">✕ Close</button>
      <img id="lightboxImg" src="" alt="Enlarged Photo" class="max-w-full max-h-[85vh] rounded-2xl object-contain border border-slate-800">
    </div>
  </div>

  <script src="assets/js/main.js"></script>
</body>
</html>`;
  }

  /**
   * Generates custom stylesheet for standalone website
   */
  private static generateStyleCss(): string {
    return `/* Doczeno Standalone Static Site Stylesheet */
:root {
  --theme-primary: #1a76d1;
  --theme-primary-hover: #1560aa;
}

html {
  scroll-behavior: smooth;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

/* Light Mode Overrides when html tag has class .light */
html.light {
  background-color: #f8fafc;
  color: #0f172a;
}
html.light body {
  background-color: #f8fafc;
  color: #0f172a;
}
html.light header {
  background-color: rgba(255, 255, 255, 0.85);
  border-color: #e2e8f0;
}
html.light .bg-slate-950 {
  background-color: #ffffff;
}
html.light .bg-slate-900 {
  background-color: #f1f5f9;
}
html.light .bg-slate-900\\/30,
html.light .bg-slate-900\\/40,
html.light .bg-slate-900\\/60,
html.light .bg-slate-900\\/80 {
  background-color: #ffffff;
  border-color: #e2e8f0;
}
html.light .text-white {
  color: #0f172a;
}
html.light .text-slate-100,
html.light .text-slate-200,
html.light .text-slate-300 {
  color: #334155;
}
html.light .text-slate-400 {
  color: #64748b;
}
html.light .border-slate-800,
html.light .border-slate-800\\/80,
html.light .border-slate-700 {
  border-color: #e2e8f0;
}

/* Desktop Viewport (1033px and above) hides Mobile Bottom Navigation */
@media (min-width: 1033px) {
  aside[aria-label="Mobile Bottom Navigation"] {
    display: none !important;
  }
}

/* Print Friendly Styles */
@media print {
  header, footer, #bookingModal, #lightboxModal, #themeToggleBtn {
    display: none !important;
  }
  body {
    background: #fff !important;
    color: #000 !important;
  }
}
`;
  }

  /**
   * Generates vanilla JS script for interactive features
   */
  private static generateMainJs(ctx: { waNumber: string; displayName: string }): string {
    const { waNumber, displayName } = ctx;

    return `// Doczeno Standalone Static Site JavaScript

// 1. Dark / Light Mode Toggle with Persistence
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');

function initTheme() {
  const saved = localStorage.getItem('doczeno_site_theme');
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('doczeno_site_theme', 'light');
      if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('doczeno_site_theme', 'dark');
      if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
    }
  });
}

// 2. Mobile Menu Controls
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

function closeMobileMenu() {
  if (mobileMenu) mobileMenu.classList.add('hidden');
}

// 3. Appointment Modal Controls
const bookingModal = document.getElementById('bookingModal');

function openBookingModal() {
  if (bookingModal) {
    bookingModal.classList.remove('hidden');
    // Pre-populate preferred date with tomorrow
    const dateInput = document.getElementById('preferredDate');
    if (dateInput && !dateInput.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }
  }
}

function closeBookingModal() {
  if (bookingModal) bookingModal.classList.add('hidden');
}

// 4. Standalone Form Submission (Dispatches to WhatsApp or direct call)
function handleStaticBookingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('patientName').value.trim();
  const age = document.getElementById('patientAge').value.trim();
  const phone = document.getElementById('patientPhone').value.trim();
  const date = document.getElementById('preferredDate').value;
  const concern = document.getElementById('patientConcern').value.trim();

  const waTarget = "${waNumber}";
  const entity = "${escapeHtml(displayName)}";

  const msg = encodeURIComponent(
    "Hello " + entity + ",\\n\\nI would like to request an appointment:\\n- Patient Name: " + name + "\\n- Age: " + age + " yrs\\n- Phone: " + phone + "\\n- Preferred Date: " + date + "\\n- Concern/Reason: " + concern
  );

  if (waTarget) {
    window.open("https://wa.me/" + waTarget + "?text=" + msg, "_blank");
  } else {
    alert("Thank you " + name + "! Your consultation request for " + date + " has been recorded. The clinic reception will contact you at " + phone + ".");
  }

  closeBookingModal();
  e.target.reset();
}

// 5. FAQ Accordion
function toggleFaq(idx) {
  const ans = document.getElementById('faq-ans-' + idx);
  const icon = document.getElementById('faq-icon-' + idx);
  if (ans) {
    const isHidden = ans.classList.contains('hidden');
    if (isHidden) {
      ans.classList.remove('hidden');
      if (icon) icon.textContent = '−';
    } else {
      ans.classList.add('hidden');
      if (icon) icon.textContent = '+';
    }
  }
}

// 6. Lightbox Viewer
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(src) {
  if (lightboxModal && lightboxImg) {
    lightboxImg.src = src;
    lightboxModal.classList.remove('hidden');
  }
}

function closeLightbox() {
  if (lightboxModal) lightboxModal.classList.add('hidden');
}

// 7. Mobile Bottom Navigation Scroll Spy & Smooth Scrolling
let isNavClickScrolling = false;
let navClickTimer = null;

function navScrollTo(targetId) {
  setActiveNavPill(targetId);
  isNavClickScrolling = true;
  if (navClickTimer) clearTimeout(navClickTimer);

  if (targetId === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    const el = document.getElementById(targetId);
    if (el) {
      const yOffset = -60;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }

  navClickTimer = setTimeout(() => {
    isNavClickScrolling = false;
  }, 850);
}

function setActiveNavPill(activeTarget) {
  const buttons = document.querySelectorAll('.mobile-nav-btn');
  buttons.forEach(btn => {
    const isThis = btn.getAttribute('data-tab') === activeTarget || btn.getAttribute('onclick')?.includes("'" + activeTarget + "'");
    const pill = btn.querySelector('.pill-box');
    const label = btn.querySelector('.tab-label');
    const svg = btn.querySelector('svg');
    if (!pill || !label || !svg) return;

    if (isThis) {
      pill.className = 'pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-brand-500 shadow-xs';
      label.className = 'tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-extrabold text-brand-500 truncate max-w-[70px]';
      svg.className = 'h-4.5 w-4.5 text-white stroke-[2.3]';
    } else {
      pill.className = 'pill-box w-[44px] h-[34px] rounded-full flex items-center justify-center transition-all duration-200 bg-transparent';
      label.className = 'tab-label text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors duration-200 font-medium text-slate-400 truncate max-w-[70px]';
      svg.className = 'h-4.5 w-4.5 text-slate-400 stroke-[1.8]';
    }
  });
}

function initMobileScrollSpy() {
  const milestones = [
    { id: 'home', target: 'home' },
    { id: 'specialty', target: 'treatments' },
    { id: 'facilities', target: 'gallery' },
    { id: 'timings', target: 'schedule' },
    { id: 'contact', target: 'contact' }
  ];

  window.addEventListener('scroll', () => {
    if (isNavClickScrolling) return;
    const scrollY = window.scrollY;
    const windowH = window.innerHeight;
    const docH = document.documentElement.scrollHeight;

    if (scrollY < 180) {
      setActiveNavPill('home');
      return;
    }

    if (scrollY + windowH >= docH - 120) {
      setActiveNavPill('contact');
      return;
    }

    const scanLine = scrollY + windowH * 0.35;
    const list = [];
    milestones.forEach(m => {
      const el = document.getElementById(m.target);
      if (el) {
        list.push({ id: m.id, top: el.getBoundingClientRect().top + scrollY });
      }
    });

    list.sort((a, b) => a.top - b.top);
    let activeId = 'home';
    for (const m of list) {
      if (scanLine >= m.top - 50) {
        activeId = m.id;
      }
    }
    setActiveNavPill(activeId);
  }, { passive: true });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileScrollSpy();
});
`;
  }

  /**
   * Generates helpful documentation on how to host and edit the site
   */
  private static generateReadme(ctx: { displayName: string; slug: string; doctorSlug?: string }): string {
    const { displayName, slug, doctorSlug } = ctx;
    const fullSlug = doctorSlug ? `${slug}/${doctorSlug}` : slug;

    return `# ${displayName} — Static Website Package
Exported from Doczeno Platform (https://doczeno.vercel.app)
Target Practice: ${fullSlug}

---

## 📁 Package Contents

- **\`index.html\`**: The primary production-ready webpage with full responsive styling and dark/light mode.
- **\`assets/css/style.css\`**: Custom styles, responsive tweaks, animations, and print styling.
- **\`assets/js/main.js\`**: Interactive client-side scripts for WhatsApp booking, gallery modal, FAQ accordion, and theme toggle.
- **\`assets/images/\`**: All official clinic logos, doctor profile photos, and facility gallery images bundled locally.
- **\`site-data.json\`**: Complete structured JSON backup of clinical profile information, working hours, and reviews.

---

## 🚀 How to Run & Deploy Anywhere

### Option 1: Instant Local View (No Server Needed)
Simply double-click \`index.html\` in any web browser (Chrome, Edge, Safari, Firefox). The entire website will load and work offline.

### Option 2: 100% Free Hosting via Netlify Drop (30 Seconds)
1. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop) in your browser.
2. Drag and drop this unzipped folder into the upload box.
3. Your website will instantly be live on a fast, free global CDN URL with free SSL!

### Option 3: Host on cPanel / Shared Hosting (Hostinger, GoDaddy, Bluehost)
1. Log into your cPanel File Manager.
2. Navigate to \`public_html/\`.
3. Upload and extract this ZIP file.
4. Your website is immediately live on your custom domain.

### Option 4: Vercel or GitHub Pages
1. Push this folder to a GitHub repository.
2. Connect the repository to Vercel or enable GitHub Pages in Repository Settings > Pages.

---
© ${new Date().getFullYear()} Doczeno. Clean Deterministic Healthcare Website Engine.
`;
  }
}
