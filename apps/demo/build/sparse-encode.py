import json
import sys

import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForMaskedLM, AutoTokenizer


def build_query_token_weight_vector(tokenizer, model_id: str):
    local_cached_path = hf_hub_download(repo_id=model_id, filename="query_token_weights.txt")
    vector = [0.0] * tokenizer.vocab_size

    with open(local_cached_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.rstrip("\n")
            if not line:
                continue
            token, weight = line.split("\t", 1)
            token_id = tokenizer._convert_token_to_id_with_added_voc(token)
            if token_id is not None and token_id >= 0:
                vector[token_id] = float(weight)

    return vector


def encode_document(model, tokenizer, text: str, top_tokens: int, special_token_ids: list[int]):
    features = tokenizer([text], padding=True, truncation=True, return_tensors="pt", return_token_type_ids=False)
    output = model(**features).logits
    values, _ = torch.max(output * features["attention_mask"].unsqueeze(-1), dim=1)
    values = torch.log1p(torch.relu(values))
    values[:, special_token_ids] = 0

    row = values[0].detach()
    nonzero = torch.nonzero(row > 0, as_tuple=True)[0]
    if len(nonzero) == 0:
        return {}

    if top_tokens > 0 and len(nonzero) > top_tokens:
        candidate_weights = row[nonzero]
        top_indices = torch.topk(candidate_weights, k=top_tokens).indices
        nonzero = nonzero[top_indices]

    vector = {}
    for token_id in nonzero.tolist():
        weight = float(row[token_id])
        if weight > 0:
            vector[str(token_id)] = weight
    return vector


def main():
    payload = json.load(sys.stdin)
    model_id = payload["model_id"]
    top_tokens = int(payload["top_tokens"])
    documents = payload["documents"]

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForMaskedLM.from_pretrained(model_id)
    special_token_ids = [
        tokenizer.vocab[token]
        for value in tokenizer.special_tokens_map.values()
        for token in (value if isinstance(value, list) else [value])
        if token in tokenizer.vocab
    ]

    output_documents = []
    for document in documents:
        output_documents.append({
            "docId": document["docId"],
            "vector": encode_document(model, tokenizer, document["text"], top_tokens, special_token_ids)
        })

    json.dump({
        "query_token_weights": build_query_token_weight_vector(tokenizer, model_id),
        "documents": output_documents,
        "vocabularySize": tokenizer.vocab_size
    }, sys.stdout)


if __name__ == "__main__":
    main()
