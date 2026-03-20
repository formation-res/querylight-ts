import { DocumentIndex, GeoFieldIndex, TextFieldIndex } from "./document-index";
import { type Hit, type Hits, QueryContext, andHits, applyBoost, ids, normalizedBoost, orHits } from "./shared";

function textFieldHits(documentIndex: DocumentIndex, field: string, block: (fieldIndex: TextFieldIndex) => Hits): Hits {
  const fieldIndex = documentIndex.getFieldIndex(field);
  return fieldIndex instanceof TextFieldIndex ? block(fieldIndex) : [];
}

function geoFieldHits(documentIndex: DocumentIndex, field: string, block: (fieldIndex: GeoFieldIndex) => Hits): Hits {
  const fieldIndex = documentIndex.getFieldIndex(field);
  return fieldIndex instanceof GeoFieldIndex ? block(fieldIndex) : [];
}

export { QueryContext, andHits, applyBoost, geoFieldHits, ids, normalizedBoost, orHits, textFieldHits };
export type { Hit, Hits };
