import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  CVContent,
  CVExperience,
  CVEducation,
  CVSkillGroup,
  CVLanguage,
  CVCertification,
} from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    padding: 50,
    lineHeight: 1.35,
  },
  name: { fontSize: 16, fontFamily: "Times-Bold", textAlign: "center" },
  contactLine: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginTop: 10,
    marginBottom: 6,
    paddingBottom: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
  bullet: { flexDirection: "row", marginLeft: 8, marginTop: 1 },
  bulletText: { flex: 1 },
  summary: { marginBottom: 4 },
  entryBlock: { marginBottom: 4 },
});

const LABELS = {
  es: {
    profile: "Perfil",
    education: "Educación",
    experience: "Experiencia",
    skills: "Skills",
    languages: "Idiomas",
    certifications: "Certificaciones",
    present: "Presente",
  },
  en: {
    profile: "Profile",
    education: "Education",
    experience: "Experience",
    skills: "Skills",
    languages: "Languages",
    certifications: "Certifications",
    present: "Present",
  },
} as const;

type LabelSet = (typeof LABELS)[keyof typeof LABELS];

function getLabels(language: string): LabelSet {
  return language === "en" ? LABELS.en : LABELS.es;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ExperienceEntry({
  entry,
  present,
}: {
  entry: CVExperience;
  present: string;
}) {
  const dateRange = `${entry.start} – ${entry.end ?? present}`;
  return (
    <View style={styles.entryBlock}>
      <View style={styles.row}>
        <Text style={styles.bold}>{entry.company}</Text>
        {entry.location ? <Text>{entry.location}</Text> : null}
      </View>
      <View style={styles.row}>
        <Text style={styles.italic}>{entry.title}</Text>
        <Text>{dateRange}</Text>
      </View>
      {entry.bullets.map((b, i) => (
        <View key={i} style={styles.bullet}>
          <Text>{"• "}</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function EducationEntry({ entry }: { entry: CVEducation }) {
  const dates =
    entry.start || entry.end
      ? `${entry.start ?? ""}–${entry.end ?? ""}`
      : "";
  return (
    <View style={styles.entryBlock}>
      <View style={styles.row}>
        <Text>
          <Text style={styles.bold}>{entry.institution}</Text>
          {` — ${entry.degree}`}
        </Text>
        {dates ? <Text>{dates}</Text> : null}
      </View>
    </View>
  );
}

function SkillsSection({ skills }: { skills: CVSkillGroup[] }) {
  return (
    <>
      {skills.map((group, i) => (
        <Text key={i}>
          <Text style={styles.bold}>{group.category}:</Text>
          {` ${group.items.join(", ")}`}
        </Text>
      ))}
    </>
  );
}

function LanguagesSection({ languages }: { languages: CVLanguage[] }) {
  const text = languages.map((l) => `${l.name} (${l.level})`).join(" • ");
  return <Text>{text}</Text>;
}

function CertificationsSection({
  certifications,
}: {
  certifications: CVCertification[];
}) {
  return (
    <>
      {certifications.map((cert, i) => {
        const parts = [cert.name];
        if (cert.issuer) parts.push(cert.issuer);
        const suffix = cert.year ? ` (${cert.year})` : "";
        return (
          <Text key={i}>
            {parts.join(" —")}
            {suffix}
          </Text>
        );
      })}
    </>
  );
}

export function HarvardCV({
  cv,
  language,
}: {
  cv: CVContent;
  language: string;
}) {
  const labels = getLabels(language);

  const contactParts = [
    cv.contact.location,
    cv.contact.email,
    cv.contact.phone,
    cv.contact.linkedin,
    cv.contact.website,
  ].filter(Boolean) as string[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{cv.contact.name}</Text>
        <Text style={styles.contactLine}>{contactParts.join(" • ")}</Text>

        {cv.summary ? (
          <View>
            <SectionTitle title={labels.profile} />
            <Text style={styles.summary}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.education.length > 0 ? (
          <View>
            <SectionTitle title={labels.education} />
            {cv.education.map((edu, i) => (
              <EducationEntry key={i} entry={edu} />
            ))}
          </View>
        ) : null}

        {cv.experience.length > 0 ? (
          <View>
            <SectionTitle title={labels.experience} />
            {cv.experience.map((exp, i) => (
              <ExperienceEntry key={i} entry={exp} present={labels.present} />
            ))}
          </View>
        ) : null}

        {cv.skills.length > 0 ? (
          <View>
            <SectionTitle title={labels.skills} />
            <SkillsSection skills={cv.skills} />
          </View>
        ) : null}

        {cv.languages.length > 0 ? (
          <View>
            <SectionTitle title={labels.languages} />
            <LanguagesSection languages={cv.languages} />
          </View>
        ) : null}

        {cv.certifications.length > 0 ? (
          <View>
            <SectionTitle title={labels.certifications} />
            <CertificationsSection certifications={cv.certifications} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
