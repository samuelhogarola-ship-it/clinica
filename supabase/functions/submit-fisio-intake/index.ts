import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PDF_BUCKET = "clinical-documents";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FICHA_DEFAULTS = {
  apellidos: "",
  nombre: "",
  edad: "",
  sexo: "",
  profesion: "",
  alturaPeso: "",
  diagnosticoMedico: "",
  fechaInicialAnomalia: "",
  tratamientosAfines: "",
  medicacion: "",
  pruebaImagen: "",
  historiaClinica: "",
  anamnesis: "",
  antecedentesALAV: "",
  antecedentesAQ: "",
  inspeccionObservacion: "",
  palpacionDiagnostica: "",
  sensibilidad: "",
  pgs: "",
  balanceMuscular: "",
  balanceArticular: "",
  datosInteres: "",
  valoracionFuncional: "",
  pruebasEspecificas: "",
  problemasFisioterapeuticos: "",
  programaFisioterapia: "",
  planTratamiento: "",
  recomendacionesFamilia: "",
  objetivosFisioterapeuticos: "",
  evolucionExploracionTratamiento: "",
};

const sectionRows = [
  {
    title: "Datos personales",
    rows: [
      ["Apellidos", "apellidos"],
      ["Nombre", "nombre"],
      ["Edad", "edad"],
      ["Sexo", "sexo"],
      ["Profesión", "profesion"],
      ["Altura / Peso", "alturaPeso"],
      ["Diagnóstico médico", "diagnosticoMedico"],
      ["Fecha inicial de anomalía", "fechaInicialAnomalia"],
      ["Tratamientos afines", "tratamientosAfines"],
      ["Medicación anterior / actual", "medicacion"],
      ["Prueba de imagen", "pruebaImagen"],
    ],
  },
  {
    title: "Historia clínica y exploración",
    rows: [
      ["Historia clínica", "historiaClinica"],
      ["Anamnesis", "anamnesis"],
      ["Antecedentes AL o AV", "antecedentesALAV"],
      ["Antecedentes AQ", "antecedentesAQ"],
      ["Inspección / observación", "inspeccionObservacion"],
      ["Palpación diagnóstica", "palpacionDiagnostica"],
      ["Sensibilidad en", "sensibilidad"],
      ["PGS", "pgs"],
      ["Balance muscular", "balanceMuscular"],
      ["Balance articular / movilidad + disfunciones", "balanceArticular"],
      ["Datos de interés", "datosInteres"],
      ["Valoración funcional", "valoracionFuncional"],
      ["Pruebas específicas", "pruebasEspecificas"],
    ],
  },
  {
    title: "Problemas y tratamiento",
    rows: [
      ["Problemas fisioterapéuticos", "problemasFisioterapeuticos"],
      ["Programa de fisioterapia", "programaFisioterapia"],
      ["Plan de tratamiento", "planTratamiento"],
      ["Recomendaciones a la familia", "recomendacionesFamilia"],
      ["Objetivos fisioterapéuticos", "objetivosFisioterapeuticos"],
      ["Evolución, exploración y tratamiento", "evolucionExploracionTratamiento"],
    ],
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hydrateFichaCampos(data: Record<string, unknown>) {
  const merged = { ...FICHA_DEFAULTS } as Record<string, string>;

  for (const key of Object.keys(FICHA_DEFAULTS)) {
    merged[key] = normalizeText(data[key]);
  }

  if (!merged.anamnesis && normalizeText(data.sintomas)) {
    merged.anamnesis = normalizeText(data.sintomas);
  }

  if (!merged.diagnosticoMedico && normalizeText(data.diagnostico)) {
    merged.diagnosticoMedico = normalizeText(data.diagnostico);
  }

  if (!merged.planTratamiento && normalizeText(data.tratamiento)) {
    merged.planTratamiento = normalizeText(data.tratamiento);
  }

  return merged;
}

function formatDisplayDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function wrapText(text: string, maxWidth: number, font: any, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

async function buildPdfBytes({
  patientCode,
  submissionDate,
  ficha,
}: {
  patientCode: string;
  submissionDate: string;
  ficha: Record<string, string>;
}) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const marginX = 56;
  const headerHeight = 78;
  const bodyWidth = pageSize[0] - marginX * 2;
  const bodyTop = pageSize[1] - headerHeight - 30;
  const footerY = 28;
  const sectionDivider = rgb(0.62, 0.88, 0.8);
  const brandDark = rgb(0.06, 0.43, 0.34);
  const brandSoft = rgb(0.62, 0.88, 0.8);
  const textMain = rgb(0.17, 0.17, 0.16);
  const textMuted = rgb(0.53, 0.53, 0.5);

  let page = pdfDoc.addPage(pageSize);
  let cursorY = bodyTop;

  const drawHeader = (currentPage: typeof page, subtitle: string) => {
    currentPage.drawRectangle({
      x: 0,
      y: pageSize[1] - headerHeight,
      width: pageSize[0],
      height: headerHeight,
      color: brandDark,
    });
    currentPage.drawText("FisioApp", {
      x: marginX,
      y: pageSize[1] - 36,
      size: 22,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    currentPage.drawText(subtitle, {
      x: marginX,
      y: pageSize[1] - 56,
      size: 11,
      font: fontRegular,
      color: brandSoft,
    });
    currentPage.drawText(`Paciente: ${patientCode}`, {
      x: pageSize[0] - marginX - 160,
      y: pageSize[1] - 36,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    currentPage.drawText(`Fecha: ${formatDisplayDate(submissionDate)}`, {
      x: pageSize[0] - marginX - 160,
      y: pageSize[1] - 54,
      size: 10,
      font: fontRegular,
      color: brandSoft,
    });
  };

  const drawFooter = (currentPage: typeof page) => {
    currentPage.drawText(
      "Documento generado por Clínica · Flujo estático + Supabase · Uso clínico interno",
      {
        x: marginX,
        y: footerY,
        size: 8.5,
        font: fontRegular,
        color: textMuted,
      },
    );
  };

  const ensureSpace = (neededHeight: number, subtitle = "Continuación del registro") => {
    if (cursorY - neededHeight >= footerY + 20) {
      return;
    }

    drawFooter(page);
    page = pdfDoc.addPage(pageSize);
    drawHeader(page, subtitle);
    cursorY = bodyTop;
  };

  const drawWrappedLine = (label: string, value: string) => {
    const labelWidth = 180;
    const valueWidth = bodyWidth - labelWidth - 8;
    const labelText = `${label}:`;
    const lines = wrapText(value || "—", valueWidth, fontRegular, 10);
    const lineHeight = 14;
    const blockHeight = Math.max(lines.length, 1) * lineHeight + 4;

    ensureSpace(blockHeight + 6);

    page.drawText(labelText, {
      x: marginX,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: textMain,
    });

    let lineY = cursorY;
    for (const line of lines) {
      page.drawText(line, {
        x: marginX + labelWidth,
        y: lineY,
        size: 10,
        font: fontRegular,
        color: textMain,
      });
      lineY -= lineHeight;
    }

    cursorY -= blockHeight;
  };

  drawHeader(page, "Informe de revisión clínica");

  for (const section of sectionRows) {
    ensureSpace(36);
    page.drawText(section.title.toUpperCase(), {
      x: marginX,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: brandDark,
    });
    cursorY -= 8;

    page.drawRectangle({
      x: marginX,
      y: cursorY,
      width: bodyWidth,
      height: 1.5,
      color: sectionDivider,
    });
    cursorY -= 18;

    for (const [label, field] of section.rows) {
      drawWrappedLine(label, ficha[field] || "—");
    }

    cursorY -= 12;
  }

  drawFooter(page);
  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (SUPABASE_ANON_KEY) {
    const incomingKey = req.headers.get("apikey") ?? "";
    if (incomingKey !== SUPABASE_ANON_KEY) {
      return jsonResponse({ ok: false, error: "Invalid API key" }, 401);
    }
  }

  const payload = await req.json();
  const nombre = normalizeText(payload.nombre);
  const apellidos = normalizeText(payload.apellidos);
  const phone = normalizeText(payload.phone);
  const email = normalizeText(payload.email) || null;
  const birthDate = normalizeText(payload.birth_date) || null;
  const signatureData = normalizeText(payload.signature) || null;
  const rgpd = Boolean(payload.rgpd);
  const privacyPolicy = Boolean(payload.privacy_policy);
  const ficha = hydrateFichaCampos(payload);
  const submissionDate = normalizeText(payload.fecha) || new Date().toISOString().slice(0, 10);

  if (!nombre || !apellidos || !phone) {
    return jsonResponse({ ok: false, error: "Nombre, apellidos y teléfono son obligatorios." }, 400);
  }

  if (!rgpd || !privacyPolicy) {
    return jsonResponse({ ok: false, error: "Debes aceptar RGPD y política de privacidad." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: matchedProfiles, error: profileLookupError } = await supabase
    .from("core_profiles")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);

  if (profileLookupError) {
    return jsonResponse({ ok: false, error: profileLookupError.message }, 500);
  }

  let profile = matchedProfiles?.[0] ?? null;

  if (!profile) {
    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from("core_profiles")
      .insert({
        name: nombre,
        surnames: apellidos,
        phone,
        email,
        birth_date: birthDate,
        profile_status: "pending_validation",
        created_by: "form",
        notes: "Alta creada desde flujo estático + Supabase",
      })
      .select()
      .single();

    if (insertProfileError || !insertedProfile) {
      return jsonResponse({ ok: false, error: insertProfileError?.message || "No se pudo crear el perfil." }, 500);
    }

    profile = insertedProfile;
  }

  const { error: consentError } = await supabase
    .from("consents")
    .insert({
      profile_id: profile.id,
      rgpd,
      privacy_policy: privacyPolicy,
      signature_data: signatureData,
      status: "consent_signed",
      user_agent: req.headers.get("user-agent"),
    });

  if (consentError) {
    return jsonResponse({ ok: false, error: consentError.message }, 500);
  }

  const submissionData = {
    ...ficha,
    patient_name: nombre,
    patient_surnames: apellidos,
    phone,
    email,
    birth_date: birthDate,
    submission_date: submissionDate,
  };

  const { data: appSubmission, error: appSubmissionError } = await supabase
    .from("app_submissions")
    .insert({
      profile_id: profile.id,
      app_id: "fisio",
      form_version: "static-1.0",
      status: "pending",
      submitted_by: "patient",
      data: submissionData,
      notes: "Ficha pública enviada desde flujo estático",
    })
    .select()
    .single();

  if (appSubmissionError || !appSubmission) {
    return jsonResponse({ ok: false, error: appSubmissionError?.message || "No se pudo guardar la ficha." }, 500);
  }

  const pdfBytes = await buildPdfBytes({
    patientCode: profile.registry_number,
    submissionDate,
    ficha: submissionData,
  });

  const safeName = sanitizeFileName(`${apellidos}-${nombre}`) || profile.registry_number.toLowerCase();
  const storagePath =
    `${profile.registry_number}/${appSubmission.id}/${submissionDate}-${safeName}.pdf`;

  const { error: uploadError } = await supabase
    .storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return jsonResponse({ ok: false, error: uploadError.message }, 500);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, 60 * 30);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return jsonResponse({ ok: false, error: signedUrlError?.message || "No se pudo firmar el PDF." }, 500);
  }

  const enrichedSubmissionData = {
    ...submissionData,
    pdf_bucket: PDF_BUCKET,
    pdf_path: storagePath,
    pdf_filename: `${profile.registry_number}_${submissionDate}.pdf`,
  };

  await supabase
    .from("app_submissions")
    .update({
      data: enrichedSubmissionData,
      notes: "Ficha pública enviada y PDF generado automáticamente",
    })
    .eq("id", appSubmission.id);

  return jsonResponse({
    ok: true,
    profile_id: profile.id,
    registry_number: profile.registry_number,
    submission_id: appSubmission.id,
    matched_existing_profile: Boolean(matchedProfiles?.[0]),
    download_url: signedUrlData.signedUrl,
    storage_path: storagePath,
  });
});
