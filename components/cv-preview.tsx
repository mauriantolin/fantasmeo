import type { CVContent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CVPreviewProps {
  content: CVContent;
}

export function CVPreview({ content }: CVPreviewProps) {
  const { contact, summary, experience, education, skills, languages, certifications } = content;

  return (
    <div className="space-y-6 text-sm">
      {/* Contact header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{contact.name}</h2>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>{contact.phone}</span>}
          {contact.location && <span>{contact.location}</span>}
          {contact.linkedin && (
            <a href={contact.linkedin} className="hover:underline" target="_blank" rel="noopener noreferrer">
              {contact.linkedin}
            </a>
          )}
          {contact.website && (
            <a href={contact.website} className="hover:underline" target="_blank" rel="noopener noreferrer">
              {contact.website}
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <Separator />
          <section>
            <h3 className="mb-1 font-semibold uppercase tracking-wide">Resumen</h3>
            <p className="text-muted-foreground">{summary}</p>
          </section>
        </>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="mb-3 font-semibold uppercase tracking-wide">Experiencia</h3>
            <div className="space-y-4">
              {experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium">{exp.title}</span>
                      {" — "}
                      <span>{exp.company}</span>
                      {exp.location && (
                        <span className="text-muted-foreground"> · {exp.location}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {exp.start} – {exp.end ?? "Presente"}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5">
                      {exp.bullets.filter(Boolean).map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Education */}
      {education.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="mb-3 font-semibold uppercase tracking-wide">Educación</h3>
            <div className="space-y-2">
              {education.map((edu, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">{edu.degree}</span>
                    {" — "}
                    <span>{edu.institution}</span>
                  </div>
                  {(edu.start || edu.end) && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {[edu.start, edu.end].filter(Boolean).join(" – ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="mb-3 font-semibold uppercase tracking-wide">Habilidades</h3>
            <div className="space-y-2">
              {skills.map((sg, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 font-medium">{sg.category}:</span>
                  {sg.items.map((item, j) => (
                    <Badge key={j} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="mb-3 font-semibold uppercase tracking-wide">Idiomas</h3>
            <div className="flex flex-wrap gap-3">
              {languages.map((lang, i) => (
                <span key={i}>
                  <span className="font-medium">{lang.name}</span>
                  <span className="text-muted-foreground"> · {lang.level}</span>
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="mb-3 font-semibold uppercase tracking-wide">Certificaciones</h3>
            <div className="space-y-1">
              {certifications.map((cert, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium">{cert.name}</span>
                  {cert.issuer && (
                    <span className="text-muted-foreground">— {cert.issuer}</span>
                  )}
                  {cert.year && (
                    <span className="text-muted-foreground text-xs">{cert.year}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
