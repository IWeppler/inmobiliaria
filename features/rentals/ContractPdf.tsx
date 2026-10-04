"use client";

import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TemplateBlock } from "@/features/rentals/contractTemplate";

// Sin cortar palabras con guiones: en un contrato confunde.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 64, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.5, color: "#111" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 14, textAlign: "center", marginBottom: 18 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 10, marginBottom: 4 },
  paragraph: { textAlign: "justify", marginBottom: 8 },
  footer: { position: "absolute", bottom: 28, left: 64, right: 64, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#777" },
});

export function ContractPdf({ blocks, title }: { blocks: TemplateBlock[]; title: string }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        {blocks.map((block, i) => (
          <Text key={i} style={styles[block.kind]} wrap={block.kind === "paragraph"} minPresenceAhead={block.kind === "heading" ? 40 : 0}>
            {block.text}
          </Text>
        ))}
        <View style={styles.footer} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
