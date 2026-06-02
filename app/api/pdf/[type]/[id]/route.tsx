export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { HarvardCV } from "@/lib/pdf/harvard-cv";
import { CoverLetterPDF } from "@/lib/pdf/cover-letter-pdf";
import type { CVContent, JDSummary } from "@/lib/types";

function sanitizeFilename(name: string): string {
  return name.replace(/"/g, "'");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  if (type === "cv") {
    const { data: generated } = await supabase
      .from("generated_cvs")
      .select(
        "content, application_id, applications(company_name, position_title, jd_summary)"
      )
      .eq("id", id)
      .single();
    if (!generated) return new NextResponse("Not found", { status: 404 });

    const cv = generated.content as CVContent;
    const jd = (
      generated.applications as unknown as { jd_summary: JDSummary | null }
    )?.jd_summary;
    const buffer = await renderToBuffer(
      <HarvardCV cv={cv} language={jd?.language ?? "es"} />
    );
    const fileName = sanitizeFilename(`CV - ${cv.contact.name}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  if (type === "cover-letter") {
    const { data: letter } = await supabase
      .from("cover_letters")
      .select("content, applications(company_name, jd_summary)")
      .eq("id", id)
      .single();
    if (!letter) return new NextResponse("Not found", { status: 404 });

    const app = letter.applications as unknown as {
      company_name: string;
      jd_summary: JDSummary | null;
    };
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const buffer = await renderToBuffer(
      <CoverLetterPDF
        content={letter.content}
        candidateName={profile?.full_name ?? ""}
        companyName={app.company_name}
        language={app.jd_summary?.language ?? "es"}
      />
    );

    const fileName = sanitizeFilename(
      `Cover Letter - ${app.company_name}.pdf`
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  return new NextResponse("Invalid type", { status: 400 });
}
