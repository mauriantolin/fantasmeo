import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    padding: 50,
    lineHeight: 1.35,
  },
  candidateName: { fontFamily: "Times-Bold", marginBottom: 4 },
  date: { marginBottom: 12 },
  companyName: { marginBottom: 12 },
  paragraph: { marginBottom: 8 },
  closing: { marginTop: 20 },
  signature: { fontFamily: "Times-Bold", marginTop: 8 },
});

function formatDate(language: string): string {
  const now = new Date();
  if (language === "en") {
    return format(now, "MMMM d, yyyy", { locale: enUS });
  }
  return format(now, "d 'de' MMMM 'de' yyyy", { locale: es });
}

function getClosing(language: string): string {
  return language === "en" ? "Sincerely," : "Atentamente,";
}

export function CoverLetterPDF({
  content,
  candidateName,
  companyName,
  language,
}: {
  content: string;
  candidateName: string;
  companyName: string;
  language: string;
}) {
  const dateStr = formatDate(language);
  const closing = getClosing(language);
  const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.candidateName}>{candidateName}</Text>
        <Text style={styles.date}>{dateStr}</Text>
        <Text style={styles.companyName}>{companyName}</Text>

        <View>
          {paragraphs.map((paragraph, i) => (
            <Text key={i} style={styles.paragraph}>
              {paragraph.trim()}
            </Text>
          ))}
        </View>

        <Text style={styles.closing}>{closing}</Text>
        <Text style={styles.signature}>{candidateName}</Text>
      </Page>
    </Document>
  );
}
